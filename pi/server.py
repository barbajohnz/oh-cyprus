"""
Love Letters to Cyprus - Raspberry Pi lighting server
Alexandros Barbayianis, NYU IMA Low Res Thesis 2026

Runs on a Raspberry Pi 4 joined to the installation MiFi network.
Listens on port 5000 and receives lighting cues over HTTP from the
participant web app, then drives four Tapo L535 colour bulbs, one per
narrative segment.

RECONSTRUCTED FILE. The version that actually ran the June 2026 Shanghai
show lived on the Pi and was never committed. This file was rebuilt from
the cue payloads that script.js sends, so every option the front end
emits is handled here. It is functionally equivalent, not byte identical.

Run:
    export TAPO_EMAIL="you@example.com"
    export TAPO_PASSWORD="your_tapo_password"
    python3 server.py
"""

import asyncio
import os
import random
import threading

from flask import Flask, request, jsonify
from flask_cors import CORS
from tapo import ApiClient
from tapo.requests import Color

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------
# Read from the environment so real credentials never enter the public
# repo. Set them in ~/.bashrc on the Pi, or in the systemd unit file.

EMAIL = os.environ.get("TAPO_EMAIL", "YOUR_TAPO_EMAIL")
PASSWORD = os.environ.get("TAPO_PASSWORD", "YOUR_TAPO_PASSWORD")

# ---------------------------------------------------------------------
# Bulb map
# ---------------------------------------------------------------------
# One bulb per segment. The names on the left are exactly the strings
# script.js sends in the "bulb" field, so do not rename them without
# editing SEGMENT_BULB in script.js too.
#
# Give every bulb a static DHCP reservation in the MiFi admin page.
# Bulbs that pick up a new address on reboot are the single most common
# cause of a dead segment during a show.

BULBS = {
    "desk": "192.168.0.200",   # Segment 1, school desk lamp, 1953
    "seg2": "192.168.0.201",   # Segment 2, restaurant hanging bulb, 1962
    "seg3": "192.168.0.202",   # Segment 3, puppet theatre
    "seg4": "192.168.0.203",   # Segment 4, single hanging bulb, 2003
}

# ---------------------------------------------------------------------
# Cue cancellation
# ---------------------------------------------------------------------
# Flicker cues run for up to 22 seconds. They execute on a background
# thread so the HTTP response returns immediately and the participant's
# phone is never left waiting. Each bulb carries a generation counter.
# Sending any new cue to a bulb bumps its counter, which tells a flicker
# still running on that bulb to stop on its next step. Without this a
# long flicker would keep writing to the bulb after the next cue landed
# and the segment would visibly fight itself.

_generation = {name: 0 for name in BULBS}
_gen_lock = threading.Lock()


def next_generation(name):
    with _gen_lock:
        _generation[name] += 1
        return _generation[name]


def is_current(name, gen):
    with _gen_lock:
        return _generation[name] == gen


# ---------------------------------------------------------------------
# Device handles
# ---------------------------------------------------------------------
# The Tapo handshake costs roughly a second, which is too slow to eat on
# every cue. Handles are cached per bulb and rebuilt automatically if a
# cached one goes stale, which happens after a bulb loses power.

_devices = {}
_dev_lock = threading.Lock()


async def get_device(name, force_new=False):
    with _dev_lock:
        cached = _devices.get(name)
    if cached is not None and not force_new:
        return cached

    client = ApiClient(EMAIL, PASSWORD)
    device = await client.l535(BULBS[name])
    with _dev_lock:
        _devices[name] = device
    return device


async def with_retry(name, action):
    """Run action(device). On failure, rebuild the handle once and retry."""
    try:
        device = await get_device(name)
        return await action(device)
    except Exception as first_error:
        print(f"[cue] {name} failed ({first_error}), rebuilding handle")
        try:
            device = await get_device(name, force_new=True)
            return await action(device)
        except Exception as second_error:
            print(f"[cue] {name} failed again: {second_error}")
            return None


# ---------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------

async def apply_colour(device, color=None, hue=None, saturation=None):
    """hue wins over color, matching how script.js builds its cues."""
    if hue is not None:
        sat = saturation if saturation is not None else 100
        await device.set_hue_saturation(hue, sat)
    elif color:
        await device.set_color(getattr(Color, color))


async def fade_brightness(device, target, fade_seconds):
    """Ramp brightness in steps. Five steps per second reads as smooth
    on an L535 without flooding the bulb with requests."""
    steps = max(1, int(fade_seconds * 5))
    start = 1
    delta = (target - start) / steps
    for i in range(1, steps + 1):
        level = int(start + delta * i)
        level = max(1, min(100, level))
        await device.set_brightness(level)
        await asyncio.sleep(fade_seconds / steps)


# ---------------------------------------------------------------------
# Standard cue
# ---------------------------------------------------------------------

async def do_cue(name, on=True, brightness=None, color=None,
                 hue=None, saturation=None, fade=None):

    async def action(device):
        if not on:
            await device.off()
            return

        # Fading up from black starts at 1 so the ramp begins dark
        # rather than snapping to the last brightness the bulb held.
        if fade and fade > 0 and brightness is not None:
            await device.set_brightness(1)

        await device.on()
        await apply_colour(device, color, hue, saturation)

        if brightness is not None:
            if fade and fade > 0:
                await fade_brightness(device, brightness, fade)
            else:
                await device.set_brightness(brightness)

    await with_retry(name, action)


# ---------------------------------------------------------------------
# Flicker cues
# ---------------------------------------------------------------------
# Two modes, both sent by script.js:
#
#   flicker: "onoff"  used for the fire in Segment 2, the shelling in
#                     Segment 2, and the purple strobe in Segment 3.
#                     The bulb cuts on and off at irregular intervals.
#
#   flicker: "color"  used once, at 5:00 in Segment 2. The bulb holds on
#                     and jumps around the warm end of the wheel, which
#                     reads as firelight rather than a power fault.
#
# Both settle into the brightness and colour carried in the same payload
# when the duration runs out, so the cue that follows starts from a known
# state.

async def do_flicker(name, gen, mode="onoff", duration=10, brightness=None,
                     color=None, hue=None, saturation=None):

    async def action(device):
        await device.on()
        await apply_colour(device, color, hue, saturation)
        if brightness is not None:
            await device.set_brightness(brightness)

        loop = asyncio.get_event_loop()
        end = loop.time() + duration

        while loop.time() < end:
            if not is_current(name, gen):
                return  # a newer cue landed, abandon this flicker

            if mode == "color":
                # Warm end of the wheel: red through amber.
                await device.set_hue_saturation(random.randint(0, 45), 100)
                await device.set_brightness(random.randint(40, 100))
                await asyncio.sleep(random.uniform(0.08, 0.30))
            else:
                await device.off()
                await asyncio.sleep(random.uniform(0.05, 0.25))
                if not is_current(name, gen):
                    return
                await device.on()
                await asyncio.sleep(random.uniform(0.10, 0.60))

        if not is_current(name, gen):
            return

        # Settle
        await device.on()
        await apply_colour(device, color, hue, saturation)
        if brightness is not None:
            await device.set_brightness(brightness)

    await with_retry(name, action)


# ---------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------

def run_cue_in_background(coro_factory):
    """Each cue gets its own event loop on its own thread so a long
    flicker on one bulb never blocks a cue heading to another."""
    def runner():
        try:
            asyncio.run(coro_factory())
        except Exception as error:
            print(f"[cue] background failure: {error}")

    threading.Thread(target=runner, daemon=True).start()


@app.route("/cue", methods=["POST"])
def cue():
    data = request.json or {}
    name = data.get("bulb")

    if name not in BULBS:
        return jsonify({"status": "error", "message": f"unknown bulb {name}"}), 400

    on = data.get("on", True)
    brightness = data.get("brightness")
    color = data.get("color")
    hue = data.get("hue")
    saturation = data.get("saturation")
    fade = data.get("fade")
    flicker = data.get("flicker")
    duration = data.get("duration", 10)

    gen = next_generation(name)

    if flicker:
        run_cue_in_background(lambda: do_flicker(
            name, gen, mode=flicker, duration=duration,
            brightness=brightness, color=color,
            hue=hue, saturation=saturation))
    else:
        run_cue_in_background(lambda: do_cue(
            name, on=on, brightness=brightness, color=color,
            hue=hue, saturation=saturation, fade=fade))

    return jsonify({"status": "ok"})


@app.route("/all-off", methods=["POST"])
def all_off():
    """House lights down. Useful at the end of a run and when resetting
    between groups. Not called by the web app."""
    for name in BULBS:
        gen = next_generation(name)
        run_cue_in_background(lambda n=name: do_cue(n, on=False))
    return jsonify({"status": "ok"})


@app.route("/health", methods=["GET"])
def health():
    """Open this in a phone browser on the MiFi to confirm the Pi is
    reachable before doors open."""
    return jsonify({"status": "ok", "bulbs": BULBS})


if __name__ == "__main__":
    print("Love Letters to Cyprus lighting server")
    print(f"Bulbs: {BULBS}")
    app.run(host="0.0.0.0", port=5000, threaded=True)

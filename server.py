from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio
from tapo import ApiClient
from tapo.requests import Color

app = Flask(__name__)
CORS(app)

# Replace with your own Tapo account credentials on the Pi.
# Do not commit real credentials to a public repo.
EMAIL = 'YOUR_TAPO_EMAIL'
PASSWORD = 'YOUR_TAPO_PASSWORD'

BULBS = {
    'desk': '192.168.0.200',
}

async def get_device(name):
    client = ApiClient(EMAIL, PASSWORD)
    return await client.l535(BULBS[name])

async def do_cue(name, on=True, brightness=None, color=None, hue=None, saturation=None, fade=None):
    device = await get_device(name)

    if not on:
        await device.off()
        return

    # If fading up from off, start dark so the ramp begins at black
    if fade and fade > 0 and brightness is not None:
        await device.set_brightness(1)

    await device.on()

    if hue is not None:
        sat = saturation if saturation is not None else 100
        await device.set_hue_saturation(hue, sat)
    elif color:
        await device.set_color(getattr(Color, color))

    if brightness is not None:
        if fade and fade > 0:
            await fade_brightness(device, brightness, fade)
        else:
            await device.set_brightness(brightness)

async def fade_brightness(device, target, fade_seconds):
    steps = max(1, int(fade_seconds * 5))
    start = 1
    delta = (target - start) / steps
    for i in range(1, steps + 1):
        level = int(start + delta * i)
        level = max(1, min(100, level))
        await device.set_brightness(level)
        await asyncio.sleep(fade_seconds / steps)

@app.route('/cue', methods=['POST'])
def cue():
    data = request.json
    name = data.get('bulb')
    on = data.get('on', True)
    brightness = data.get('brightness')
    color = data.get('color')
    hue = data.get('hue')
    saturation = data.get('saturation')
    fade = data.get('fade')
    asyncio.run(do_cue(name, on=on, brightness=brightness, color=color, hue=hue, saturation=saturation, fade=fade))
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

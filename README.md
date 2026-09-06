# Love Letters to Cyprus

**Oh Cyprus, My Love** — technical documentation and rebuild guide

Alexandros Barbayianis
NYU Tisch, Interactive Media Arts Low Residency, MFA Thesis 2026
Final installation: NYU Shanghai, June 11 to 12, 2026

---

## What this is

A twelve minute immersive audio installation about the partition of Cyprus, told through two Cypriot men, Yiannis and Yusef, who meet at school in 1953 and are separated by the events of 1974. Participants walk barefoot through four fabric divided rooms carrying their own phone and headphones. The phone plays the narration. The room lights respond to it.

There is no operator pressing buttons and no fixed show control desk. Each participant's phone is the show controller for the room they are standing in. The web app watches its own audio playhead, and when it crosses a cue time it fires an HTTP request at a Raspberry Pi, which changes the bulb in that room.

This document covers every piece of that system and how to stand it back up from nothing.

---

## Architecture

```
             MiFi router  (MIFI-70F9)
             self contained, no internet
                        |
   +----------+---------+---------+-----------+
   |          |                   |           |
 MacBook    Raspberry Pi 4    Tapo L535   Participant
 .0.210     .0.196            .200-.203   phones (DHCP)
   |          |                   |           |
 VS Code    Flask server      one bulb    phone browser
 Live       port 5000         per room    opens the
 Server     |                     |       laptop address
 port 5500  |                     |           |
   |        |<--- POST /cue ------|-----------+
   |        |     {bulb, brightness, hue,     |
   |        |      color, fade, flicker}      |
   |                                          |
   +--- serves html, js, audio over HTTP -----+
```

Three moving parts.

**The MacBook is the web server.** It runs VS Code with the Live Server extension, serving this repository over plain HTTP on port 5500. Participants join the MiFi network and open `http://192.168.0.210:5500` in their phone browser. That address is the "custom link" handed out at the door.

**The Raspberry Pi is the lighting controller.** It runs a small Flask app on port 5000 that accepts cue payloads and translates them into Tapo bulb commands over the local network.

**The MiFi is the whole world.** Nothing in the installation touches the internet during a show. The router exists so the laptop, the Pi, the four bulbs and every participant phone can see each other at known addresses, in a venue whose own wifi you do not control and cannot rely on.

### Why the laptop serves the site rather than GitHub Pages

This repository also deploys to GitHub Pages at `cyprus.abarbayianis.com`, and that version works as a listening experience. It cannot run the lights.

GitHub Pages serves over HTTPS. The Pi serves over plain HTTP. Every browser blocks a secure page from making insecure requests, so the `fetch` call to `http://192.168.0.196:5000/cue` is refused as mixed content before it leaves the phone. The audio still plays. The room stays dark.

Serving the same files from Live Server over HTTP puts the page and the Pi on the same protocol and the cues go through. One codebase covers both cases: the public link for anyone who wants to hear the piece, and the local address for the room itself. The `.catch()` on `sendCue` exists for exactly this reason, so the hosted version fails quietly instead of throwing on every cue.

---

## Repository contents

| Path | What it is |
|---|---|
| `index.html` | The participant web app. Intro animation, welcome gate, four segment screens, end screen. |
| `script.js` | All show logic. Cue tables, audio players, progress saving, screen navigation. |
| `style.css` | Parchment and ink visual treatment. Playfair Display and Lora. |
| `lltc-title.svg` | Hand lettered title, also the source of the stroke drawing intro animation. |
| `audio/segment1-4.m4a` | The four narration tracks. AAC at 128 kbps, converted with ffmpeg. |
| `pi/server.py` | Raspberry Pi lighting server. See the note on reconstruction below. |
| `pi/requirements.txt` | Python dependencies for the Pi. |
| `pi/lltc-lights.service` | systemd unit so the lighting server starts on boot. |
| `server.py` (root) | The earlier committed lighting server. Single bulb, no flicker. Superseded by `pi/server.py`. |
| `dashboard.html` | An operator view prototype from an earlier multi group design. Not used in the final show. Its segment durations are stale. |
| `serve_preview.py` | Plain Python static server, an alternative to Live Server for local testing. |
| `Logo PNG/`, `Illustrator Files/`, `LLTC PNG files.aep` | Title animation source assets. |
| `CNAME` | Custom domain record for the GitHub Pages deployment. |

### A note on `pi/server.py`

The lighting server that ran the Shanghai show lived on the Pi and was never committed back to this repository. The root `server.py` is an earlier state of it: one bulb named `desk`, no flicker handling.

`pi/server.py` is a reconstruction. It was rebuilt by reading every cue payload `script.js` actually sends and writing a server that handles all of them, so it covers all four bulbs and both flicker modes. It also does three things the original did not, all of which were worth adding:

- Credentials come from environment variables instead of being typed into the file, so the repository can stay public.
- Cues run on a background thread, so a twenty two second flicker in one room cannot block a cue heading to another room.
- Each bulb has a generation counter, so a new cue cancels a flicker still running on that bulb instead of letting the two fight.

It is functionally equivalent to what ran, not byte identical.

---

## The cue system

### How a cue fires

`script.js` holds one cue table per segment. Each entry is a time in seconds plus whatever should change at that moment.

```js
{ time: 75, bulb: 'desk', brightness: 100, hue: 30, saturation: 100 }
```

Every `timeupdate` event on the audio element, roughly four times a second, the script walks that segment's table and fires anything whose time has passed and which has not fired yet. Fired cues go into a `Set` keyed `segment-index`, so each one runs once no matter how many `timeupdate` events cross it.

Starting a segment from the top clears that segment's fired keys and sends an off, so the room resets for the next participant.

Cues are fire and forget. The `fetch` is never awaited and failures are swallowed by `.catch()`. A dead Pi or an unplugged bulb costs you the lights, never the story.

### Cue payload reference

| Field | Type | Meaning |
|---|---|---|
| `bulb` | string | One of `desk`, `seg2`, `seg3`, `seg4`. Must match a key in `BULBS` on the Pi. |
| `on` | bool | Defaults true. Send `false` to kill the bulb. |
| `brightness` | 1 to 100 | Target level. Never send 0, use `on: false`. |
| `color` | string | A named Tapo colour, in practice always `WarmWhite`. |
| `hue` | 0 to 360 | Overrides `color` when present. 0 red, 30 amber, 270 purple, 330 pink. |
| `saturation` | 0 to 100 | Pairs with `hue`. Defaults to 100. |
| `fade` | seconds | Ramps brightness from 1 to target over this long, five steps per second. |
| `flicker` | `onoff` or `color` | Runs for `duration` seconds, then settles into the brightness and colour in the same payload. |
| `duration` | seconds | How long a flicker runs. |

### Segment map

| Segment | Title | Years | Bulb | Continue button reveals at |
|---|---|---|---|---|
| 1 | Origins | 1945 to 1953 | `desk` | 2:40 |
| 2 | The Restaurant Years | 1960 to 1974 | `seg2` | 5:22 |
| 3 | The Puppet and The Shadow | 1974 to 2003 | `seg3` | 4:07 |
| 4 | The Phone Call | April 23, 2003 | `seg4` | 1:16 |

Roughly thirteen and a half minutes of audio across the four rooms.

### What the light is doing, room by room

**Segment 1, the school desk.** A nine second fade up to full warm white, holding the room in 1953. At 1:15 it turns amber and dims through 2:00 as the scene ages. A four second fade to near black at 2:40 releases the participant to the next room.

**Segment 2, the restaurant.** The longest and most active table. Warm white builds to full by 0:41. The first `onoff` flicker at 1:05 runs fourteen seconds. Pink at hue 330 marks the tender beats at 1:30 and 2:45. A twenty two second flicker at 2:11 is the coup. At 5:00 a thirteen second `color` flicker throws the room around the red and amber end of the wheel as the restaurant burns, then it collapses to warm white and fades out.

**Segment 3, the puppet theatre.** Opens full, then a ten second purple `onoff` strobe at 0:15 and a hard blackout at 0:25. From 0:57 the room sits low, drifting between 1 and 25, which is the long historical passage read almost in the dark. Full red at 2:31, back to warm white at 3:36, out at 4:07.

**Segment 4, the phone call.** Small and quiet. Builds from 25 to full across the first twenty seconds, holds, then drops to 1 and fades away by 1:20.

---

## Rebuild guide

### 1. The network

Bring up the MiFi router and note its SSID and password. The show network used `MIFI-70F9`.

In the router admin page, set static DHCP reservations for:

- the MacBook at `192.168.0.210`
- the Raspberry Pi at `192.168.0.196`
- the four bulbs at `192.168.0.200` through `192.168.0.203`

Do not skip this. Address drift after a power cut is the single most likely way this installation breaks, and it always breaks in the way that looks like a code bug: one room goes dark and the others are fine.

Leave the rest of the range open for participant phones.

### 2. The bulbs

Four Tapo L535 colour bulbs, one per room.

Pair each bulb to the MiFi network using the Tapo phone app, on that network, before the show. The Pi talks to the bulbs directly over the local network but pairing has to happen through the app first, and pairing needs the internet, so do this while the MiFi still has a data connection.

Once each bulb is on the network, note its address and set the reservation. Then put the addresses into `BULBS` in `pi/server.py`.

### 3. The Raspberry Pi

Raspberry Pi 4, Raspberry Pi OS, joined to the MiFi with the reservation above. Enable SSH.

```bash
ssh barbajohnz@192.168.0.196

sudo apt update
sudo apt install -y python3-pip
git clone https://github.com/barbajohnz/oh-cyprus.git
cd oh-cyprus/pi
pip3 install -r requirements.txt --break-system-packages
```

Set the Tapo credentials. Use the account the bulbs are paired to.

```bash
echo 'export TAPO_EMAIL="you@example.com"' >> ~/.bashrc
echo 'export TAPO_PASSWORD="your_tapo_password"' >> ~/.bashrc
source ~/.bashrc
```

Test by hand:

```bash
python3 server.py
```

From the laptop on the same network:

```bash
curl http://192.168.0.196:5000/health
curl -X POST http://192.168.0.196:5000/cue \
  -H "Content-Type: application/json" \
  -d '{"bulb":"desk","brightness":100,"color":"WarmWhite"}'
```

The desk bulb should come up warm. If it does, install the service so the Pi comes back on its own after a power cut:

```bash
sudo cp lltc-lights.service /etc/systemd/system/
sudo nano /etc/systemd/system/lltc-lights.service   # put the real credentials in
sudo systemctl daemon-reload
sudo systemctl enable lltc-lights
sudo systemctl start lltc-lights
sudo systemctl status lltc-lights
```

### 4. The laptop

Clone the repository. Open the folder in VS Code. Install the Live Server extension. Right click `index.html` and choose Open with Live Server.

Live Server binds to `127.0.0.1` by default in some setups, which makes it invisible to phones. Set it to serve on all interfaces in VS Code settings:

```json
"liveServer.settings.host": "0.0.0.0",
"liveServer.settings.port": 5500
```

Confirm the laptop's own address matches what is in the reservation:

```bash
ipconfig getifaddr en0
```

If the Pi address ever changes, update one line in `script.js`:

```js
const PI = 'http://192.168.0.196:5000';
```

`serve_preview.py` is a fallback if Live Server misbehaves, but its `DIRECTORY` is hardcoded and it binds to `127.0.0.1`, so change both before relying on it in a venue.

### 5. Before doors

Run this list every show day.

1. MiFi up, all four bulbs and the Pi showing in the router client list at their reserved addresses.
2. `curl http://192.168.0.196:5000/health` returns ok.
3. Live Server running, laptop asleep prevention on. A MacBook that sleeps takes the whole installation down.
4. Open `http://192.168.0.210:5500` on a test phone. Confirm the intro animation, the headphone gate, and that Segment 1 fades the desk lamp up.
5. Walk all four rooms with the test phone, confirming each bulb responds.
6. `curl -X POST http://192.168.0.196:5000/all-off` to reset.
7. Charge the participant phones if you are supplying them.

Hand participants the address written large. Phone keyboards and a numeric address are a bad combination in a dark room, so a QR code pointing at `http://192.168.0.210:5500` is worth making.

---

## Troubleshooting

**Audio plays, lights do nothing, in every room.** You are on the HTTPS version. Check the address bar. `cyprus.abarbayianis.com` cannot fire cues, only the laptop address can. Alternatively the Pi is down: hit `/health`.

**One room dark, others fine.** That bulb's address drifted. Check the router client list against `BULBS` in `pi/server.py`. This is the common failure.

**Lights lag several seconds behind the audio.** Too many phones hammering one Pi, or the Tapo handshake being rebuilt on every call. The cached device handles in `pi/server.py` address the second cause. For the first, keep group size at four.

**A flicker keeps running into the next cue.** Only possible on the old root `server.py`, which has no cancellation. Use `pi/server.py`.

**Bulb sitting at some odd colour before a participant starts.** A previous run left it there. `POST /all-off` between groups, or press the restart button in the web app, which sends off to all four.

**Participant reopens the page and lands mid experience.** By design. `localStorage` holds `oh-cyprus-progress` so a dropped connection does not send someone back to the start. "Start over instead" on the welcome screen clears it.

**Everything dies at once.** The laptop slept, or the MiFi rebooted. Check the laptop first.

---

## Known gaps

Honest list, for anyone picking this up.

- The four bulb addresses in `pi/server.py` beyond `desk` are placeholders. The real ones were never written down outside the Pi. Set them from the router.
- `dashboard.html` is dead code from a design where a facilitator tracked multiple groups. The final piece has no operator screen. Its `SEGMENT_DURATIONS` do not match the finished audio.
- There is no synchronisation between phones. Two participants in the same room, out of step, will fight over the light. Group size of four moving together on the bell is what keeps this from mattering, and it is the main thing to solve before scaling the piece up.
- Bell cues are in the audio, not driven by the system.
- Nothing logs. There is no record of how many people went through or where they stopped.

---

## Stack

Vanilla HTML, CSS and JavaScript, no build step and no framework. Python 3 with Flask and flask-cors on the Pi. The `tapo` Python library for bulb control. ffmpeg for audio conversion. Adobe Illustrator for the title lettering and vector work. Fonts are Playfair Display and Lora. Palette is deep brown `#2c1f0e`, parchment `#f5edd8`, terracotta `#c4622d`, warm gold `#8b6914`.

Hardware: Raspberry Pi 4, four Tapo L535 colour bulbs, one MiFi router, one MacBook, participant phones with wired or bluetooth headphones.

---

## Links

Live listening version
https://cyprus.abarbayianis.com

Repository
https://github.com/barbajohnz/oh-cyprus

Unite Cyprus Now
https://www.unitecyprusnow.org

PRIO Cyprus Centre
https://cyprus.prio.org

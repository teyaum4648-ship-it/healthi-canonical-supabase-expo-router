# daywoven: "Tank QR" (51 seconds)

1080×1920, 30 fps, H.264 + AAC-LC, about −14 LUFS. For Reels, TikTok, Stories and Shorts.

**The bit:** militaries have started putting QR codes on their tanks, because drones started
firing on them. Now a drone scans the tank first, and the code sends it to daywovenapp.com,
where it finds out it's running on four hours of sleep too. Then the features.
**Ask:** daywovenapp.com.

It is a deadpan joke, read straight by Jeremy (ElevenLabs, "Casual Guy Next Door"). Nothing
is shown being hit; the drone only scans. There is no music and no musical instrument anywhere
in it, only natural sound effects.

| Seconds | Voice | On screen |
| --- | --- | --- |
| 0–4.4 | So, militaries have started putting QR codes on their tanks. | A detailed tank rolls in over a hazy desert on moving treads, kicking up dust, and settles. One QR code slams onto the turret, then two dozen more cascade over the hull, turret, skirts and barrel as the camera pushes in, until it's covered like decoration. |
| 4.4–8.4 | Here's why. Drones started firing on tanks. | A drone drops in and hovers; brackets lock on round the tank. |
| 8.4–16.2 | So now, before a drone fires, it scans the tank. And the QR code sends it to daywovenapp.com. | The camera pushes in; the drone's lens beams onto the first sticker, a scan line passes over it, "QR DETECTED", and the scene blurs behind a site card that types daywovenapp.com and loads a readiness ring. |
| 16.2–20.3 | Turns out the drone's running on four hours of sleep too. | The drone, close up at dusk, droops and dozes: Sleep 4h 02m, Readiness 41 · Low. |
| 20.3–27.8 | daywoven reads your sleep, your meals, your movement and your mind, and turns them into one number for today. | The Home screen; sleep, meals, movement and mind pop on and fly into the readiness score. |
| 27.8–32.5 | It knows when your energy peaks, and when the afternoon crash is coming. | The Sleep screen ("First peak"), then a heads-up: "Dip likely ~2:30 PM". |
| 32.5–36.5 | Search any food and see how it scores before you eat it. | The food search, zooming in on the scores. |
| 36.5–40.8 | And when your day gets heavy, two minutes of breathing to reset. | A breathing orb fills and empties. |
| 40.8–44.8 | It learns your rhythm, so it gets sharper every week. | Confidence fills from Low to High over three weeks. |
| 44.8–50.6 | daywovenapp.com. Even the drones are calmer now. | On mint: the address, the wordmark, a real QR code to daywovenapp.com, and a calm, smiling drone. |

The whole ad sits under light film grain and a soft vignette. The QR codes are real: both encode `https://daywovenapp.com`, and the large one on the end card
scans from a phone screen. The app screens are real captures from
`../kinetic-promo-30s/capture-screens.mjs`.

## Making it

```bash
cd marketing/ad-tank-qr
python sfx.py                       # → sfx/*.wav, including the tank, the drone and the scan
VOICE_ENGINE=files VOICE_FILES=voice-jeremy python voiceover.py   # → vo/take*.wav and vo/plan.json
python cues.py                      # writes the effect cues into index.html
npm run check
npm run render                      # → renders/daywoven-tank-qr-9x16.mp4 (picture + effects)
./mix.sh                            # → renders/daywoven-tank-qr-9x16-vo.mp4 (the finished ad)
python ../kinetic-promo-30s/listen.py renders/daywoven-tank-qr-9x16-vo.mp4
```

The picture is cut straight to Jeremy's takes in `voice-jeremy/` (kept in the repo because they
were paid for): every tween in `index.html` and every cue in `cues.py` sits on the second its word
lands. If a line is re-recorded, re-run `voiceover.py`, listen back for the new word times, and
move that scene's timings to match.

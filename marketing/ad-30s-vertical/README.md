# daywoven — 30-second vertical ad

1080×1920, 30 fps, H.264. For Reels, TikTok, Stories and Shorts. Comes silent or with a
voice-over (female `af_heart` or male `am_michael`); add music in the platform's editor
or CapCut, kept well under the voice.

| Seconds | Scene | On screen |
| --- | --- | --- |
| 0–4.5 | Hook | "Your day isn't one number." → "Sleep. Food. Movement. Mind." over four weaving threads in the pillar colours |
| 4.5–11 | Readiness | The threads gather into the four-part ring; readiness counts to 82; "Woven into one picture of your day." |
| 11–19.5 | Food | Typing "greek yogurt", results with scores, tapping a score opens "Why this score". "Search any food." → "Tap the score to see why." |
| 19.5–25 | Sleep | "Your rhythm now — First peak", the energy curve drawing to "Now", last night's window. "Know when your energy peaks." |
| 25–30 | End card | **daywoven** — "Your whole day, woven together." |

The scene is `daywoven-ad.html`: every frame is `render(t)` for an exact second `t`, so
it renders identically every time. Open it in a browser and call `render(12.5)` in the
console to look at any moment. `render.mjs` explains how to render the video.

Content rules followed: no real brand names on products, no medical or diagnostic
claims, and the app's own colours (mint, iris, glacier, amber on the navy-charcoal
ground). Inter is used under the SIL Open Font License (`inter-LICENSE.txt`).

## Voice-over

| Starts | Line |
| --- | --- |
| 0.5 s | Your day isn't one number. |
| 2.5 s | It's sleep, food, movement, and mind. |
| 5.3 s | Daywoven weaves them together, into one picture of your day. |
| 11.8 s | Search any food. |
| 15.5 s | Tap the score, and see exactly why. |
| 20.4 s | Know when your energy peaks, and plan around it. |
| 26.5 s | Daywoven. Your whole day, woven together. |

Voiced with Kokoro (open-weight, Apache-2.0) by `voiceover.py`, then placed, levelled to
about −14 LUFS with peaks under −1.5 dBTP, and attached by `mix.sh`. To use a recorded or
other AI voice instead, put one WAV per line in `vo-<name>/` with a matching `plan.json`
and run `mix.sh <name>`. Edit `LINES` in `voiceover.py` to change the words or timing.

# daywoven: 30-second Kinetic Type promo

1080×1920, 30 fps, H.264 + AAC. For Reels, TikTok, Stories and Shorts. Big, all-caps
words land on a half-second beat between real app screens, which zoom and pan. The only
sounds are quiet ticks on each word, one pop on the tap and a chime on the name. There
are no whooshes and no music, so add a track in the platform's editor or CapCut if you
want one.

| Seconds | Scene | On screen |
| --- | --- | --- |
| 0–4.4 | Hook | "Sleep. Food. Movement. Mind." each filling the width → "It's all connected." → "Woven into one day." |
| 4.4–9 | Home | Readiness ring. "One score every morning." Punch in on the ring, then pan to the four pillar contributions: "See what's behind it." |
| 9–9.7 | Word card | **FOOD.** stretched on mint |
| 9.7–16.6 | Diet | Searching "greek yogurt": "Search any food." A tap on the 92 score: "Tap the score." The score sheet: "See why." Then "What it's made of." |
| 16.6–17.3 | Word card | **SLEEP.** |
| 17.3–21.6 | Sleep | "Your rhythm now: First peak". "Know your peak." Pan to last night's sleep window: "Plan around it." |
| 21.6–22.3 | Word card | **MIND.** |
| 22.3–25.6 | Mood | Mind + Life Load card and one suggested reset: "One reset that fits." Today's levers and the week: "Small resets add up." |
| 25.6–30 | End card | The four words, one beat each, then **daywoven**, two threads weaving under it, and "Your whole day, woven together." |

## Making it

It's a [HyperFrames](https://hyperframes.heygen.com) composition: `index.html` holds one
paused GSAP timeline, so every frame is a pure function of time and renders the same
every time.

```bash
cd marketing/kinetic-promo-30s
npm run check    # lint, layout, motion and contrast checks
npm run render   # → renders/daywoven-kinetic-30s-9x16.mp4
```

Rendering needs Node 22+, ffmpeg and ffprobe on PATH, and a Chromium that HyperFrames
can find (`HYPERFRAMES_BROWSER_PATH=/path/to/chrome-headless-shell` overrides it). To
turn off HyperFrames' anonymous usage telemetry, run `npx hyperframes telemetry disable`.

The delivered file had its audio resampled to 44.1 kHz AAC-LC, the format that plays
most widely:

```bash
ffmpeg -i renders/daywoven-kinetic-30s-9x16.mp4 -map 0 -c:v copy -af aresample=44100 \
  -c:a aac -b:a 160k -movflags +faststart daywoven-kinetic-30s-9x16.mp4
```

## The screens

`assets/*.png` are real screenshots of the web demo build, taken by `capture-screens.mjs`
at 390×844 and 3× density. The capture seeds a week of demo data, fixes the clock at
9:47 AM and answers food search with unbranded yogurts, each with a drawn cup instead of
a photo. Restaurant rows in the results name real chains, so they're hidden before the
capture. The script also refuses any frame that still shows the old working name. After
a UI change, run `npm run build:demo` at the repo root, then
`node marketing/kinetic-promo-30s/capture-screens.mjs` (this needs Playwright).

## Sounds

`sfx.py` synthesises `sfx/tick.wav`, `pop.wav` and `chime.wav` with the Python standard
library, so nothing is licensed or downloaded. Each `<audio>` tag in `index.html` sets
when one plays and how loud.

## Content rules followed

- No real brand names.
- No medical or diagnostic claims. The captions describe what the app shows: a score,
  why a food scored as it did, an energy rhythm and a suggested reset.
- Red is not used.
- Fonts:
  - Archivo Black and Inter are used under the SIL Open Font License (`fonts/*-LICENSE.txt`).
  - GSAP is bundled under its standard no-charge license.

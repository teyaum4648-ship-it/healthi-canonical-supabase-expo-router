# daywoven: 30-second Kinetic Type promo

1080×1920, 30 fps, H.264 + AAC. For Reels, TikTok, Stories and Shorts. Big, all-caps
words land on a half-second beat between real app screens, which zoom and pan. The sound
is quiet ticks on each word, one pop on the tap and a chime on the name. There are no
whooshes and no music, so add a track in the platform's editor or CapCut if you want one.
It comes with or without a voice-over, in two scripts, Calm & premium and Real talk, both read
by the female voice.

| Seconds | Scene | On screen |
| --- | --- | --- |
| 0–4.4 | Hook | "Sleep. Food. Movement. Mind." each filling the width, one word every half second → "It's all connected." → "Woven into one day." |
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

## Voice-over

Two scripts, both read by the female voice (`af_heart`).

**Calm & premium** uses few words and leaves room to breathe:

| Starts | Line |
| --- | --- |
| 0.4 s | Everything in your day is connected. |
| 4.65 s | Daywoven brings it together, in one score each morning. |
| 10 s | Every food, scored. |
| 12.75 s | And every score, explained. |
| 17.4 s | There's a rhythm to your energy. Now, you can see it. |
| 22.45 s | And when the day runs heavy, one small reset. |
| 26.6 s | Daywoven. |
| 27.65 s | Your whole day, woven together. |

**Real talk** opens with a relatable problem, then shows what the app does about it:

| Starts | Line |
| --- | --- |
| 0.3 s | Tired, wired, or ready to go? Your body's been telling you all along. |
| 4.65 s | Daywoven reads your sleep, food and movement, and sums up your day in one score. |
| 9.95 s | Search any food, tap its score, and see exactly why, right down to the ingredients. |
| 17.4 s | Learn when your energy tends to peak, and plan around it. |
| 22.45 s | Is today feeling heavy? It suggests one small reset that fits. |
| 26.6 s | Daywoven. |
| 27.65 s | Your whole day, woven together. |

Lines are whole sentences, placed so their key words fall near what's on screen.

```bash
npm run render
python voiceover.py calm            # or: python voiceover.py real
./mix.sh calm-af_heart              # → renders/daywoven-kinetic-30s-9x16-vo-calm-af_heart.mp4
python listen.py renders/daywoven-kinetic-30s-9x16-vo-calm-af_heart.mp4
```

`voiceover.py` voices each line with Kokoro, an open-weight Apache-2.0 model, using the
full-precision `kokoro-v1.0.onnx` rather than the int8 file. It trims each line's
silence, saves 24-bit WAVs and flags any line that runs into the next beat.

`mix.sh` does the rest:
- Upsamples the voice to 48 kHz with soxr.
- Cleans the voice: a low cut, slightly less 220 Hz mud, a little 3.2 kHz presence, de-essing and light compression.
- Levels every voice to the same loudness.
- Ducks the clicks under the voice.
- Masters in two loudness passes to −14 LUFS with true peaks at −1 dBTP.
- Encodes the result as AAC-LC at 44.1 kHz and 192 kbps.

`listen.py` checks the result by ear, so to speak. It transcribes the mix offline with
Parakeet and prints each word with the second it lands. Both scripts' final mixes come back
word for word.

That check is also why two lines read the way they do:
- Kokoro wouldn't lift a bare "Heavy day?" into a question, so it became "Is today feeling heavy?"
- "Your energy has a rhythm", said straight after a pause, was misheard as "Yergy has a
  rhythm". "There's a rhythm to your energy" isn't.

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

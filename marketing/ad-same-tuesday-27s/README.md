# daywoven: "Same Tuesday, twice" (27.5 seconds)

1080×1920, 30 fps, H.264 + AAC-LC, about −14 LUFS. For Reels, TikTok, Stories and Shorts.

**Who it's for:** people who swear they "just need more coffee".
**What it says:** one heads-up at 7 a.m. makes a whole different day.
**Ask:** "Link in bio".

A split screen: the same person lives the same Tuesday twice, each half with its own clock,
until both clocks land on 3:00 PM together. The hook promises a payoff ("Watch what happens
at three p.m.") and the logo only appears at the end. It's voiced by the female voice
(`af_heart`), with a natural sound effect on every movement. There is no music and no
musical instrument anywhere in it.

| Seconds | Voice | On screen |
| --- | --- | --- |
| 0–4.5 | Same person. Same Tuesday. Watch what happens at three p.m. | Two blobs asleep at 6:45 AM, one per half. Both phones buzz; both wake. Captions sit on the seam between the halves. |
| 4.5–7.7 | Up top: snooze, three coffees, no lunch. | The bottom dims. Top: "Snooze ×3" (the blob flops), three coffees (the energy bar spikes), "No lunch"; its clock runs to 1:00 PM and its energy drains. |
| 7.7–10.4 | Down here: one heads-up at seven a.m. | The top dims. Bottom: "+ one heads-up"; at 7:00 the phone buzzes and the heads-up drops in ("Short night. Your dip will likely hit around 2:30."); it tucks away as a badge. |
| 10.4–14.6 | Daylight before nine. Lunch before one. Last coffee by two. | The sun comes up behind the blob; each one slides in and gets checked off; the energy holds. |
| 14.6–16.2 | Three p.m. | Both clocks land on 3:00 PM together. The top blob melts ("(sigh)"), its energy near empty; the bottom one hops. |
| 16.2–19.6 | Same job. Same sleep. Completely different day. | The captions on the seam; the top half goes grey. |
| 19.6–25 | That heads-up is Day woven. It learns your rhythm, so every week it fits you a little better. | The heads-up and its blob rise in, the name, then the real Sleep screen, and an energy curve that fits the day's check-ins better by week 4. |
| 25–27.5 | Link in bio. | On mint: "One heads-up. A whole different day.", the wordmark, two threads, and **Link in bio**. |

The heads-up and the three suggestions come from what the app's rhythm model actually plans:
an afternoon dip 7 to 8 hours after waking, morning light in the first hour, and a caffeine
cut-off. The curve is illustrative. The Sleep screen is a real capture from
`../kinetic-promo-30s/capture-screens.mjs`.

## Making it

```bash
cd marketing/ad-same-tuesday-27s
python sfx.py                       # → sfx/*.wav (numpy, soundfile)
python cues.py                      # writes the effect cues into index.html
python voiceover.py                 # → vo/line*.wav and vo/plan.json (kokoro-onnx; see the file)
npm run check                       # lint, layout, motion and contrast checks
npm run render                      # → renders/daywoven-tuesday-27s-9x16.mp4 (picture + effects)
./mix.sh                            # → renders/daywoven-tuesday-27s-9x16-vo.mp4 (the finished ad)
python ../kinetic-promo-30s/listen.py renders/daywoven-tuesday-27s-9x16-vo.mp4
```

For the master file, render losslessly (`--crf 0`), run `./mix.sh`, then re-encode the
picture slowly so it plays everywhere; the command is in `../ad-3pm-31s/README.md`.

The picture is cut to the voice, so if a line changes, re-run `voiceover.py`, read the new
start times it prints, and move that scene's timings and its cues to match.

## Sound

About 120 effects, one on every movement: the story ad's natural sounds plus `buzz` (the
phones) and `drain` (the top half's energy dropping), all from `sfx.py`. `mix.sh`
levels the voice, ducks the effects under it, and masters to −14 LUFS. The final mix was
transcribed back with `listen.py`; every line comes through.

## Content rules followed

- No real brand names.
- No medical or diagnostic claims: "heads-up", "will likely", "energy".
- Red is not used.
- Fonts: Inter and Instrument Serif under the SIL Open Font License (`fonts/*-LICENSE.txt`).
  GSAP is bundled under its standard no-charge license.

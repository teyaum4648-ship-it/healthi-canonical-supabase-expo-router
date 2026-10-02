# daywoven: 41-second story ad

1080×1920, 30 fps, H.264 + AAC-LC, about −14 LUFS. For Reels, TikTok, Stories and Shorts.
It tells a short story, following the structure of a reference ad the team liked: a hook,
the gap between the number you're shown and how you actually feel, a cartoon culprit for
each part of the gap, the pain, then daywoven. It's voiced throughout by the female voice
(`af_heart`). The only other sound is a set of small natural sound effects. There is no
background bed, and no music or musical instrument anywhere in it.

| Seconds | Voice | On screen |
| --- | --- | --- |
| 0–2.45 | Your sleep score is lying to you. | A sleep-score card (92, "Great night") on mint is knocked away; **LYING.** slams in and glitches; *to you*. |
| 2.45–7.25 | It says you're a ninety-two today. You actually feel like a fifty-four. | A glossy mint orb pops in with 92. The orb melts into a puddle as the number drops to 54. Eyes, then *(sigh)*. |
| 7.25–8.85 | So where'd the rest go? | The puddle looks up as a mint question mark draws itself. |
| 8.85–17.15 | Skipped lunch cost twelve. Back-to-back meetings took fourteen. Yesterday's workout burned eight. And water? Another four. | The orb is back at 92, with a "54 how you feel" badge in the corner. A lavender monster bites (80). Calendar blocks stack and press down (66). A blue flame singes it (58). A nearly empty glass tips out its last drop (54). The four culprits are the four pillars, in their app colours. |
| 17.15–19.6 | And you only find out at three p.m. | Night. A clock runs from 12:00 to 3:07; *3 p.m.* |
| 19.6–21.75 | Six apps open. | "3 APPS" becomes "6 APPS *open.*" as unbranded app chips fly in, then all of it is pulled away. |
| 21.6–23.2 | So we built daywoven. | A canvas wipe, then the **daywoven** wordmark drops in letter by letter over two weaving threads. |
| 23.2–28.7 | Your sleep, your meals, your movement, your mind, woven into one number. The real one. | Sleep, Meals, Movement and Mind chips pop on their words. Threads weave into the four-arc readiness ring, which counts to 54. Pills read "*woven* into one number." then "The *real* one.", with a hand-drawn loop around the 54. |
| 28.7–34.35 | When your day starts running heavy, it taps you on the shoulder. One tap. Settled. | Today's load fills up. A mint blob peeks in ("*tap tap*") and a notification reads "Your load is building. Two-minute reset?". A tap on Start; a breathing ring; a check; *Settled.* |
| 34.35–37.75 | Every morning, before coffee, you'll know where you stand. | A sun rises, a cup steams, and a phone shows 7:02 with a morning briefing: "Restore day. Ease in, and hydrate early." |
| 37.75–41 | Fewer apps. Better days. | An indigo night with a crescent moon: "Fewer apps." *Better days.* Dawn rises behind the daywoven wordmark. |

The scores, culprits and minus numbers are illustrative of how the readiness ring weighs
sleep, food, movement and mind. They are not claims about any real person, product or
measurement.

## Making it

```bash
cd marketing/story-ad-41s
python sfx.py                       # → sfx/*.wav, the sound effects (numpy, soundfile)
python voiceover.py                 # → vo/line*.wav and vo/plan.json (kokoro-onnx; see the file)
npm run check                       # lint, layout, motion and contrast checks
npm run render                      # → renders/daywoven-story-41s-9x16.mp4 (picture + effects)
./mix.sh                            # → renders/daywoven-story-41s-9x16-vo.mp4 (the finished ad)
python ../kinetic-promo-30s/listen.py renders/daywoven-story-41s-9x16-vo.mp4
```

The picture is cut to the voice: `voiceover.py` places each line a set pause after the one
before, and the animation in `index.html` is timed to where the words land. If you change a
line, re-run `voiceover.py`, read the new start times it prints, and move that scene's
timings to match.

Rendering needs Node 22+, ffmpeg and ffprobe on PATH, and a Chromium that HyperFrames can
find (`HYPERFRAMES_BROWSER_PATH` overrides it). `npx hyperframes telemetry disable` turns
off HyperFrames' anonymous usage telemetry. `mix.sh` needs an ffmpeg built with libsoxr.

## Sound

There's no music, and every sound is synthesised by `sfx.py` from noise and simple physics:

| Sound | Where |
| --- | --- |
| A low goo bloop | the orb appearing, melting, the question mark, the pillar chips |
| A crunchy bite | the lunch monster |
| A soft knock on wood | "LYING.", the calendar blocks landing, "tap tap", tapping Start |
| A soft fwoomp with crackles | the flame |
| A short rush of air | the app chips flying in and away, the threads |
| A clock tick | 3 p.m. |
| Two water drops | the question mark's dot, the glass, the notifications, the name |
| A slow breath of air | the breathing ring |

`mix.sh` cleans and levels the voice, ducks the effects under it, and masters the result to
−14 LUFS with a −1.5 dB safety limiter. Between lines there is silence apart from the
effects. If you want a background back, `python bed.py && BED=1 ./mix.sh` lays the
stream-and-breeze bed from the kinetic promo underneath. It's cut to 41 seconds, with breezes
that swell on this ad's scene changes and bubbles 12 dB under how they were first balanced.

The final mix was transcribed back word for word with `listen.py`. Two script choices came
from that check: "Skipped lunch **cost** twelve" (not "ate", which was heard as "at 12"), and
numbers written out as words in `voiceover.py` so they're read as numbers.

## Content rules followed

- No real brand names. The apps in "6 apps open" are generic ("Sleep tracker", "Step
  counter", …).
- No medical or diagnostic claims. Wording is general wellness: a score, how you feel, a
  suggested reset, "Restore day".
- Red is not used.
- Fonts:
  - Inter and Instrument Serif are used under the SIL Open Font License (`fonts/*-LICENSE.txt`).
  - GSAP is bundled under its standard no-charge license.

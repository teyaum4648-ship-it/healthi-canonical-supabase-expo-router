# daywoven: 41-second story ad

1080×1920, 30 fps, H.264 + AAC-LC, about −14 LUFS. For Reels, TikTok, Stories and Shorts.
It tells a short story, following the structure of a reference ad the team liked: a hook,
the gap between the number you're shown and how you actually feel, a cartoon culprit for
each part of the gap, the pain, then daywoven. It's voiced throughout by the female voice
(`af_heart`), with lots of small natural sound effects on nearly every action. There is no
background bed, and no music or musical instrument anywhere in it.

| Seconds | Voice | On screen |
| --- | --- | --- |
| 0–2.45 | Your sleep score is lying to you. | Spheres bubble up on mint and a sleep-score card rises, counting up to 92 as its chart draws and its tags pop on. It is knocked away; **LYING.** slams in (the spheres flinch) and glitches; *to you*; it glitches once more. |
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
python cues.py                      # writes the effect cues into index.html
python voiceover.py                 # → vo/line*.wav and vo/plan.json (kokoro-onnx; see the file)
npm run check                       # lint, layout, motion and contrast checks
npm run render                      # → renders/daywoven-story-41s-9x16.mp4 (picture + effects, near-lossless)
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

There's no music and no background bed: just the voice and lots of small natural sound
effects, about 200 of them, one on nearly every action, down to the small ones: a blink, a
flicker, a twinkle. In the hook (the first ten seconds) every single movement has its own. `sfx.py` synthesises them all from noise and simple physics. `cues.py` is the cue sheet (second, sound, volume). It writes the
`<audio>` tags into `index.html`, so adding or moving an effect is a one-line change:
`python sfx.py && python cues.py`.

| Sound | Where |
| --- | --- |
| tick | text snapping on, the glitch settling, the clock running, each ring arc |
| pop, bloop (and pop2, bloop2, a little higher, so runs don't sound copied) | the spheres bubbling up at the start, the orb appearing, the eyes, each daywoven letter landing, the pillar chips, the number labels |
| glitch, static | the "LYING." letters glitching: one crushed burst per jump, and a click as they settle |
| flick | the hit that knocks the opening card away |
| whump | the opening card and the orb arriving |
| dart | the lunch monster's lunge |
| blink | the eyes opening, blinking, then glancing up |
| thud | "LYING.", the blocks pressing down, the badge's pulse settling, "6 APPS", "3 p.m.", "Fewer apps." |
| knock | "LYING.", the calendar blocks landing, "tap tap", tapping Start |
| tap | the card and its tags, the glass, each app chip, the cup and the phone settling into place |
| squish, drip, ooze | the melt and the puddle spreading out; the mint blob sliding in and out; the tap's ripple |
| slurp | the puddle gathering itself up into the question mark |
| wobble | the orb landing, the spheres flinching back, and the orb bouncing back like jelly after the blocks press it |
| sigh | "(sigh)" |
| scribble | the question mark, the hand-drawn loop, the check, "Better days." being written |
| patter | the lunch monster running in and out |
| smack, bite, munch | the monster's mouth opening; biting; a chomp each time its jaw closes; the last nibble |
| fire, crackle, sizzle, puff | the flame lighting, crackling as it flickers, flaring, singeing, and going out; a soft breath as text whisks off in the hook |
| slosh | the last of the water moving as the glass tips |
| zip | the opening card's chart drawing; the threads weaving under the name and into the ring |
| count, countlong | a rattle of clicks under every number that counts (the opening 92 too) and the load bar filling |
| air | only on fast movement: the card flung away, the blocks flying off, the app chips |
| drop | the question mark's dot, the glass's last drop, notifications, the name |
| breath, steam, rise | the reset ring, the coffee, the sunrise and the dawn |
| glint | each star twinkling, at 3 p.m. and at night: a few grains of sparkle with no pitch, so never a chime |

Each sound is chosen to match what moves on screen. Scene cuts make no sound, and after the hook
neither does text leaving.

`mix.sh` cleans and levels the voice, ducks the effects about 6 dB under it, and masters the
result to −14 LUFS with a −1.5 dB safety limiter. Between lines you hear only the effects.
If you want a background back, `python bed.py && BED=1 ./mix.sh` lays the stream-and-breeze
bed from the kinetic promo underneath, cut to 41 seconds.

The final mix was transcribed back with `listen.py`, and every line comes through over the
effects. Two script choices came from that check: "Skipped lunch **cost** twelve" (not
"ate", which was heard as "at 12"), and numbers written out as words in `voiceover.py` so
they're read as numbers.

## Content rules followed

- No real brand names. The apps in "6 apps open" are generic ("Sleep tracker", "Step
  counter", …).
- No medical or diagnostic claims. Wording is general wellness: a score, how you feel, a
  suggested reset, "Restore day".
- Red is not used.
- Fonts:
  - Inter and Instrument Serif are used under the SIL Open Font License (`fonts/*-LICENSE.txt`).
  - GSAP is bundled under its standard no-charge license.

## Lyan's voice (ElevenLabs)

The current cut is voiced by Lyan, an ElevenLabs voice that sounds like a regular person on a
Reel rather than a narrator. Her takes are kept in `voice-lyan/` (one per scene, in the order
`voiceover.py` asks for them), because they were paid for and the picture is timed to them.
`index.html`, `cues.py` and `mix.sh` are already retimed to her read. To rebuild:

```bash
VOICE_ENGINE=files VOICE_FILES=voice-lyan python voiceover.py
python retime.py && python sfx.py && python cues.py && npm run render && ./mix.sh
```

Running `voiceover.py` without `VOICE_ENGINE` brings back the original Kokoro voice; `retime.py`
then moves the picture back onto it.

# daywoven: "You're not lazy" (36 seconds)

1080×1920, 30 fps, H.264 + AAC-LC, about −14 LUFS. For Reels, TikTok, Stories and Shorts.

**Who it's for:** people who feel flat and blame themselves for it.
**What it says:** the fixes are small; knowing which one comes first is what daywoven does.
**Ask:** "Link in bio" (on screen).

Built on what makes the reference ad easy to watch:

- **One hero.** A mint orb stays center-frame the whole time and everything happens to it.
- **One calm world.** The same light canvas throughout, with a few floating spheres; no jumping
  between different kinds of screen.
- **A repeating episode.** A short label up top, a character comes in, the number changes, repeat.
  Once viewers learn the pattern they lean in for the next one.
- **Very little text.** The voice tells the story; the screen holds one label and one big number.
- **Physics.** Squash on landing, wobble, inflating, a happy bounce.

It's the flip side of the story ad. There, culprits take points away; here, helpers give them back.
It's voiced by the female voice (`af_heart`), one take per scene, with a natural sound effect on
every movement and no music.

| Seconds | Voice | On screen |
| --- | --- | --- |
| 0–1.95 | You're not lazy. | On mint, "You're not" ticks on, **LAZY.** slams in, its letters hop, and a marker strikes it through. |
| 1.95–6 | You're running on fifty-four. And nobody tells you how to get the rest back. | The orb drops in, squashed and tired, reading 54 ("Running on"). It looks up at a question mark and shrugs. |
| 6–8.5 | Lights out by eleven? Plus twelve. | A sleepy moon floats in and swoops over the orb in sparkles. +12; the orb puffs up to 66. |
| 8.5–11 | Ten minutes of morning light? Plus eight. | A sun rises and glows on it. +8, to 74. |
| 11–13 | A real lunch? Plus seven. | A bowl tips its food into the orb, bite by bite. +7, to 81. |
| 13–16 | Two minutes of breathing at three? Plus five. | A cloud breathes in with the orb, then out. +5, to 86. |
| 16–18 | Eighty-six. Same you. | The orb is round and glossy, eyes wide, smiling; *Same you.* It hops. |
| 18–22.45 | The fixes were never the hard part. Knowing which one comes first is. | All four helpers crowd back in and jostle; "Which one *first?*" The orb looks side to side. |
| 22.45–24.3 | So we built Day woven. | A wipe opens out of the orb; the wordmark drops in over two threads. |
| 24.3–31.75 | Every morning, it reads your sleep, your meals, your movement and your mind, and picks your one thing. One thing. Done. | Sleep, Meals, Movement and Mind pop on their words and thread into the orb; they're drawn in, and one card is left: "Today's one thing: Lights out by 11". A check. |
| 31.75–36 | Less guessing. More you. | On mint: the two lines, the wordmark, **Link in bio**. |

The points are illustrative of how the readiness score responds; they are not claims about any
person. The helpers are the app's own levers: a bedtime, morning light, a real meal, a breathing
reset.

## Making it

```bash
cd marketing/ad-not-lazy-36s
python sfx.py                       # → sfx/*.wav (numpy, soundfile)
python cues.py                      # writes the effect cues into index.html
python voiceover.py                 # → vo/take*.wav and vo/plan.json (kokoro-onnx; see the file)
npm run check                       # lint, layout, motion and contrast checks
npm run render                      # → renders/daywoven-lazy-36s-9x16.mp4 (picture + effects)
./mix.sh                            # → renders/daywoven-lazy-36s-9x16-vo.mp4 (the finished ad)
python ../kinetic-promo-30s/listen.py renders/daywoven-lazy-36s-9x16-vo.mp4
```

The picture is timed to this take's words. If the voice changes, keep the timing with
`retime.py`: run `python retime.py --record` with the current take still in `vo/`, then
`voiceover.py`, `retime.py` and `cues.py` (see `../ad-3pm-31s/README.md`). For the master file,
render losslessly (`--crf 0`), run `./mix.sh`, and re-encode with the command in that README.

## Content rules followed

- No real brand names.
- No medical or diagnostic claims: a readiness number, "your one thing", everyday habits.
- Red is not used.
- Fonts: Inter and Instrument Serif under the SIL Open Font License (`fonts/*-LICENSE.txt`).
  GSAP is bundled under its standard no-charge license.

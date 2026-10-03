# daywoven: "3:07 p.m." (31 seconds)

1080×1920, 30 fps, H.264 + AAC-LC, about −14 LUFS. For Reels, TikTok, Stories and Shorts.

**Who it's for:** 9-to-5 desk workers who crash after lunch.
**What it says:** your 3 p.m. crash is predictable, and daywoven sees it coming at 7 a.m.
**Ask:** send it to the friend who's always tired at 3, then "Link in bio".

It is written to feel like a Reel, not an ad. It opens on a text the viewer has sent
themselves, says the surprising thing in the first two seconds, and keeps a reason to keep
watching ("So I rewound my day", "Then I added this…"). The logo only appears at the end.
It's voiced in the first person by the female voice (`af_heart`), with a natural sound
effect on every movement. There is no music and no musical instrument anywhere in it.

| Seconds | Voice | On screen |
| --- | --- | --- |
| 0–5.35 | Your three PM crash is predictable. I used to think I just needed more coffee. | A chat at 3:07 PM: "why am i SO tired rn", "every. single. day.". **predictable.** slams in. Three coffees land in the chat; Jordan replies "that's coffee #3". |
| 5.35–7 | So I rewound my day. | ◀◀ REWIND: the clock spins back from 3:07 PM to 1:04 AM as the afternoon turns to night. |
| 7–10.94 | Six hours of sleep. No breakfast. Four meetings, back to back. | Morning returns. Each one lands as a card while "today's battery" drains; four meeting blocks drop in and squeeze together. |
| 10.94–14.24 | By nine a.m., the crash was already booked. | Tuesday's calendar: an "Energy crash" event appears at 3 PM and a **BOOKED** stamp comes down on it. |
| 14.24–19.46 | So I built an app that sees it coming at seven, and gives you one thing to do about it. | A 7:02 lock screen. The heads-up buzzes in ("Short night. Your energy will likely dip around 2:30 PM."), opens to one thing ("30 min of daylight before 8."), and gets tapped. |
| 19.46–23.87 | Then I added this: it learns your rhythm, so it gets sharper every week. | "Then I added this…", then the real Sleep screen. Confidence fills from Low to High over three weeks. |
| 23.87–26.6 | Send this to the friend who's always tired at three. | Back in the chat, this video gets sent; Jordan replies "WAIT this is literally me" and reacts. |
| 26.6–31.1 | It's called Day woven. Link in bio. | On mint: "Know your 3 p.m. at 7 a.m.", the wordmark, two threads, and **Link in bio**. |

The heads-up is true to the app: the rhythm model puts the afternoon dip about 7 to 8 hours
after waking (so 2–3 p.m. after a 7:02 wake), and its morning-light window is the first hour
after waking. Confidence starting low and rising is how calibration works. The Sleep screen
is a real capture from `../kinetic-promo-30s/capture-screens.mjs`. "Jordan" and the chat
are illustrative.

## Making it

```bash
cd marketing/ad-3pm-31s
python sfx.py                       # → sfx/*.wav (numpy, soundfile)
python cues.py                      # writes the effect cues into index.html
python voiceover.py                 # → vo/take*.wav and vo/plan.json (kokoro-onnx; see the file)
python retime.py                    # keeps the picture and effects on the new take's words
npm run check                       # lint, layout, motion and contrast checks
npm run render                      # → renders/daywoven-3pm-31s-9x16.mp4 (picture + effects)
./mix.sh                            # → renders/daywoven-3pm-31s-9x16-vo.mp4 (the finished ad)
python ../kinetic-promo-30s/listen.py renders/daywoven-3pm-31s-9x16-vo.mp4
```

For the master file, render losslessly (`--crf 0`), run `./mix.sh`, then re-encode the
picture slowly so it plays everywhere:

```bash
ffmpeg -i renders/daywoven-3pm-31s-9x16-vo.mp4 -map 0:v -c:v libx264 -preset veryslow -tune ssim \
  -crf 1 -profile:v high -pix_fmt yuv420p -map 0:a -c:a copy -movflags +faststart master.mp4
```

The picture is cut to the voice, so if a line changes, re-run `voiceover.py`, read the new
start times it prints, and move that scene's timings and its cues to match. The emoji in the
chat come from the system's Noto Color Emoji font.

## Voice

The voice is the female voice (`af_heart`) at its natural pace. Each scene's lines are read in one
take, so the intonation carries from sentence to sentence like someone talking, and a small, soft
room is added so it sounds spoken in a space rather than generated.

The animation and the cue sheet are written in the seconds of the take they were first cut to
(`design.json` records where each word landed). `retime.py` transcribes the current take, matches
it word for word, and writes `warp.json`, which `index.html` and `cues.py` use to move every tween
and every effect onto its word. After changing the voice, run `python retime.py --record` first
(with the old take still in `vo/`), then `voiceover.py`, `retime.py` and `cues.py`. If the design
take is already recorded, skip `--record`.

## Sound

About 145 effects. As in the story ad, every movement in the hook (the first ten seconds) has
its own sound, matched to what moves, and after that nearly every action does. They're the story ad's natural sounds (pops,
bloops, taps, knocks, ticks, zips, drops), plus three new ones from `sfx.py`:

| Sound | Where |
| --- | --- |
| buzz | the phone vibrating as the heads-up arrives |
| rewind | the tape-like whirr as the clock runs back into last night |
| drain | a short falling hiss each time the day's battery drops |

`mix.sh` levels the voice, ducks the effects about 6 dB under it, and masters to −14 LUFS
with a −1.5 dB safety limiter. The final mix was transcribed back with `listen.py`; every
line comes through.

## Content rules followed

- No real brand names; the messaging app is generic.
- No medical or diagnostic claims: "will likely dip", "heads-up", "confidence".
- Red is not used.
- Fonts: Inter and Instrument Serif under the SIL Open Font License (`fonts/*-LICENSE.txt`).
  GSAP is bundled under its standard no-charge license.

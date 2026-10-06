"""The "not lazy" ad's sound-effect cue sheet. Writes one <audio> tag per cue into index.html, between
the sfx:start and sfx:end markers, so adding or moving an effect is a one-line change here.

    python sfx.py && python cues.py

Each cue is (second, sound, volume). Sounds are the files sfx.py makes in sfx/. Effects that
overlap in time are put on separate tracks automatically.
"""
import json
import re
from pathlib import Path

import soundfile as sf

here = Path(__file__).parent
TOTAL = 36  # the design length; warp.json carries the current one
CUES = [
    # 1 · The hook, a sound on every movement: the spheres bubble up, "You're" and "not" tick on, LAZY
    # slams, its letters hop one after another, a marker strikes it through, and it all drops away.
    (0.02, 'bloop', 0.45), (0.1, 'bloop2', 0.4), (0.18, 'bloop', 0.5), (0.26, 'pop2', 0.4),
    (0.14, 'tick', 0.3), (0.44, 'tick', 0.3), (0.62, 'thud', 1.0), (0.62, 'knock', 0.6),
    *[(round(0.9 + i * 0.04, 2), ('pop', 'pop2')[i % 2], 0.18) for i in range(5)],
    (1.12, 'scribble', 0.6), (1.68, 'puff', 0.2),
    # 2 · The orb drops in tired and lands with a squash; the small spheres pop; it looks up at a
    # question mark that draws itself, the dot plops on, it shrugs.
    (1.95, 'dart', 0.25), (2.37, 'thud', 0.7), (2.37, 'squish', 0.5), (2.49, 'wobble', 0.35),
    *[(round(2.0 + i * 0.07, 2), ('pop', 'pop2')[i % 2], 0.25) for i in range(4)], (2.0, 'tick', 0.3),
    (3.4, 'blink', 0.3), (3.5, 'scribble', 0.5), (4.1, 'bloop2', 0.4), (4.12, 'pop', 0.3),
    (4.9, 'squish', 0.35), (5.02, 'wobble', 0.3), (5.6, 'puff', 0.15), (5.62, 'blink', 0.2),
    # Lights out by 11: the sleepy moon floats in with a yawn, swoops over in sparkles; +12, the count,
    # the orb puffs up and its eyes open a little; the moon flies off.
    (6.0, 'tick', 0.3), (6.1, 'whump', 0.3), (6.4, 'sigh', 0.25), (7.2, 'dart', 0.3),
    (7.3, 'glint', 0.25), (7.38, 'glint', 0.2), (7.46, 'glint', 0.25), (7.54, 'glint', 0.2),
    (7.66, 'pop', 0.45), (7.68, 'count', 0.5), (7.7, 'bloop', 0.5), (7.72, 'wobble', 0.3), (7.75, 'blink', 0.25), (8.05, 'dart', 0.2),
    # Morning light: the sun rises, its rays glint as they turn, it glows on the orb; +8, the count, the
    # orb fills out; the sun sinks away.
    (8.48, 'tick', 0.3), (8.6, 'rise', 0.45), (9.0, 'glint', 0.15), (9.5, 'glint', 0.15), (9.9, 'whump', 0.25), (9.92, 'glint', 0.3),
    (10.3, 'pop', 0.45), (10.32, 'count', 0.45), (10.34, 'bloop2', 0.5), (10.36, 'wobble', 0.3), (10.4, 'blink', 0.2), (10.75, 'dart', 0.2),
    # A real lunch: the bowl slides in and lands, tips, each bite pops into the orb and gets munched; +7.
    (11.04, 'tick', 0.3), (11.1, 'dart', 0.25), (11.4, 'tap', 0.4), (11.65, 'tap', 0.3),
    (12.05, 'pop', 0.3), (12.15, 'pop2', 0.3), (12.25, 'pop', 0.3), (12.35, 'pop2', 0.3), (12.1, 'munch', 0.5), (12.3, 'munch', 0.4), (12.2, 'tap', 0.25),
    (12.3, 'pop', 0.45), (12.32, 'count', 0.45), (12.34, 'bloop', 0.5), (12.36, 'wobble', 0.3), (12.7, 'dart', 0.2),
    # Breathing at three: the cloud drifts in, it and the orb breathe in together and out; +5.
    (13.04, 'tick', 0.3), (13.1, 'whump', 0.3), (13.12, 'puff', 0.2), (13.65, 'breath', 0.6),
    (15.1, 'pop', 0.45), (15.12, 'count', 0.45), (15.14, 'bloop2', 0.45), (15.5, 'dart', 0.2),
    # Eighty-six. Same you: it fills out round with a swell, the number slams, the eyes go wide, a smile,
    # "Same you." lands, and it hops and lands.
    (16.05, 'bloop', 0.6), (16.05, 'wobble', 0.4), (16.05, 'rise', 0.3), (16.08, 'thud', 0.7), (16.08, 'knock', 0.4),
    (16.2, 'blink', 0.4), (16.32, 'pop2', 0.25), (16.86, 'thud', 0.4), (16.95, 'bloop', 0.45), (17.4, 'squish', 0.3),
    # The fixes were never the hard part: the four helpers bounce back in; which one first: they jostle,
    # the orb looks side to side; they fade.
    (18.1, 'pop', 0.35), (18.1, 'bloop2', 0.3), (18.4, 'pop2', 0.35), (18.4, 'bloop', 0.3),
    (18.7, 'pop', 0.35), (18.7, 'bloop2', 0.3), (19.0, 'pop2', 0.35), (19.0, 'bloop', 0.3),
    (20.3, 'tick', 0.3), (20.4, 'patter', 0.35), (21.0, 'patter', 0.35), (20.5, 'blink', 0.2), (20.9, 'blink', 0.2), (21.3, 'blink', 0.2), (22.15, 'puff', 0.2),
    # 3 · The wipe opens out of the orb, each letter of the name lands, the threads weave.
    (22.45, 'whump', 0.4), (22.6, 'tick', 0.3),
    *[(round(23.4 + i * 0.035, 3), ('pop', 'pop2')[i % 2], 0.3) for i in range(8)], (23.55, 'zip', 0.5),
    # 4 · The orb pops back; sleep, meals, movement, mind pop on their words and thread into it; they're
    # drawn in; one card; the check.
    (24.32, 'bloop', 0.5), (24.32, 'pop', 0.4),
    *[x for t in (25.76, 26.56, 27.36, 28.16) for x in ((t, 'bloop2', 0.4), (t, 'pop', 0.35), (round(t + 0.1, 2), 'zip', 0.3))],
    (28.7, 'slurp', 0.35), (28.85, 'dart', 0.2), (29.15, 'pop', 0.45), (29.45, 'tap', 0.4),
    (30.9, 'pop', 0.4), (30.98, 'scribble', 0.45), (31.1, 'bloop2', 0.4),
    # 5 · Less guessing. More you: spheres, the slam, "More you." written on, the name, the pill.
    (31.78, 'bloop', 0.45), (31.85, 'bloop2', 0.4), (31.92, 'bloop', 0.5), (31.99, 'pop2', 0.4),
    (31.84, 'thud', 0.9), (31.84, 'knock', 0.5), (32.7, 'scribble', 0.35), (33.5, 'drop', 0.7), (33.95, 'pop', 0.5), (34.0, 'knock', 0.4),
]

# The cue times above are design seconds; warp.json (from retime.py) maps them onto the current voice.
warp_file = here / 'warp.json'
WARP = json.loads(warp_file.read_text()) if warp_file.exists() else {'total': TOTAL, 'anchors': [[0, 0]]}
TOTAL = WARP['total']


def warp(t, anchors=WARP['anchors']):
    for (a0, b0), (a1, b1) in zip(anchors, anchors[1:]):
        if t <= a1:
            return b0 + (t - a0) * (b1 - b0) / (a1 - a0)
    return anchors[-1][1] + t - anchors[-1][0]


CUES = [(round(warp(at), 3), name, volume) for at, name, volume in CUES]
lengths = {p.stem: round(sf.info(p).duration, 3) for p in (here / 'sfx').glob('*.wav')}
tracks, tags = [], []  # tracks[k] is the second the last cue on track 10+k ends
for i, (at, name, volume) in enumerate(sorted(CUES)):
    length = min(lengths[name], round(TOTAL - at, 3))
    k = next((k for k, end in enumerate(tracks) if end <= at), len(tracks))
    if k == len(tracks):
        tracks.append(0)
    tracks[k] = at + length
    tags.append(f'<audio id="fx{i:03d}" src="sfx/{name}.wav" data-start="{at}" data-duration="{length}" data-volume="{volume}" data-track-index="{10 + k}"></audio>')

page = (here / 'index.html').read_text()
block = '<!-- sfx:start -->\n      ' + '\n      '.join(tags) + '\n      <!-- sfx:end -->'
page, n = re.subn(r'<!-- sfx:start -->.*?<!-- sfx:end -->', lambda m: block, page, flags=re.S)
assert n == 1, 'index.html needs one sfx:start … sfx:end block'
(here / 'index.html').write_text(page)
print(f'{len(tags)} cues on {len(tracks)} tracks')

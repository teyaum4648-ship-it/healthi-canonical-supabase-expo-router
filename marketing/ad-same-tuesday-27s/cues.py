"""The Same Tuesday ad's sound-effect cue sheet. Writes one <audio> tag per cue into index.html, between
the sfx:start and sfx:end markers, so adding or moving an effect is a one-line change here.

    python sfx.py && python cues.py

Each cue is (second, sound, volume). Sounds are the files sfx.py makes in sfx/. Effects that
overlap in time are put on separate tracks automatically.
"""
import re
from pathlib import Path

import soundfile as sf

here = Path(__file__).parent
CUES = [
    # 1 · Both asleep: the phones buzz, a soft snore, the captions pop on the seam, both wake with a hop.
    (0.0, 'breath', 0.2), (0.1, 'buzz', 0.6), (0.24, 'pop', 0.4), (1.28, 'pop2', 0.4),
    (1.33, 'bloop', 0.4), (1.36, 'bloop2', 0.35), (1.35, 'blink', 0.45), (2.4, 'pop', 0.4), (3.3, 'glint', 0.3), (3.3, 'tick', 0.25),
    # Up top: snooze (the card lands, the blob flops), three coffees, no lunch, the battery draining.
    (4.85, 'whump', 0.3), (5.55, 'dart', 0.3), (5.75, 'knock', 0.45), (5.62, 'squish', 0.45), (5.6, 'count', 0.35),
    (6.15, 'tap', 0.45), (6.35, 'tap', 0.45), (6.55, 'tap', 0.5), (6.15, 'count', 0.3), (6.25, 'tick', 0.2), (6.65, 'tick', 0.2),
    (6.86, 'dart', 0.3), (7.05, 'knock', 0.4), (7.08, 'tap', 0.3), (6.88, 'count', 0.3), (7.0, 'drain', 0.45),
    # Down here: the heads-up at 7:00 (buzz, drop), a glance, it tucks away as a badge.
    (7.72, 'whump', 0.35), (8.4, 'pop', 0.4), (9.05, 'count', 0.3), (9.12, 'buzz', 0.6), (9.2, 'drop', 0.6), (9.55, 'blink', 0.35),
    (10.32, 'puff', 0.15), (10.4, 'pop2', 0.4),
    # Daylight, lunch, last coffee: each chip slides in and lands, the sun comes up, each gets checked.
    (10.48, 'dart', 0.25), (10.65, 'tap', 0.35), (10.5, 'rise', 0.4), (10.5, 'count', 0.3), (10.85, 'scribble', 0.35), (11.1, 'pop', 0.3), (10.9, 'bloop2', 0.3),
    (11.74, 'dart', 0.25), (11.9, 'tap', 0.35), (11.76, 'count', 0.3), (12.15, 'scribble', 0.35), (12.4, 'pop', 0.3),
    (12.94, 'dart', 0.25), (13.1, 'tap', 0.35), (12.96, 'count', 0.3), (13.4, 'scribble', 0.35), (13.65, 'pop', 0.3),
    # 3 p.m.: both clocks land together. Top melts and sighs, bottom hops.
    (14.6, 'whump', 0.4), (14.62, 'count', 0.45), (14.64, 'thud', 0.9), (14.64, 'knock', 0.6), (14.92, 'pop', 0.4),
    (14.95, 'squish', 0.6), (15.05, 'ooze', 0.5), (15.0, 'drain', 0.5), (15.0, 'bloop', 0.5), (15.2, 'glint', 0.25), (15.55, 'sigh', 0.8),
    # Same job. Same sleep. Completely different day: the top goes grey, the bottom bounces.
    (16.24, 'pop', 0.4), (17.2, 'pop2', 0.4), (18.16, 'pop', 0.45), (18.16, 'thud', 0.6), (18.2, 'whump', 0.3), (18.75, 'wobble', 0.35),
    # 2 · The heads-up rises with its blob, the name slams, a blink, the real app, then the dots and the curve fitting them.
    (19.6, 'whump', 0.4), (19.65, 'dart', 0.3), (19.95, 'tap', 0.35), (19.7, 'tick', 0.3), (19.78, 'squish', 0.4), (20.0, 'bloop', 0.45), (20.95, 'blink', 0.35), (21.42, 'dart', 0.25), (20.62, 'thud', 0.8), (20.62, 'knock', 0.5),
    (21.5, 'puff', 0.15), (21.6, 'whump', 0.45), (21.95, 'tap', 0.35), (21.68, 'tick', 0.3), (22.0, 'rise', 0.2),
    (22.05, 'dart', 0.25), (22.35, 'tap', 0.3), (22.3, 'zip', 0.35),
    *[(round(22.4 + i * 0.07, 2), ('pop', 'pop2')[i % 2], 0.25) for i in range(8)],
    (22.88, 'thud', 0.6), (22.88, 'knock', 0.4), (23.25, 'zip', 0.45), (23.25, 'scribble', 0.3), (23.3, 'blink', 0.3),
    # 3 · End card: spheres, the line, each letter, the threads, the pill, a tap.
    (25.02, 'bloop', 0.45), (25.09, 'bloop2', 0.4), (25.16, 'bloop', 0.5), (25.23, 'pop2', 0.4), (25.05, 'tick', 0.3),
    *[(round(25.42 + i * 0.035, 3), ('pop', 'pop2')[i % 2], 0.3) for i in range(8)],
    (25.6, 'zip', 0.5), (25.95, 'pop', 0.5), (26.0, 'knock', 0.5), (26.7, 'pop', 0.35), (26.75, 'knock', 0.6), (26.85, 'drip', 0.35),
]

lengths = {p.stem: round(sf.info(p).duration, 3) for p in (here / 'sfx').glob('*.wav')}
tracks, tags = [], []  # tracks[k] is the second the last cue on track 10+k ends
for i, (at, name, volume) in enumerate(sorted(CUES)):
    length = min(lengths[name], round(27.5 - at, 3))
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

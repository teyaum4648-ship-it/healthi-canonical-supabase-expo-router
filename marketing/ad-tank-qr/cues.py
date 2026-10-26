"""The tank ad's sound-effect cue sheet. Writes one <audio> tag per cue into index.html, between
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
TOTAL = 50.6
CUES = [
    # 1 · The tank rolls in on its treads; the code is stamped onto the hull.
    (0.1, 'rumble', 0.7), (1.0, 'rumble', 0.45), (0.32, 'tick', 0.25), (2.4, 'thud', 1.0), (2.4, 'knock', 0.7), (2.68, 'tap', 0.5), (3.4, 'pop', 0.3),
    # 2 · A drone drops in and hovers; the brackets lock on and flicker.
    (4.56, 'tick', 0.25), (5.5, 'air', 0.5), (5.5, 'rotor', 0.55), (7.3, 'rotor', 0.45), (9.1, 'rotor', 0.4), (10.9, 'rotor', 0.4), (12.7, 'rotor', 0.35), (14.5, 'rotor', 0.3),
    (5.76, 'thud', 0.8), (5.76, 'knock', 0.5), (6.72, 'blink', 0.5), (6.72, 'whump', 0.35),
    *[(round(7.05 + k * 0.24, 2), 'blink', 0.3) for k in range(3)],
    # 3 · The scan passes over the code, it locks, and the page opens and loads.
    (8.56, 'tick', 0.25), (11.2, 'scan', 0.9), (11.2, 'tick', 0.25), (12.4, 'glint', 0.5), (12.4, 'zip', 0.4), (12.56, 'tick', 0.25),
    (13.6, 'whump', 0.5), (13.6, 'swish', 0.4),
    *[(round(14.12 + k * 0.11, 2), 'tap', 0.18) for k in range(8)],
    (15.0, 'count', 0.35), (15.35, 'pop', 0.45), (15.35, 'drop', 0.4),
    # 4 · The tired drone: it droops, the stats pop up, and it dozes.
    (16.15, 'rotor', 0.3), (17.95, 'rotor', 0.25), (16.18, 'whump', 0.35), (17.2, 'sigh', 0.7), (17.2, 'blink', 0.3),
    (18.32, 'thud', 0.6), (18.32, 'pop', 0.45), (18.9, 'pop2', 0.45), (19.6, 'tick', 0.2),
    # 5 · The phone slides in; each part of your day pops on, flies into the score, and the number lands.
    (20.3, 'whump', 0.5), (20.3, 'swish', 0.35), (21.68, 'pop', 0.45), (21.68, 'bloop', 0.3), (22.56, 'pop2', 0.45), (22.56, 'bloop2', 0.3),
    (23.36, 'pop', 0.45), (23.36, 'bloop', 0.3), (24.56, 'pop2', 0.45), (24.56, 'bloop2', 0.3), (25.4, 'air', 0.5), (25.2, 'tick', 0.2), (26.24, 'thud', 0.8), (26.24, 'knock', 0.4),
    # 6 · Energy peaks, then the crash, then the heads-up buzzes in.
    (27.8, 'whump', 0.45), (27.8, 'swish', 0.3), (28.8, 'thud', 0.7), (29.85, 'swish', 0.35), (30.64, 'thud', 0.8), (30.64, 'drain', 0.45), (31.2, 'buzz', 0.6), (31.25, 'pop', 0.35),
    # 7 · The food search, and the scores zooming in.
    (32.5, 'whump', 0.45), (32.5, 'swish', 0.3), (32.64, 'tap', 0.35), (34.0, 'tick', 0.25), (34.64, 'zip', 0.45), (34.64, 'pop', 0.35), (35.2, 'tick', 0.2),
    # 8 · Breathing: the orb fills and empties.
    (36.6, 'rise', 0.35), (38.4, 'breath', 0.7), (38.4, 'thud', 0.5), (39.95, 'puff', 0.35),
    # 9 · Confidence fills week by week.
    (40.85, 'whump', 0.45), (40.96, 'tick', 0.2), (41.4, 'count', 0.4), (41.4, 'tap', 0.4), (42.4, 'count', 0.4), (42.4, 'tap', 0.4), (43.04, 'thud', 0.6), (43.68, 'count', 0.4), (43.68, 'tap', 0.45), (43.7, 'glint', 0.35),
    # 10 · The calm drone floats down, the address lands, the code pops in.
    (44.75, 'air', 0.5), (44.75, 'rotor', 0.3), (46.55, 'rotor', 0.25), (48.35, 'rotor', 0.22), (44.96, 'thud', 0.9), (44.96, 'knock', 0.5), (45.6, 'drop', 0.5), (45.9, 'pop', 0.5), (45.9, 'bloop', 0.35), (47.36, 'tick', 0.2),
]

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

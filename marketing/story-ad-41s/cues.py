"""The story ad's sound-effect cue sheet. Writes one <audio> tag per cue into index.html, between
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
    # 1 · Hook: card in, knocked away, LYING slams and glitches.
    (0.22, 'swish', 0.5), (0.32, 'swish', 0.6), (0.7, 'tap', 0.4), (1.28, 'air', 0.7),
    (1.52, 'thud', 1.0), (1.52, 'knock', 0.7), (1.62, 'tick', 0.5), (1.68, 'tick', 0.45), (1.74, 'tick', 0.4),
    (1.86, 'swish', 0.45),
    # 2 · The orb, the melt, the sigh, the question.
    (2.45, 'swish', 0.4), (2.6, 'tick', 0.3), (3.42, 'bloop', 0.8), (3.42, 'pop', 0.6), (3.95, 'swish', 0.35),
    (4.45, 'swish', 0.3), (4.6, 'tick', 0.3), (5.0, 'countlong', 0.5), (5.05, 'bloop', 0.7), (5.2, 'squish', 0.7),
    (5.45, 'bloop', 0.6), (5.7, 'drip', 0.5), (5.85, 'bloop', 0.6), (5.94, 'drip', 0.45), (6.18, 'drip', 0.45),
    (6.1, 'pop', 0.5), (6.42, 'drip', 0.4), (6.45, 'sigh', 0.8), (6.66, 'drip', 0.4), (6.95, 'tick', 0.35),
    (7.2, 'swish', 0.3), (7.35, 'tick', 0.3), (7.45, 'pop', 0.35), (7.6, 'scribble', 0.6), (7.65, 'bloop', 0.6),
    (8.12, 'drop', 0.5),
    # 3 · The culprits.
    (8.88, 'bloop', 0.7), (8.88, 'pop', 0.5), (8.95, 'swish', 0.35), (9.0, 'tick', 0.3),
    (9.15, 'air', 0.5), (9.62, 'pop', 0.4), (9.88, 'bite', 1.0), (9.95, 'count', 0.55), (10.0, 'pop', 0.4),
    (10.25, 'munch', 0.6), (10.45, 'munch', 0.55), (10.55, 'swish', 0.4), (10.65, 'swish', 0.3), (10.85, 'tick', 0.3),
    (11.43, 'knock', 0.8), (11.63, 'knock', 0.8), (11.83, 'knock', 0.8), (12.0, 'thud', 0.9), (12.03, 'knock', 0.9),
    (12.1, 'count', 0.55), (12.15, 'pop', 0.4), (12.2, 'squish', 0.6), (12.35, 'air', 0.5), (12.8, 'swish', 0.3),
    (13.0, 'tick', 0.3), (13.5, 'fire', 0.7), (14.2, 'fire', 0.9), (14.32, 'sizzle', 0.8), (14.35, 'count', 0.5),
    (14.4, 'pop', 0.4), (14.85, 'swish', 0.4), (15.0, 'swish', 0.3), (15.2, 'tick', 0.3), (15.7, 'tap', 0.6),
    (15.95, 'swish', 0.35), (16.38, 'drop', 0.8), (16.4, 'munch', 0.4), (16.42, 'count', 0.45), (16.45, 'pop', 0.4),
    (16.75, 'pop', 0.6),
    # 4 · 3 p.m.
    (17.15, 'air', 0.5), (17.25, 'tick', 0.3), (17.3, 'pop', 0.5), (17.4, 'countlong', 0.6),
    (17.4, 'tick', 0.6), (17.65, 'tick', 0.55), (17.9, 'tick', 0.5), (18.15, 'tick', 0.45), (18.62, 'thud', 0.7),
    # 5 · Six apps open.
    (19.62, 'swish', 0.45), (19.66, 'thud', 0.9), (19.69, 'swish', 0.4), (19.76, 'swish', 0.4),
    (19.86, 'pop', 0.4), (19.9, 'swish', 0.4), (19.9, 'pop', 0.4), (19.94, 'pop', 0.45), (19.97, 'swish', 0.4),
    (20.04, 'swish', 0.4), (20.45, 'swish', 0.45), (21.38, 'air', 0.6), (21.45, 'pop', 0.4),
    # 6 · So we built daywoven: a pop as each letter lands.
    (21.6, 'air', 0.5), (21.75, 'tick', 0.3),
    *[(round(22.23 + i * 0.035, 3), 'pop', 0.35) for i in range(8)],
    (22.4, 'swish', 0.45),
    # 7 · Woven into one number.
    (23.68, 'bloop', 0.45), (23.68, 'pop', 0.35), (24.3, 'bloop', 0.45), (24.3, 'pop', 0.35),
    (24.78, 'bloop', 0.45), (24.78, 'pop', 0.35), (25.42, 'bloop', 0.45), (25.42, 'pop', 0.35),
    (25.95, 'air', 0.4), (25.95, 'swish', 0.4), (26.15, 'pop', 0.45),
    (26.2, 'tick', 0.45), (26.3, 'tick', 0.45), (26.4, 'tick', 0.45), (26.5, 'tick', 0.45),
    (26.25, 'countlong', 0.5), (27.3, 'swish', 0.3), (27.4, 'pop', 0.45), (27.45, 'scribble', 0.7),
    # 8 · It taps you on the shoulder; one tap; settled.
    (28.7, 'swish', 0.35), (28.82, 'tick', 0.3), (29.05, 'pop', 0.35), (29.25, 'rise', 0.45),
    (30.3, 'swish', 0.3), (30.45, 'tick', 0.3), (30.5, 'air', 0.45), (30.6, 'bloop', 0.5), (30.85, 'tick', 0.3),
    (30.98, 'knock', 0.9), (31.3, 'knock', 0.9), (31.45, 'drop', 0.7), (31.45, 'swish', 0.35), (32.2, 'air', 0.4),
    (32.42, 'tick', 0.3), (32.7, 'pop', 0.35), (32.78, 'knock', 0.7), (32.98, 'swish', 0.4), (33.0, 'breath', 0.8),
    (33.3, 'scribble', 0.5), (33.32, 'drop', 0.6),
    # 9 · Every morning.
    (34.35, 'swish', 0.35), (34.38, 'rise', 0.55), (34.5, 'tick', 0.3), (35.05, 'tap', 0.5), (35.2, 'steam', 0.6),
    (35.3, 'swish', 0.3), (35.55, 'air', 0.4), (36.1, 'drop', 0.6), (36.2, 'tick', 0.3),
    # 10 · Fewer apps. Better days.
    (37.75, 'air', 0.4), (37.78, 'swish', 0.35), (37.88, 'thud', 0.9), (38.8, 'swish', 0.5), (39.4, 'rise', 0.6),
    (39.7, 'drop', 0.8),
]

lengths = {p.stem: round(sf.info(p).duration, 3) for p in (here / 'sfx').glob('*.wav')}
tracks, tags = [], []  # tracks[k] is the second the last cue on track 10+k ends
for i, (at, name, volume) in enumerate(sorted(CUES)):
    length = min(lengths[name], round(41 - at, 3))
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

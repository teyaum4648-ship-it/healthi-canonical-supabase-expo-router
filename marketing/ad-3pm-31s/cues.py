"""The 3:07 p.m. ad's sound-effect cue sheet. Writes one <audio> tag per cue into index.html, between
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
    # 1 · The hook: every movement has its own sound. Each message pops, the captions tick on and slam, three coffees pop in, land and steam,
    # Jordan types and replies, and the chat falls back as the rewind starts.
    (0.08, 'tick', 0.25), (0.1, 'bloop2', 0.5), (0.1, 'pop', 0.4), (0.3, 'tick', 0.3), (0.8, 'pop2', 0.45), (0.8, 'bloop', 0.35), (1.76, 'thud', 0.9), (1.76, 'knock', 0.6), (2.95, 'puff', 0.15), (3.15, 'tick', 0.3),
    (3.7, 'pop', 0.3), (3.8, 'tap', 0.45), (3.9, 'steam', 0.3), (4.3, 'pop2', 0.3), (4.4, 'tap', 0.45), (4.52, 'steam', 0.22), (5.14, 'steam', 0.15),
    (4.42, 'blink', 0.3), (4.55, 'tick', 0.15), (4.65, 'tick', 0.15), (4.75, 'tick', 0.15),
    (4.95, 'pop', 0.3), (4.98, 'thud', 0.7), (4.98, 'knock', 0.5), (5.05, 'tap', 0.5),
    (5.12, 'pop', 0.45), (5.12, 'bloop2', 0.35), (5.55, 'whump', 0.4),
    # 2 · Rewind into last night (whirr, the night falling, REWIND flickering, the clock glitching and
    # rattling back, the stars), then forward: each card
    # slides in and lands, the battery drains, the plate spins and rattles to a stop, the meetings drop and squeeze, the
    # calendar lands, the crash appears, and the stamp comes down.
    (5.75, 'pop', 0.4), (5.95, 'glitch', 0.35), (6.05, 'rewind', 0.7), (6.05, 'countlong', 0.45),
    (6.08, 'whump', 0.3), (6.15, 'static', 0.22), (6.45, 'static', 0.22), (6.75, 'static', 0.22), (7.0, 'static', 0.2),
    (6.1, 'blink', 0.12), (6.34, 'blink', 0.12), (6.58, 'blink', 0.12), (6.82, 'blink', 0.12),
    (6.45, 'glint', 0.2), (6.7, 'glint', 0.25), (6.95, 'glint', 0.2),
    (7.35, 'whump', 0.4), (7.42, 'count', 0.45), (7.45, 'rise', 0.35), (7.55, 'pop2', 0.25),
    (7.62, 'dart', 0.3), (7.85, 'tap', 0.4), (7.95, 'drain', 0.4),
    (8.6, 'count', 0.35), (8.66, 'dart', 0.3), (8.72, 'count', 0.25), (8.75, 'tap', 0.5), (8.95, 'tap', 0.3), (8.95, 'drain', 0.4),
    (9.55, 'count', 0.35), (9.58, 'dart', 0.3), (9.8, 'tap', 0.35),
    (9.84, 'knock', 0.6), (10.04, 'knock', 0.6), (10.24, 'knock', 0.6), (10.44, 'knock', 0.6),
    (10.6, 'thud', 0.6), (10.62, 'squish', 0.3), (10.6, 'drain', 0.5),
    (11.38, 'puff', 0.2), (11.6, 'whump', 0.4), (11.6, 'tick', 0.3), (11.95, 'tap', 0.35),
    (12.82, 'pop', 0.45), (12.84, 'zip', 0.3), (13.4, 'tick', 0.3),
    (13.86, 'thud', 1.0), (13.86, 'knock', 0.8), (13.86, 'flick', 0.6),
    # 3 · 7:02 a.m.: the lock screen, the captions, the phone buzzing as the heads-up drops in, the card
    # opening to one thing, and the tap on Got it.
    (14.4, 'whump', 0.45), (14.42, 'tick', 0.3), (14.45, 'pop', 0.45), (14.7, 'tick', 0.3),
    (15.76, 'thud', 0.8), (15.76, 'knock', 0.5),
    (16.5, 'buzz', 0.7), (16.55, 'drop', 0.6), (16.8, 'tap', 0.3),
    (17.15, 'puff', 0.15), (17.25, 'tick', 0.3), (17.7, 'zip', 0.35), (17.84, 'thud', 0.7), (17.84, 'knock', 0.4), (17.95, 'pop', 0.35),
    (18.55, 'pop', 0.4), (18.62, 'knock', 0.6), (18.74, 'drip', 0.4), (18.74, 'blink', 0.3),
    # 4 · "Then I added this…": each word pops, they fly off, the phone rises, the screen punches in,
    # and each week's bar fills as the confidence steps up.
    (19.5, 'pop', 0.35), (19.62, 'pop2', 0.35), (19.74, 'pop', 0.35), (19.86, 'bloop', 0.5),
    (20.65, 'dart', 0.35), (20.7, 'whump', 0.5), (21.05, 'tap', 0.35), (20.9, 'tick', 0.3), (21.2, 'rise', 0.25),
    (21.3, 'dart', 0.25), (21.55, 'tap', 0.3), (21.6, 'zip', 0.35),
    (22.42, 'zip', 0.35), (22.44, 'blink', 0.3), (22.45, 'tick', 0.3), (22.98, 'zip', 0.4), (23.02, 'pop', 0.4),
    # 5 · The chat again: the video goes out, Jordan types, replies, and reacts.
    (23.95, 'whump', 0.35), (24.05, 'tick', 0.3), (24.15, 'dart', 0.4), (24.35, 'pop', 0.45),
    (24.85, 'blink', 0.3), (24.98, 'tick', 0.15), (25.08, 'tick', 0.15), (25.18, 'tick', 0.15),
    (25.3, 'thud', 0.7), (25.3, 'knock', 0.4), (25.58, 'pop', 0.45), (25.58, 'bloop2', 0.35), (26.15, 'pop2', 0.45), (26.15, 'bloop', 0.3),
    # 6 · The end card: spheres bubble up, the line ticks on, each letter of the name lands, the threads
    # weave, the pill pops, and a tap on it.
    (27.04, 'bloop', 0.45), (27.12, 'bloop2', 0.4), (27.2, 'bloop', 0.5), (27.28, 'pop2', 0.4), (27.1, 'tick', 0.3),
    *[(round(27.62 + i * 0.04, 2), ('pop', 'pop2')[i % 2], 0.3) for i in range(8)],
    (27.95, 'zip', 0.5), (28.45, 'pop', 0.5), (28.5, 'knock', 0.5),
    (29.35, 'pop', 0.35), (29.4, 'knock', 0.6), (29.52, 'drip', 0.35),
]

lengths = {p.stem: round(sf.info(p).duration, 3) for p in (here / 'sfx').glob('*.wav')}
tracks, tags = [], []  # tracks[k] is the second the last cue on track 10+k ends
for i, (at, name, volume) in enumerate(sorted(CUES)):
    length = min(lengths[name], round(31 - at, 3))
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

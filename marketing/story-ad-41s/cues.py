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
    # 1 · Hook. Every movement in the first ten seconds has its own sound. The spheres bubble up; the
    # card lifts in, counts up, draws its chart and its tags land; it is flicked away; LYING slams (the
    # spheres flinch and wobble back), glitches and settles, and glitches once more before the cut.
    (0.04, 'bloop', 0.5), (0.13, 'bloop2', 0.42), (0.22, 'bloop', 0.55), (0.31, 'pop2', 0.45),
    (0.22, 'tick', 0.35), (0.32, 'whump', 0.55), (0.34, 'count', 0.5), (0.5, 'zip', 0.4), (0.7, 'tap', 0.45),
    (0.82, 'pop', 0.4), (0.92, 'tap', 0.35), (1.0, 'tap', 0.32),
    (1.27, 'flick', 0.6), (1.28, 'air', 0.6),
    (1.52, 'thud', 1.0), (1.52, 'knock', 0.7), (1.58, 'wobble', 0.3),
    (1.62, 'glitch', 0.55), (1.62, 'static', 0.3), (1.88, 'tick', 0.3), (2.18, 'glitch', 0.4),
    # 2 · The small spheres pop up; the orb lands and wobbles; text whisks off with a breath; the melt
    # (goo bubbles, each drip landing, the puddle oozing out, the number rattling down); the eyes open;
    # the sigh; a blink; a glance up; the puddle slurps up into the question and its dot plops on.
    (2.52, 'pop', 0.35), (2.6, 'pop2', 0.3), (2.68, 'pop', 0.35), (2.76, 'pop2', 0.3),
    (2.6, 'tick', 0.3), (3.4, 'whump', 0.45), (3.42, 'bloop', 0.85), (3.42, 'pop', 0.6), (3.6, 'wobble', 0.35),
    (3.98, 'tick', 0.3), (4.45, 'puff', 0.2), (4.6, 'tick', 0.3),
    (4.95, 'squish', 0.4), (5.0, 'countlong', 0.55), (5.05, 'bloop', 0.7), (5.2, 'squish', 0.7), (5.25, 'bloop2', 0.4),
    (5.3, 'ooze', 0.5), (5.45, 'bloop', 0.6), (5.65, 'bloop2', 0.35), (5.85, 'bloop', 0.55),
    (5.7, 'drip', 0.5), (5.94, 'drip', 0.45), (6.18, 'drip', 0.45), (6.42, 'drip', 0.4), (6.66, 'drip', 0.4),
    (6.1, 'pop', 0.5), (6.1, 'blink', 0.35), (6.45, 'sigh', 0.8), (6.95, 'blink', 0.45), (7.04, 'blink', 0.35),
    (7.2, 'puff', 0.2), (7.35, 'tick', 0.3), (7.45, 'blink', 0.35), (7.6, 'scribble', 0.6), (7.6, 'slurp', 0.5),
    (8.1, 'bloop2', 0.45), (8.12, 'drop', 0.5),
    # 3 · The culprits: the mouth opens wet and chomps on each close; the flame crackles as it flickers;
    # the orb wobbles back; the glass sloshes as it tips; the badge pulses.
    (8.86, 'whump', 0.4), (8.88, 'bloop', 0.7), (8.88, 'pop', 0.5), (8.95, 'pop', 0.35), (9.0, 'tick', 0.3),
    (9.15, 'patter', 0.6), (9.62, 'smack', 0.5), (9.7, 'dart', 0.4), (9.88, 'bite', 1.0), (9.95, 'count', 0.55), (10.0, 'pop', 0.4),
    (10.25, 'smack', 0.35), (10.34, 'munch', 0.6), (10.45, 'smack', 0.3), (10.54, 'munch', 0.55), (10.55, 'patter', 0.55), (10.85, 'tick', 0.3),
    (11.43, 'knock', 0.8), (11.63, 'knock', 0.8), (11.83, 'knock', 0.8), (12.0, 'thud', 0.9), (12.03, 'knock', 0.9),
    (12.1, 'count', 0.55), (12.15, 'pop', 0.4), (12.2, 'wobble', 0.55), (12.35, 'air', 0.35),
    (13.0, 'tick', 0.3), (13.5, 'fire', 0.7),
    *[(t, 'crackle', v) for t, v in ((13.9, 0.35), (14.02, 0.25), (14.14, 0.3), (14.5, 0.3), (14.62, 0.25), (14.74, 0.3))], (14.2, 'fire', 0.9), (14.32, 'sizzle', 0.8), (14.35, 'count', 0.5),
    (14.4, 'pop', 0.4), (14.85, 'puff', 0.7), (15.2, 'tick', 0.3), (15.7, 'tap', 0.6),
    (15.95, 'slosh', 0.45), (16.38, 'drop', 0.8), (16.4, 'munch', 0.4), (16.42, 'count', 0.45), (16.45, 'pop', 0.4),
    (16.75, 'pop', 0.6), (16.93, 'thud', 0.3),
    # 4 · 3 p.m., with a glint as each star twinkles.
    (17.25, 'tick', 0.3), (17.3, 'pop', 0.5), (17.4, 'countlong', 0.6),
    (17.4, 'tick', 0.6), (17.65, 'tick', 0.55), (17.9, 'tick', 0.5), (18.15, 'tick', 0.45), (18.62, 'thud', 0.7),
    *[(t, 'glint', v) for t, v in ((17.75, 0.25), (18.05, 0.2), (18.35, 0.25), (18.95, 0.2), (19.25, 0.25))],
    # 5 · Six apps open: one rush per group of chips, a small tap as each lands.
    (19.62, 'air', 0.5), (19.66, 'thud', 0.9), (19.9, 'air', 0.45),
    *[(round(t + 0.3, 2), 'tap', 0.3) for t in (19.62, 19.69, 19.76, 19.9, 19.97, 20.04)],
    (19.86, 'pop', 0.4), (19.9, 'pop', 0.4), (19.94, 'pop', 0.45), (20.47, 'pop', 0.4), (21.38, 'air', 0.6), (21.45, 'pop', 0.4),
    # 6 · So we built daywoven: a pop as each letter lands, a zip as the threads weave.
    (21.75, 'tick', 0.3),
    *[(round(22.23 + i * 0.035, 3), 'pop', 0.35) for i in range(8)],
    (22.4, 'zip', 0.55),
    # 7 · Woven into one number.
    (23.68, 'bloop', 0.45), (23.68, 'pop', 0.35), (24.3, 'bloop', 0.45), (24.3, 'pop', 0.35),
    (24.78, 'bloop', 0.45), (24.78, 'pop', 0.35), (25.42, 'bloop', 0.45), (25.42, 'pop', 0.35),
    (25.95, 'zip', 0.55), (26.15, 'pop', 0.45),
    (26.2, 'tick', 0.45), (26.3, 'tick', 0.45), (26.4, 'tick', 0.45), (26.5, 'tick', 0.45),
    (26.25, 'countlong', 0.5), (27.4, 'pop', 0.45), (27.45, 'scribble', 0.7),
    # 8 · It taps you on the shoulder; one tap; settled.
    (28.82, 'tick', 0.3), (29.05, 'pop', 0.35), (29.25, 'countlong', 0.45),
    (30.45, 'tick', 0.3), (30.5, 'squish', 0.45), (30.6, 'bloop', 0.5), (30.85, 'tick', 0.3),
    (30.98, 'knock', 0.9), (31.3, 'knock', 0.9), (31.45, 'drop', 0.7), (32.2, 'squish', 0.3),
    (32.42, 'tick', 0.3), (32.7, 'pop', 0.35), (32.78, 'knock', 0.7), (32.9, 'drip', 0.35), (32.98, 'pop', 0.4), (33.0, 'breath', 0.8),
    (33.3, 'scribble', 0.5), (33.32, 'drop', 0.6),
    # 9 · Every morning.
    (34.38, 'rise', 0.55), (34.5, 'tick', 0.3), (35.05, 'tap', 0.5), (35.2, 'steam', 0.6),
    (35.3, 'tick', 0.3), (35.95, 'tap', 0.4), (36.1, 'drop', 0.6), (36.2, 'tick', 0.3),
    # 10 · Fewer apps. Better days. The stars glint.
    (37.88, 'thud', 0.9), (38.8, 'scribble', 0.4), (39.4, 'rise', 0.6), (39.7, 'drop', 0.8),
    *[(t, 'glint', v) for t, v in ((38.45, 0.2), (38.69, 0.25), (38.93, 0.2), (39.97, 0.2), (40.21, 0.25), (40.45, 0.2))],
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

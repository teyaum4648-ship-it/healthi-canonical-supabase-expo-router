"""Voices the Same Tuesday ad with Kokoro at full precision. The picture is cut to this voice, so each
line starts a set gap after the previous one ends, and plan.json records where every line lands.

    pip install kokoro-onnx soundfile numpy
    # model files, from github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0:
    #   kokoro-v1.0.onnx (full precision) and voices-v1.0.bin, in KOKORO_DIR
    python voiceover.py                 # → vo/line00.wav … and vo/plan.json

"Day woven" is spelled apart so the voice says the name cleanly; numbers are spelled out so
they are read as numbers, not digits.
"""
import json
import os
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

here = Path(__file__).parent
models = Path(os.environ.get('KOKORO_DIR', here / 'voices'))
VOICE, SPEED, FIRST = 'af_heart', 1.04, 0.25

# (pause before the line in seconds, text). Longer pauses mark a change of scene.
LINES = [
    (0.0, 'Same person. Same Tuesday.'),
    (0.3, 'Watch what happens at three p.m.'),
    (0.5, 'Up top: snooze, three coffees, no lunch.'),
    (0.4, 'Down here: one heads-up at seven a.m.'),
    (0.3, 'Daylight before nine. Lunch before one. Last coffee by two.'),
    (0.5, 'Three p.m.'),
    (0.6, 'Same job. Same sleep. Completely different day.'),
    (0.5, 'That heads-up is Day woven.'),
    (0.35, 'It learns your rhythm, so every week it fits you a little better.'),
    (0.4, 'Link in bio.'),
]


def trimmed(samples, rate):
    """Trims only true silence: keeps the breath before the first word, lets the last decay."""
    start = next((i for i, x in enumerate(samples) if abs(x) > 0.004), 0)
    end = next((i for i in range(len(samples) - 1, -1, -1) if abs(samples[i]) > 0.002), len(samples) - 1)
    out = samples[max(0, start - int(rate * 0.08)): min(len(samples), end + int(rate * 0.06))].copy()
    for edge, ms in ((slice(None), 30), (slice(None, None, -1), 80)):
        n = min(int(rate * ms / 1000), len(out))
        view = out[edge]
        view[:n] *= (1 - np.cos(np.linspace(0, np.pi, n))) / 2
    return out


kokoro = Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'))
out = here / 'vo'
out.mkdir(exist_ok=True)
plan, at = [], FIRST
for index, (pause, text) in enumerate(LINES):
    samples, rate = kokoro.create(text, voice=VOICE, speed=SPEED, lang='en-us')
    samples = trimmed(samples, rate)
    path = out / f'line{index:02d}.wav'
    sf.write(path, samples, rate, subtype='PCM_24')
    at += pause
    seconds = round(len(samples) / rate, 3)
    plan.append({'file': str(path), 'start': round(at, 3), 'seconds': seconds, 'text': text})
    at += seconds
(out / 'plan.json').write_text(json.dumps(plan, indent=1))
for row in plan:
    print(f"{row['start']:>7.2f}s  {row['seconds']:>5.2f}s  {row['text']}")
print(f'voice ends at {at:.2f}s')

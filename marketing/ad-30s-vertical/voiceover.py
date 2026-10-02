"""Voices each line of the ad script with Kokoro and reports how long each one runs.

    pip install kokoro-onnx soundfile
    # model files, from github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0:
    #   kokoro-v1.0.int8.onnx and voices-v1.0.bin, in KOKORO_DIR (default: ./voices)
    python voiceover.py af_heart        # or am_michael, bf_emma, ... ; optional speed: 1.05
"""
import json
import os
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

here = Path(__file__).parent
models = Path(os.environ.get('KOKORO_DIR', here / 'voices'))

# (start second, text). "Day woven" is spelled apart so the voice says the name cleanly.
LINES = [
    (0.5, "Your day isn't one number."),
    (2.5, "It's sleep, food, movement, and mind."),
    (5.3, "Day woven weaves them together, into one picture of your day."),
    (11.8, "Search any food."),
    (15.5, "Tap the score, and see exactly why."),
    (20.4, "Know when your energy peaks, and plan around it."),
    (26.5, "Day woven. Your whole day, woven together."),
]

voice = sys.argv[1] if len(sys.argv) > 1 else 'af_heart'
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
kokoro = Kokoro(str(models / 'kokoro-v1.0.int8.onnx'), str(models / 'voices-v1.0.bin'))
out = here / f'vo-{voice}'
out.mkdir(exist_ok=True)
plan = []
for index, (start, text) in enumerate(LINES):
    samples, rate = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
    path = out / f'line{index}.wav'
    sf.write(path, samples, rate)
    plan.append({'file': str(path), 'start': start, 'seconds': round(len(samples) / rate, 2), 'text': text})
for row, nxt in zip(plan, plan[1:] + [{'start': 30.0}]):
    row['gap_after'] = round(nxt['start'] - (row['start'] + row['seconds']), 2)
(out / 'plan.json').write_text(json.dumps(plan, indent=1))
for row in plan:
    print(f"{row['start']:>5}s  {row['seconds']:>4}s  gap {row['gap_after']:>5}  {row['text']}")

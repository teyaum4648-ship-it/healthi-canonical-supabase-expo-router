"""Voices the story ad with Kokoro at full precision. The picture is cut to this voice, so each
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
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

here = Path(__file__).parent
sys.path.insert(0, str(here.parent / 'shared'))
from voice_engine import Voice  # noqa: E402  (VOICE_ENGINE=elevenlabs to use ElevenLabs)

models = Path(os.environ.get('KOKORO_DIR', here / 'voices'))
VOICE, SPEED, FIRST = 'af_heart', 1.0, 0.3

# (pause before the line in seconds, text). Longer pauses mark a change of scene.
LINES = [
    (0.0, 'Your sleep score is lying to you.'),
    (0.45, "It says you're a ninety-two today."),
    (0.35, 'You actually feel like a fifty-four.'),
    (0.9, "So where'd the rest go?"),
    (0.35, 'Skipped lunch cost twelve.'),
    (0.4, 'Back-to-back meetings took fourteen.'),
    (0.4, "Yesterday's workout burned eight."),
    (0.4, 'And water? Another four.'),
    (0.6, 'And you only find out at three p.m.'),
    (0.5, 'Six apps open.'),
    (0.55, 'So we built Day woven.'),
    (0.5, 'Your sleep, your meals, your movement, your mind, woven into one number. The real one.'),
    (0.7, 'When your day starts running heavy, it taps you on the shoulder.'),
    (0.5, 'One tap. Settled.'),
    (0.7, "Every morning, before coffee, you'll know where you stand."),
    (0.6, 'Fewer apps. Better days.'),
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


voice = Voice(models, VOICE, SPEED)
out = here / 'vo'
out.mkdir(exist_ok=True)
plan, at = [], FIRST
for index, (pause, text) in enumerate(LINES):
    # The lines either side, so each take sounds like part of one read.
    previous_text = LINES[index - 1][1] if index else None
    next_text = LINES[index + 1][1] if index + 1 < len(LINES) else None
    samples, rate = voice.say(text, previous_text, next_text)
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
print(f'{voice.name}: voice ends at {at:.2f}s')

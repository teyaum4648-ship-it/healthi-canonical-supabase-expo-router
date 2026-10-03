"""Voices the 3:07 p.m. ad with Kokoro at full precision. The picture is cut to this voice, so each
scene is one take, starting a set gap after the previous one ends, and plan.json records where each lands.

    pip install kokoro-onnx soundfile numpy
    # model files, from github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0:
    #   kokoro-v1.0.onnx (full precision) and voices-v1.0.bin, in KOKORO_DIR
    python voiceover.py                 # → vo/take00.wav … and vo/plan.json, then python retime.py

"Day woven" is spelled apart so the voice says the name cleanly; numbers are spelled out so
they are read as numbers, not digits. The first line says "three PM" without the dots, which the
voice otherwise reads as a full stop and pauses on before "crash".
"""
import json
import os
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

here = Path(__file__).parent
models = Path(os.environ.get('KOKORO_DIR', here / 'voices'))
VOICE, SPEED, FIRST = 'af_heart', 1.0, 0.25

# (pause before the take in seconds, the lines read together in one take). Reading a scene's lines in
# one go lets the voice carry its intonation from sentence to sentence, the way a person talks,
# instead of starting every sentence fresh. The voice is left dry: a room effect made of short
# echoes coloured it into something metallic. retime.py keeps the picture on the words.
TAKES = [
    (0.0, ['Your three PM crash is predictable.', 'I used to think I just needed more coffee.']),
    (0.35, ['So I rewound my day.', 'Six hours of sleep. No breakfast. Four meetings, back to back.',
            'By nine a.m., the crash was already booked.']),
    (0.45, ['So I built an app that sees it coming at seven,', 'and gives you one thing to do about it.']),
    (0.5, ['Then I added this:', 'it learns your rhythm, so it gets sharper every week.']),
    (0.5, ["Send this to the friend who's always tired at three.", "It's called Day woven. Link in bio."]),
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
for index, (pause, lines) in enumerate(TAKES):
    text = ' '.join(lines)
    samples, rate = kokoro.create(text, voice=VOICE, speed=SPEED, lang='en-us')
    samples = trimmed(np.asarray(samples, dtype=np.float64), rate)
    path = out / f'take{index:02d}.wav'
    sf.write(path, samples, rate, subtype='PCM_24')
    at += pause
    seconds = round(len(samples) / rate, 3)
    plan.append({'file': str(path), 'start': round(at, 3), 'seconds': seconds, 'text': text})
    at += seconds
(out / 'plan.json').write_text(json.dumps(plan, indent=1))
for row in plan:
    print(f"{row['start']:>7.2f}s  {row['seconds']:>5.2f}s  {row['text']}")
print(f'voice ends at {at:.2f}s')

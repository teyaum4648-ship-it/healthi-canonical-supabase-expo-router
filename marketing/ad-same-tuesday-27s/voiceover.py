"""Voices the Same Tuesday ad with Kokoro at full precision. The picture is cut to this voice, so each
scene is one take, starting a set gap after the previous one ends, and plan.json records where each lands.

    pip install kokoro-onnx soundfile numpy
    # model files, from github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0:
    #   kokoro-v1.0.onnx (full precision) and voices-v1.0.bin, in KOKORO_DIR
    python voiceover.py                 # → vo/take00.wav … and vo/plan.json, then python retime.py

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
VOICE, SPEED, FIRST = 'af_heart', 1.0, 0.25

# (pause before the take in seconds, the lines read together in one take). Reading a scene's lines in
# one go lets the voice carry its intonation from sentence to sentence, the way a person talks,
# instead of starting every sentence fresh. retime.py keeps the picture on the words.
TAKES = [
    (0.0, ['Same person. Same Tuesday.', 'Watch what happens at three p.m.']),
    (0.45, ['Up top: snooze, three coffees, no lunch.', 'Down here: one heads-up at seven a.m.',
            'Daylight before nine. Lunch before one. Last coffee by two.']),
    (0.5, ['Three p.m.']),
    (0.6, ['Same job. Same sleep. Completely different day.']),
    (0.5, ['That heads-up is Day woven.', 'It learns your rhythm, so every week it fits you a little better.', 'Link in bio.']),
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


def room(x, rate):
    """A small, soft room under the dry voice: a few early reflections and a short tail, so it sounds
    spoken in a space rather than generated. Seeded, so every run sounds the same."""
    n = int(rate * 0.4)
    t = np.arange(n) / rate
    ir = np.zeros(n)
    for ms, gain in ((7, 0.32), (11, 0.24), (17, 0.17), (23, 0.12), (31, 0.08)):
        ir[int(rate * ms / 1000)] += gain
    tail = np.random.default_rng(7).standard_normal(n) * np.exp(-t / 0.07)
    f = np.fft.rfftfreq(n, 1 / rate)
    ir += 0.05 * np.fft.irfft(np.fft.rfft(tail) * (f < 6000), n)
    x = np.concatenate([x, np.zeros(int(rate * 0.25))])
    return x + 0.55 * np.convolve(x, ir)[: len(x)]


kokoro = Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'))
out = here / 'vo'
out.mkdir(exist_ok=True)
plan, at = [], FIRST
for index, (pause, lines) in enumerate(TAKES):
    text = ' '.join(lines)
    samples, rate = kokoro.create(text, voice=VOICE, speed=SPEED, lang='en-us')
    samples = room(trimmed(np.asarray(samples, dtype=np.float64), rate), rate)
    path = out / f'take{index:02d}.wav'
    sf.write(path, samples, rate, subtype='PCM_24')
    at += pause
    seconds = round(len(samples) / rate, 3)
    plan.append({'file': str(path), 'start': round(at, 3), 'seconds': seconds, 'text': text})
    at += seconds - 0.25
(out / 'plan.json').write_text(json.dumps(plan, indent=1))
for row in plan:
    print(f"{row['start']:>7.2f}s  {row['seconds']:>5.2f}s  {row['text']}")
print(f'voice ends at {at:.2f}s')

"""Voices one of the promo's scripts with Kokoro at full precision and reports how each line fits.

    pip install kokoro-onnx soundfile
    # model files, from github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0:
    #   kokoro-v1.0.onnx (full precision, not the int8 file) and voices-v1.0.bin, in KOKORO_DIR
    python voiceover.py calm            # or: real; optional voice (af_heart) and speed
    ./mix.sh calm-af_heart              # then lay it over renders/daywoven-kinetic-30s-9x16.mp4

Lines are whole sentences, placed so their key words fall near what's on screen. "Day woven"
is spelled apart so the voice says the name cleanly.
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

here = Path(__file__).parent
models = Path(os.environ.get('KOKORO_DIR', here / 'voices'))

# Each line: (start second, text, the second the next sound must be clear by). A line is a
# scene's whole thought, read in one take so it flows; the music bed carries the space between.
SCRIPTS = {
    # Calm & premium: few words and room to breathe, read a touch slower.
    'calm': (0.95, [
        (0.6, 'Everything in your day is connected.', 4.6),
        (4.6, 'Day woven brings it together, in one score each morning.', 10.4),
        (10.6, 'Every food, scored. And every score, explained.', 17.2),
        (17.4, "There's a rhythm to your energy. Now, you can see it.", 22.2),
        (22.4, 'And when the day runs heavy, one small reset.', 26.4),
        (26.55, 'Day woven. Your whole day, woven together.', 30.0),
    ]),
    # Real talk: a relatable problem, then what the app does about it.
    'real': (1.05, [
        (0.3, "Tired, wired, or ready to go? Your body's been telling you all along.", 4.6),
        (4.6, 'Day woven reads your sleep, food and movement, and sums up your day in one score.', 9.9),
        (10.0, 'Search any food, tap its score, and see exactly why, right down to the ingredients.', 16.6),
        (16.75, 'Learn when your energy tends to peak, and plan around it.', 21.6),
        (21.75, 'Is today feeling heavy? It suggests one small reset that fits.', 26.4),
        (26.55, 'Day woven. Your whole day, woven together.', 30.0),
    ]),
}

script = sys.argv[1] if len(sys.argv) > 1 else 'calm'
pace, LINES = SCRIPTS[script]
voice = sys.argv[2] if len(sys.argv) > 2 else 'af_heart'
speed = float(sys.argv[3]) if len(sys.argv) > 3 else pace
kokoro = Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'))
out = here / f'vo-{script}-{voice}'
out.mkdir(exist_ok=True)


def trimmed(samples, rate):
    """Trims only true silence. Keeps the breath before the first word and lets the last one
    decay naturally, with soft raised-cosine edges, so no line starts or stops abruptly."""
    start = next((i for i, x in enumerate(samples) if abs(x) > 0.004), 0)
    end = next((i for i in range(len(samples) - 1, -1, -1) if abs(samples[i]) > 0.002), len(samples) - 1)
    out = samples[max(0, start - int(rate * 0.08)): min(len(samples), end + int(rate * 0.06))].copy()
    for edge, ms in ((slice(None), 30), (slice(None, None, -1), 80)):
        n = min(int(rate * ms / 1000), len(out))
        view = out[edge]
        view[:n] *= (1 - np.cos(np.linspace(0, np.pi, n))) / 2
    return out


plan = []
for index, (start, text, clear_by) in enumerate(LINES):
    samples, rate = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
    samples = trimmed(samples, rate)
    path = out / f'line{index:02d}.wav'
    sf.write(path, samples, rate, subtype='PCM_24')
    seconds = round(len(samples) / rate, 2)
    plan.append({'file': str(path), 'start': start, 'seconds': seconds, 'clear_by': clear_by, 'text': text, 'spare': round(clear_by - start - seconds, 2)})
(out / 'plan.json').write_text(json.dumps(plan, indent=1))
for row in plan:
    flag = '  <-- runs long' if row['spare'] < 0 else ''
    print(f"{row['start']:>6}s  {row['seconds']:>5}s  spare {row['spare']:>5}  {row['text']}{flag}")

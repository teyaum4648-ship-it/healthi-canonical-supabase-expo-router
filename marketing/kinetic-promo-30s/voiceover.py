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

import soundfile as sf
from kokoro_onnx import Kokoro

here = Path(__file__).parent
models = Path(os.environ.get('KOKORO_DIR', here / 'voices'))

# Each line: (start second, text, the second the next sound must be clear by).
SCRIPTS = {
    # Calm & premium: few words and room to breathe, read a touch slower.
    'calm': (0.97, [
        (0.4, 'Everything in your day is connected.', 4.6),
        (4.65, 'Day woven brings it together, in one score each morning.', 9.6),
        (10.0, 'Every food, scored.', 12.7),
        (12.75, 'And every score, explained.', 16.9),
        (17.4, "There's a rhythm to your energy. Now, you can see it.", 22.3),
        (22.45, 'And when the day runs heavy, one small reset.', 26.5),
        (26.6, 'Day woven.', 27.6),
        (27.65, 'Your whole day, woven together.', 30.0),
    ]),
    # Real talk: a relatable problem, then what the app does about it.
    'real': (1.05, [
        (0.3, "Tired, wired, or ready to go? Your body's been telling you all along.", 4.6),
        (4.65, 'Day woven reads your sleep, food and movement, and sums up your day in one score.', 9.6),
        (9.95, 'Search any food, tap its score, and see exactly why, right down to the ingredients.', 16.9),
        (17.4, 'Learn when your energy tends to peak, and plan around it.', 22.3),
        (22.45, 'Is today feeling heavy? It suggests one small reset that fits.', 26.5),
        (26.6, 'Day woven.', 27.6),
        (27.65, 'Your whole day, woven together.', 30.0),
    ]),
}

script = sys.argv[1] if len(sys.argv) > 1 else 'calm'
pace, LINES = SCRIPTS[script]
voice = sys.argv[2] if len(sys.argv) > 2 else 'af_heart'
speed = float(sys.argv[3]) if len(sys.argv) > 3 else pace
kokoro = Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'))
out = here / f'vo-{script}-{voice}'
out.mkdir(exist_ok=True)


def trimmed(samples, rate, head=0.004, tail=0.012):
    """Cuts the model's near-silence: 15 ms of air before the first sound, and the quiet release
    after the last one faded over 30 ms, so a word ends cleanly before the next one lands."""
    start = next((i for i, s in enumerate(samples) if abs(s) > head), 0)
    end = next((i for i in range(len(samples) - 1, -1, -1) if abs(samples[i]) > tail), len(samples) - 1)
    pad, fade = int(rate * 0.015), int(rate * 0.03)
    out = samples[max(0, start - pad): min(len(samples), end + fade)].copy()
    for i in range(min(fade, len(out))):
        out[len(out) - 1 - i] *= i / fade
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

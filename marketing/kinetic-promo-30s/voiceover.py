"""Voices each line of the promo with Kokoro at full precision and reports how each one fits.

    pip install kokoro-onnx soundfile
    # model files, from github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0:
    #   kokoro-v1.0.onnx (full precision, not the int8 file) and voices-v1.0.bin, in KOKORO_DIR
    python voiceover.py af_heart        # or am_michael, af_bella, ... ; optional speed: 1.05
    ./mix.sh af_heart                   # then lay it over renders/daywoven-kinetic-30s-9x16.mp4

Each line starts on the beat its words land on screen. "Day woven" is spelled apart so the
voice says the name cleanly.
"""
import json
import os
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

here = Path(__file__).parent
models = Path(os.environ.get('KOKORO_DIR', here / 'voices'))

# (start second, text, the second the next sound must be clear by[, pace]). The four opening
# words are said a little faster so each one ends before the next slam.
LINES = [
    (0.12, 'Sleep.', 0.6, 1.2),
    (0.6, 'Food.', 1.08, 1.2),
    (1.08, 'Movement.', 1.58, 1.25),
    (1.58, 'Mind.', 2.2, 1.2),
    (2.2, "It's all connected.", 3.3),
    (3.3, 'Woven into one day.', 4.6),
    (4.6, 'One score, every morning.', 6.35),
    (6.45, "And what's behind it.", 9.0),
    (9.05, 'Food.', 9.85),
    (9.9, 'Search any food.', 11.85),
    (11.9, 'Tap the score,', 13.0),
    (13.05, 'and see why.', 15.0),
    (15.05, "Down to what it's made of.", 16.6),
    (16.65, 'Sleep.', 17.45),
    (17.5, 'Know when your energy peaks,', 19.6),
    (19.65, 'and plan around it.', 21.6),
    (21.65, 'Mind.', 22.45),
    (22.5, 'One reset that fits your day.', 24.5),
    (24.55, 'Small resets add up.', 26.5),
    (26.6, 'Day woven.', 27.5),
    (27.55, 'Your whole day, woven together.', 30.0),
]

voice = sys.argv[1] if len(sys.argv) > 1 else 'af_heart'
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.05
kokoro = Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'))
out = here / f'vo-{voice}'
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
for index, (start, text, clear_by, *pace) in enumerate(LINES):
    samples, rate = kokoro.create(text, voice=voice, speed=speed * (pace[0] if pace else 1), lang='en-us')
    samples = trimmed(samples, rate)
    path = out / f'line{index:02d}.wav'
    sf.write(path, samples, rate, subtype='PCM_24')
    seconds = round(len(samples) / rate, 2)
    plan.append({'file': str(path), 'start': start, 'seconds': seconds, 'clear_by': clear_by, 'text': text, 'spare': round(clear_by - start - seconds, 2)})
(out / 'plan.json').write_text(json.dumps(plan, indent=1))
for row in plan:
    flag = '  <-- runs long' if row['spare'] < 0 else ''
    print(f"{row['start']:>6}s  {row['seconds']:>5}s  spare {row['spare']:>5}  {row['text']}{flag}")

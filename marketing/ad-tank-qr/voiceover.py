"""Voices the tank ad. Jeremy (ElevenLabs) reads it; his takes are kept in voice-jeremy/, one per
scene, and the picture is cut to them. Each scene is one take, starting a set gap after the previous
one ends, and plan.json records where each lands.

    VOICE_ENGINE=files VOICE_FILES=voice-jeremy python voiceover.py   # → vo/take00.wav … and vo/plan.json

"Day woven" is spelled apart so the voice says the name cleanly, and the address is written out as
it is said: "day woven app dot com".
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
VOICE, SPEED, FIRST = 'af_heart', 1.0, 0.25

# (pause before the take in seconds, the lines read together in one take). Reading a scene's lines in
# one go lets the voice carry its intonation from sentence to sentence, the way a person talks,
# instead of starting every sentence fresh. The voice is left dry: a room effect made of short
# echoes coloured it into something metallic. retime.py keeps the picture on the words.
TAKES = [
    (0.0, ['So, militaries have started putting QR codes on their tanks.']),
    (0.35, ["Here's why. Drones started firing on tanks."]),
    (0.4, ['So now, before a drone fires, it scans the tank.', 'And the QR code sends it to day woven app dot com.']),
    (0.5, ["Turns out the drone's running on four hours of sleep too."]),
    (0.6, ['Day woven reads your sleep, your meals, your movement and your mind,', 'and turns them into one number for today.']),
    (0.4, ['It knows when your energy peaks, and when the afternoon crash is coming.']),
    (0.4, ['Search any food and see how it scores before you eat it.']),
    (0.4, ['And when your day gets heavy, two minutes of breathing to reset.']),
    (0.45, ['It learns your rhythm, so it gets sharper every week.']),
    (0.6, ['Day woven app dot com.', 'Even the drones are calmer now.']),
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
for index, (pause, lines) in enumerate(TAKES):
    text = ' '.join(lines)
    # The lines either side, so each take sounds like part of one read.
    previous_text = ' '.join(TAKES[index - 1][1]) if index else None
    next_text = ' '.join(TAKES[index + 1][1]) if index + 1 < len(TAKES) else None
    samples, rate = voice.say(text, previous_text, next_text)
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
print(f'{voice.name}: voice ends at {at:.2f}s')

"""Hear one line in several ElevenLabs voices before re-voicing an ad.

    python audition.py --list                                   # the voices this account can use
    python audition.py "Your three PM crash is predictable." ID1 ID2 ID3
                                                                # → auditions/<name>.wav per voice

Needs ELEVENLABS_API_KEY in the environment. Uses the same settings the ads use, so what you
hear here is what the ad will sound like.
"""
import re
import sys
from pathlib import Path

import soundfile as sf

from voice_engine import elevenlabs, list_voices

if len(sys.argv) >= 2 and sys.argv[1] == '--list':
    for voice_id, name, labels in list_voices():
        described = ', '.join(f'{v}' for v in labels.values() if v)
        print(f'{voice_id}  {name}  {described}')
    sys.exit(0)

if len(sys.argv) < 3:
    sys.exit(__doc__)

line, voices = sys.argv[1], sys.argv[2:]
names = {voice_id: name for voice_id, name, _ in list_voices()}
out = Path(__file__).parent / 'auditions'
out.mkdir(exist_ok=True)
for voice_id in voices:
    samples, rate = elevenlabs(line, voice_id=voice_id)
    label = re.sub(r'[^a-z0-9]+', '-', names.get(voice_id, voice_id).lower()).strip('-')
    path = out / f'{label}.wav'
    sf.write(path, samples, rate, subtype='PCM_24')
    print(f'{path}  {len(samples) / rate:.2f}s')

"""One voice for every ad, from either engine.

    VOICE_ENGINE=kokoro        (default) the local Kokoro voice the ads were cut to, af_heart
    VOICE_ENGINE=elevenlabs    ElevenLabs, reading
        ELEVENLABS_API_KEY     from the environment, never from a file or the command line
        ELEVENLABS_VOICE_ID    which voice (the ID from the voice's page, or audition.py --list)
        ELEVENLABS_MODEL       optional, default eleven_multilingual_v2
        ELEVENLABS_FORMAT      optional, default pcm_24000 (the same rate as Kokoro)

Each ad's voiceover.py asks this for one take per scene and keeps doing everything else the
same way: trimming, plan.json, then retime.py moving the picture onto the new take's words.

ElevenLabs is given the lines either side of each take, so a take sounds like the middle of
a read rather than a fresh start; that is most of what makes a multi-take voice-over sound
like one person talking.
"""
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

API = 'https://api.elevenlabs.io/v1'
# Steady enough to hold one character across takes, loose enough to sound spoken, not read.
SETTINGS = {'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.15, 'use_speaker_boost': True}


def _request(path, body=None, accept='application/json'):
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        raise SystemExit('ELEVENLABS_API_KEY is not set. Add it to the environment, not to a file or the command line.')
    request = urllib.request.Request(
        f'{API}{path}',
        data=None if body is None else json.dumps(body).encode(),
        headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': accept},
        method='GET' if body is None else 'POST'
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors='replace')[:400]
        raise SystemExit(f'ElevenLabs answered {error.code}: {detail}') from None


def list_voices():
    """(voice_id, name, labels) for every voice the account can use."""
    data = json.loads(_request('/voices'))
    return [(v['voice_id'], v['name'], v.get('labels', {})) for v in data.get('voices', [])]


def elevenlabs(text, voice_id=None, previous_text=None, next_text=None):
    voice_id = voice_id or os.environ.get('ELEVENLABS_VOICE_ID')
    if not voice_id:
        raise SystemExit('Set ELEVENLABS_VOICE_ID to the voice to use (audition.py --list shows them).')
    fmt = os.environ.get('ELEVENLABS_FORMAT', 'pcm_24000')
    if not fmt.startswith('pcm_'):
        raise SystemExit('ELEVENLABS_FORMAT must be a pcm_ format so the takes can be trimmed and timed.')
    body = {'text': text, 'model_id': os.environ.get('ELEVENLABS_MODEL', 'eleven_multilingual_v2'), 'voice_settings': SETTINGS}
    if previous_text:
        body['previous_text'] = previous_text
    if next_text:
        body['next_text'] = next_text
    raw = _request(f'/text-to-speech/{voice_id}?output_format={fmt}', body, accept='audio/pcm')
    samples = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return samples, int(fmt.split('_')[1])


class Voice:
    """voice.say(text, previous_text, next_text) → (float64 samples, sample rate)."""

    def __init__(self, models_dir, kokoro_voice='af_heart', speed=1.0):
        self.engine = os.environ.get('VOICE_ENGINE', 'kokoro').lower()
        self.kokoro_voice, self.speed = kokoro_voice, speed
        if self.engine == 'kokoro':
            from kokoro_onnx import Kokoro
            models = Path(models_dir)
            self.kokoro = Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'))
        elif self.engine != 'elevenlabs':
            raise SystemExit(f'VOICE_ENGINE must be kokoro or elevenlabs, not {self.engine!r}.')

    @property
    def name(self):
        if self.engine == 'kokoro':
            return f'kokoro:{self.kokoro_voice}'
        return f"elevenlabs:{os.environ.get('ELEVENLABS_VOICE_ID', '?')}"

    def say(self, text, previous_text=None, next_text=None):
        if self.engine == 'kokoro':
            samples, rate = self.kokoro.create(text, voice=self.kokoro_voice, speed=self.speed, lang='en-us')
            return np.asarray(samples, dtype=np.float64), rate
        return elevenlabs(text, previous_text=previous_text, next_text=next_text)

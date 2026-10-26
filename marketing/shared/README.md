# Voices for the ads

`voice_engine.py` gives every ad one voice from either engine. Kokoro (`af_heart`) stays the
default, so the ads render exactly as before until you choose otherwise.

## Using ElevenLabs

1. In the cloud environment's settings, allow `api.elevenlabs.io` under network access and add
   `ELEVENLABS_API_KEY` as a secret. A key restricted to Text to Speech and Voices (read) is
   enough. Never paste the key into a chat or commit it.
2. Pick a voice:
   ```bash
   python audition.py --list
   python audition.py "Your three PM crash is predictable." VOICE_ID_1 VOICE_ID_2 VOICE_ID_3
   ```
   Each voice's take lands in `auditions/`.
3. Re-voice an ad with the one you like, then keep the picture on its words:
   ```bash
   cd ../ad-3pm-31s
   VOICE_ENGINE=elevenlabs ELEVENLABS_VOICE_ID=VOICE_ID python voiceover.py
   python retime.py && python cues.py && npm run render && ./mix.sh
   ```
   `retime.py` matches the new take's words against the take the picture was cut to
   (`design.json`), so every tween and sound effect follows the new delivery.

Each take is sent with the lines either side of it, so the read carries across scene cuts
instead of restarting at each one.

## Using takes made in the ElevenLabs app or connector

When the takes come from somewhere other than the API (the ElevenLabs app, or Claude through the
ElevenLabs connector), save them as `take00.mp3`, `take01.mp3` … in one folder, one per scene in
the order the ad's `voiceover.py` lists them, and point the files engine at it:

```bash
VOICE_ENGINE=files VOICE_FILES=voice-lyan python voiceover.py
python retime.py && python cues.py && npm run render && ./mix.sh
```

The ads' current takes are Ashley's, kept in each ad's `voice-ashley/` (an earlier read by Lyan is in
`voice-lyan/`).

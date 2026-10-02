"""Listens back to a mix: transcribes it offline and prints each word with the second it lands.

    pip install sherpa-onnx
    # model, from github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models:
    #   sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8, unpacked into PARAKEET_DIR
    python listen.py renders/daywoven-kinetic-30s-9x16-vo-calm-af_heart.mp4

If a line comes back misheard, a listener on a phone speaker may mishear it too. Check it
alone (cut a few seconds around it with ffmpeg) to tell the take from the mix.
"""
import array
import os
import subprocess
import sys
from pathlib import Path

import sherpa_onnx

model = Path(os.environ.get('PARAKEET_DIR', Path(__file__).parent / 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8'))
ffmpeg = os.environ.get('FFMPEG', 'ffmpeg')
recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=str(model / 'encoder.int8.onnx'), decoder=str(model / 'decoder.int8.onnx'), joiner=str(model / 'joiner.int8.onnx'),
    tokens=str(model / 'tokens.txt'), model_type='nemo_transducer', num_threads=4)

for path in sys.argv[1:]:
    pcm = subprocess.run([ffmpeg, '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
    stream = recognizer.create_stream()
    stream.accept_waveform(16000, [s / 32768 for s in array.array('h', pcm)])
    recognizer.decode_stream(stream)
    result = stream.result
    # Sub-word pieces join into words, each timed by its first piece.
    words, word, at = [], '', None
    for piece, t in zip(result.tokens, result.timestamps):
        if piece.startswith((' ', '▁')):
            if word:
                words.append((at, word))
            word, at = piece.strip(' ▁'), t
        else:
            at = t if at is None else at
            word += piece
    if word:
        words.append((at, word))
    print(f'== {path}\n{result.text.strip()}\n' + ' '.join(f'{w}@{t:.2f}' for t, w in words))

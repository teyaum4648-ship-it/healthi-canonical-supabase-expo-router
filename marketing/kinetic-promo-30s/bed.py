"""Synthesises the promo's soft music bed: warm pad chords that change on the scene cuts.

    pip install numpy soundfile
    python bed.py                       # → sfx/bed.wav (30 s, 48 kHz stereo)

No samples and nothing downloaded: detuned, band-limited saw voices through a gentle
low-pass, spread across the stereo field and given a little room with a synthetic
reverb. Same input, same file, every time.
"""
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 48000
LENGTH = 30.0
here = Path(__file__).parent

# (start second, notes as MIDI numbers). D major colours; each change lands on a cut.
CHORDS = [
    (0.0, [50, 57, 64, 66, 73]),    # Dmaj9   hook
    (4.4, [47, 54, 62, 64, 69]),    # Bm11    home
    (9.0, [43, 50, 59, 66, 69]),    # Gmaj9   food
    (13.0, [40, 47, 55, 62, 66]),   # Em9     the score sheet
    (16.6, [42, 49, 57, 64, 69]),   # F#m11   sleep
    (21.6, [43, 50, 57, 59, 66]),   # Gmaj9   mind
    (26.45, [38, 50, 57, 64, 66, 73]),  # Dmaj9 over a low D, under the logo
]
ATTACK, OVERLAP = 0.45, 0.6


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def voice(freq, t):
    """A soft saw: the first eight harmonics at 1/n, rolled off so it stays warm."""
    out = np.zeros_like(t)
    for n in range(1, 9):
        if freq * n > 6000:
            break
        out += np.sin(2 * np.pi * freq * n * t) * (1 / n) * np.exp(-n / 5)
    return out


def envelope(t, start, end):
    """Rise over ATTACK, hold, then fall away across the next chord's first OVERLAP seconds."""
    rise = np.clip((t - start) / ATTACK, 0, 1)
    fall = np.clip((end + OVERLAP - t) / OVERLAP, 0, 1)
    return np.sin(rise * np.pi / 2) ** 2 * np.sin(fall * np.pi / 2) ** 2


t = np.arange(int(RATE * LENGTH)) / RATE
left, right = np.zeros_like(t), np.zeros_like(t)
for index, (start, notes) in enumerate(CHORDS):
    end = CHORDS[index + 1][0] if index + 1 < len(CHORDS) else LENGTH
    env = envelope(t, start, end)
    span = (t >= start - 0.01) & (t <= end + OVERLAP)
    for k, note in enumerate(notes):
        level = 0.55 if note < 48 else 0.32  # the bass note carries, the upper voices sit back
        # Three voices per note, a few cents apart, spread left to right.
        for cents, pan in ((-7, 0.2), (0, 0.5), (7, 0.8)):
            sound = np.zeros_like(t)
            sound[span] = voice(hz(note) * 2 ** (cents / 1200), t[span]) * env[span] * level
            left += sound * np.cos(pan * np.pi / 2)
            right += sound * np.sin(pan * np.pi / 2)

# A slow breath in the level, so the pad never sits perfectly still.
swell = 1 + 0.08 * np.sin(2 * np.pi * 0.12 * t)
stereo = np.stack([left, right], axis=1) * swell[:, None]


def lowpass(x, cutoff):
    """Two passes of a one-pole low-pass: a gentle 12 dB/octave slope."""
    a = np.exp(-2 * np.pi * cutoff / RATE)
    for _ in range(2):
        y = np.empty_like(x)
        acc = np.zeros(x.shape[1])
        for i in range(0, len(x), 4800):  # blocks keep the Python loop short
            block = x[i:i + 4800]
            out = np.empty_like(block)
            for j in range(len(block)):
                acc = (1 - a) * block[j] + a * acc
                out[j] = acc
            y[i:i + 4800] = out
        x = y
    return x


stereo = lowpass(stereo, 1400)

# Room: a 2.6 s decaying-noise impulse, different per side, mixed in at about a third.
rng = np.random.default_rng(7)
tail = np.arange(int(RATE * 2.6)) / RATE
wet = np.empty_like(stereo)
for side in range(2):
    impulse = rng.standard_normal(len(tail)) * np.exp(-tail / 0.55)
    impulse[: int(RATE * 0.012)] = 0  # a short pre-delay keeps the chords clear
    impulse /= np.sqrt(np.sum(impulse ** 2))
    size = 1 << int(np.ceil(np.log2(len(stereo) + len(impulse))))
    wet[:, side] = np.fft.irfft(np.fft.rfft(stereo[:, side], size) * np.fft.rfft(impulse, size), size)[: len(stereo)]
mix = 0.72 * stereo + 0.34 * wet

# Fade in from the first frame and out over the last two seconds.
mix *= np.clip(t / 0.25, 0, 1)[:, None] * np.clip((LENGTH - t) / 2.0, 0, 1)[:, None]
mix *= 0.5 / np.max(np.abs(mix))
sf.write(here / 'sfx' / 'bed.wav', mix.astype(np.float32), RATE, subtype='PCM_24')
print('wrote sfx/bed.wav')

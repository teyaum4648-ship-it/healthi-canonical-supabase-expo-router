"""Synthesises the promo's background bed: a gentle stream with soft breezes. Nature only, no music.

    pip install numpy soundfile
    python bed.py                       # → sfx/bed.wav (30 s, 48 kHz stereo)

No instruments, no musical notes and nothing downloaded:
- The stream is thousands of tiny water bubbles. Each is a short sine whose pitch rises as
  it closes, the way real bubbles in moving water sound (van den Doel, 2005), over a soft
  rush of filtered noise.
- The breeze is noise whose band drifts slowly and swells gently on each scene cut, so the
  cuts still feel marked.
- A fixed random seed means the same file every time.
"""
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 48000
LENGTH = 30.0
CUTS = [4.4, 9.0, 16.6, 21.6, 26.45]  # where the picture changes scene
here = Path(__file__).parent
rng = np.random.default_rng(11)
n = int(RATE * LENGTH)
t = np.arange(n) / RATE


def smooth_random(rate_hz, size=n):
    """A slowly wandering curve between -1 and 1: random points joined by cosine curves."""
    points = rng.uniform(-1, 1, int(LENGTH * rate_hz) + 3)
    pos = np.arange(size) / RATE * rate_hz
    i = pos.astype(int)
    frac = (1 - np.cos((pos - i) * np.pi)) / 2
    return points[i] * (1 - frac) + points[i + 1] * frac


def bubbles(density):
    """One channel of brook babble: bubbles at random times, each a rising, fading sine."""
    out = np.zeros(n + RATE)
    flow = 1 + 0.3 * smooth_random(0.4)  # the stream runs a little busier, then calmer
    count = int(density * LENGTH * 1.3)
    times = np.sort(rng.uniform(0, LENGTH, count))
    keep = rng.uniform(0, 1.3, count) < flow[(times * RATE).astype(int)]
    for start in times[keep]:
        f0 = np.exp(rng.uniform(np.log(600), np.log(3400)))  # bubble size sets the pitch
        decay = 0.043 * f0 + 0.0014 * f0 ** 1.5  # smaller bubbles ring for less time
        rise = rng.uniform(0.08, 0.45) * decay  # pitch climbs as the bubble closes
        life = np.arange(int(RATE * 5 / decay)) / RATE
        phase = 2 * np.pi * f0 * (life + rise * life ** 2 / 2)
        # Small bubbles die away fast; weighting by decay keeps their sparkle in the mix.
        level = rng.lognormal(0, 0.6) * np.sqrt(decay / 100) * (1400 / f0) ** 0.2
        s = int(start * RATE)
        out[s:s + len(life)] += level * np.sin(phase) * np.exp(-decay * life)
    return out[:n]


def shaped_noise(centre, width, gain, frame=2048, hop=512):
    """Noise through a band that moves over time (centre and gain are per-sample curves)."""
    noise = rng.standard_normal(n + frame)
    window = np.hanning(frame)
    freqs = np.fft.rfftfreq(frame, 1 / RATE)
    out = np.zeros(n + frame)
    for s in range(0, n, hop):
        c, g = centre[min(s, n - 1)], gain[min(s, n - 1)]
        band = np.exp(-0.5 * (np.log2(np.maximum(freqs, 1) / c) / width) ** 2) * g
        out[s:s + frame] += np.fft.irfft(np.fft.rfft(noise[s:s + frame] * window) * band) * window
    return out[:n] / (frame / hop / 1.5)


def lowpass(x, cutoff):
    """A gentle 12 dB/octave low-pass, done in the frequency domain on the whole signal."""
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    return np.fft.irfft(np.fft.rfft(x) / (1 + (f / cutoff) ** 2), len(x))


def highpass(x, cutoff):
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    return np.fft.irfft(np.fft.rfft(x) * (f / cutoff) ** 2 / (1 + (f / cutoff) ** 2), len(x))


# Stream: a shared centre so it sounds like one stream, with independent detail each side.
centre_babble = bubbles(260)
stream = []
for side in range(2):
    babble = 0.6 * centre_babble + 0.8 * bubbles(200)
    rush = shaped_noise(np.full(n, 2200.0), 1.3, np.full(n, 1.0))
    water = lowpass(highpass(babble / np.std(babble) + 0.25 * rush / np.std(rush), 350), 6500)
    stream.append(water)
stream = np.stack(stream, axis=1)

# Breeze: low and airy, drifting in pitch, swelling softly around each cut.
swell = np.full(n, 0.35)
for cut in CUTS:
    rise = np.clip((t - (cut - 1.1)) / 1.1, 0, 1)
    fall = np.clip(1 - (t - cut) / 2.2, 0, 1)
    swell += 0.75 * np.where(t < cut, np.sin(rise * np.pi / 2) ** 2, np.sin(fall * np.pi / 2) ** 2) * (t > cut - 1.1)
swell *= 1 + 0.25 * smooth_random(0.3)
breeze = []
for side in range(2):
    centre = 300 * 2 ** (0.6 * smooth_random(0.15))
    breeze.append(shaped_noise(centre, 0.9, swell))
breeze = np.stack(breeze, axis=1)
breeze /= np.std(breeze)

# Air: a short, soft room around the water so it sits behind the voice, not in front of it.
mix = stream / np.std(stream) + 0.5 * breeze
tail = np.arange(int(RATE * 0.9)) / RATE
wet = np.empty_like(mix)
for side in range(2):
    impulse = rng.standard_normal(len(tail)) * np.exp(-tail / 0.18)
    impulse /= np.sqrt(np.sum(impulse ** 2))
    size = 1 << int(np.ceil(np.log2(n + len(impulse))))
    wet[:, side] = np.fft.irfft(np.fft.rfft(mix[:, side], size) * np.fft.rfft(impulse, size), size)[:n]
mix = 0.8 * mix + 0.35 * wet

# Fade in from the first frame and out over the last two seconds.
mix *= (np.clip(t / 0.4, 0, 1) * np.clip((LENGTH - t) / 2.0, 0, 1))[:, None]
mix -= mix.mean(axis=0)
mix *= 0.5 / np.max(np.abs(mix))
sf.write(here / 'sfx' / 'bed.wav', mix.astype(np.float32), RATE, subtype='PCM_24')
print('wrote sfx/bed.wav')

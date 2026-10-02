"""Synthesises the story ad's sound effects. Natural sounds only: no music, no instruments.

    pip install numpy soundfile
    python sfx.py                       # → sfx/*.wav

bloop  a low bubble surfacing, for the melting goo
bite   a crunchy bite, for the lunch monster
knock  a soft knock on wood, for the calendar blocks and the "tap tap"
fire   a soft fwoomp with a few crackles, for the flame
air    a short rush of air, for the app chips flying in
tick   a quiet clock tick, for 3 p.m.
drop   two water drops, for notifications and the name
breath a slow breath of air, for the reset
"""
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 48000
here = Path(__file__).parent
(here / 'sfx').mkdir(exist_ok=True)
rng = np.random.default_rng(5)


def save(name, x, peak=0.5):
    x = np.asarray(x, dtype=np.float64)
    fade = min(len(x), int(RATE * 0.004))
    x[-fade:] *= np.linspace(1, 0, fade)
    sf.write(here / 'sfx' / f'{name}.wav', (x / np.max(np.abs(x)) * peak).astype(np.float32), RATE, subtype='PCM_24')


def seconds(s):
    return np.arange(int(RATE * s)) / RATE


def bubble(f0, rise, decay, length):
    """A bubble's ring: its pitch climbs as it closes, and it dies away."""
    t = seconds(length)
    phase = 2 * np.pi * np.cumsum(f0 * (1 + rise * t)) / RATE
    return np.sin(phase) * np.exp(-t / decay) * np.minimum(1, t / 0.002)


def band(noise, lo, hi):
    f = np.fft.rfftfreq(len(noise), 1 / RATE)
    return np.fft.irfft(np.fft.rfft(noise) * ((f > lo) & (f < hi)), len(noise))


# Bloop: a big, slow bubble with a smaller one just after.
x = bubble(190, 2.2, 0.07, 0.35)
x[int(RATE * 0.05):] += 0.4 * bubble(320, 2.5, 0.04, 0.3)[: len(x) - int(RATE * 0.05)]
save('bloop', x)

# Bite: two short crunchy bursts and a soft thump underneath.
t = seconds(0.22)
x = np.zeros_like(t)
for at, level in ((0.0, 1.0), (0.055, 0.6), (0.09, 0.35)):
    s = int(at * RATE)
    burst = band(rng.standard_normal(len(t) - s), 900, 5200) * np.exp(-(t[: len(t) - s]) / 0.012)
    x[s:] += level * burst
x += 0.5 * np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.03)
save('bite', x)

# Knock: wood rings at a few inharmonic frequencies and stops almost at once.
t = seconds(0.18)
x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in ((240, 1.0, 0.035), (590, 0.6, 0.02), (1130, 0.35, 0.012), (1890, 0.2, 0.007)))
x += 0.15 * band(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.003)
save('knock', x)

# Fire: a soft whoomp of air that swells and falls, with a few crackles in it.
t = seconds(0.9)
env = np.sin(np.clip(t / 0.9, 0, 1) * np.pi) ** 1.5
x = band(rng.standard_normal(len(t)), 120, 1400) * env
for at in (0.12, 0.21, 0.33, 0.41, 0.55, 0.62):
    s = int(at * RATE)
    n = int(RATE * 0.006)
    x[s:s + n] += rng.standard_normal(n) * np.exp(-np.arange(n) / (RATE * 0.0015)) * 2.5
save('fire', x, 0.45)

# Air: noise whose band rises and falls, like something passing quickly.
t = seconds(0.55)
noise = rng.standard_normal(len(t) + 4096)
out = np.zeros(len(t) + 4096)
win = np.hanning(2048)
f = np.fft.rfftfreq(2048, 1 / RATE)
for s in range(0, len(t), 512):
    centre = 500 + 1600 * np.sin(np.pi * s / len(t))
    shape = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / centre) / 0.8) ** 2)
    out[s:s + 2048] += np.fft.irfft(np.fft.rfft(noise[s:s + 2048] * win) * shape) * win
x = out[: len(t)] * np.sin(np.pi * t / t[-1]) ** 2
save('air', x, 0.4)

# Tick: a small, dry click from a clock.
t = seconds(0.05)
x = band(rng.standard_normal(len(t)), 2000, 8000) * np.exp(-t / 0.0025) + 0.3 * np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.004)
save('tick', x, 0.4)

# Drop: two water drops, the second smaller, with a little space around them.
x = np.zeros(int(RATE * 0.9))
d1 = bubble(820, 9, 0.03, 0.25)
d2 = 0.45 * bubble(1150, 9, 0.022, 0.2)
x[: len(d1)] += d1
x[int(RATE * 0.36): int(RATE * 0.36) + len(d2)] += d2
for delay, gain in ((0.023, 0.22), (0.041, 0.14), (0.067, 0.08)):
    d = int(RATE * delay)
    x[d:] += gain * x[:-d]
save('drop', x)

# Breath: a slow, soft rush of air in and out.
t = seconds(1.1)
x = band(rng.standard_normal(len(t)), 250, 2600) * np.sin(np.pi * t / t[-1]) ** 2
save('breath', x, 0.35)
print('wrote', ', '.join(sorted(p.stem for p in (here / 'sfx').glob('*.wav'))))

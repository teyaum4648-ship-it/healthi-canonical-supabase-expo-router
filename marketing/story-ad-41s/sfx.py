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
thud   a low, soft body thump, for slams and the blocks pressing down
pop    a tiny bubble pop, for things appearing and letters landing
drip   a single small drip, for the melt
squish a wet, gooey squelch, for the puddle and the orb springing back
munch  a softer bite, for chewing
sizzle a short hiss with crackle, for the flame's singe
sigh   a soft exhale, for "(sigh)"
scribble a pencil scratching, for the question mark, the loop and the check
steam  a faint hiss, for the coffee
rise   a slow swell of air, for the sunrise and the dawn
swish  a quick, light air movement, for cards and text sliding
count  a short rattle of clicks slowing down, for numbers counting
countlong  the same, longer, for the clock and the ring
tap    a small ceramic tap, for the cup and the glass landing
patter little footsteps, for the lunch monster running in and out
puff   a short, soft breath, for the flame going out
zip    a quick thread pulled taut, for the threads weaving
glint  a few tiny grains of sparkle, for the stars twinkling
smack  a small wet mouth sound, for the monster's mouth opening
crackle two or three small fire crackles, for the flame flickering
wobble a jelly wobble, for the orb bouncing back after the press
slosh  a little water moving in a glass, for the glass tipping
static a short burst of crackly static, for the "LYING." glitch
slurp  goo gathering itself up, for the puddle pulling into a question mark
ooze   a slow, low spread of goo, for the puddle spreading out
blink  a tiny soft click, for the eyes blinking and glancing up
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
# Thud: a low, soft body thump with a little texture, felt more than heard.
t = seconds(0.32)
x = np.sin(2 * np.pi * (70 + 60 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.08)
x += 0.25 * band(rng.standard_normal(len(t)), 150, 1200) * np.exp(-t / 0.02)
save('thud', x, 0.55)

# Pop: a tiny bubble popping, bright and short.
save('pop', bubble(900, 6, 0.018, 0.09) + 0.3 * band(rng.standard_normal(int(RATE * 0.09)), 2000, 7000) * np.exp(-seconds(0.09) / 0.004), 0.45)

# Drip: one small drop landing.
save('drip', bubble(1300, 8, 0.02, 0.14), 0.4)

# Squish: wet goo, a cluster of low bubbles over a soft smear of noise.
t = seconds(0.45)
x = 0.4 * band(rng.standard_normal(len(t)), 200, 1600) * np.sin(np.pi * t / t[-1]) ** 2
for at, f0 in ((0.02, 240), (0.09, 310), (0.15, 200), (0.24, 380), (0.3, 260)):
    s0 = int(at * RATE)
    b = 0.6 * bubble(f0, 3, 0.04, 0.12)
    x[s0:s0 + len(b)] += b[: len(x) - s0]
save('squish', x, 0.45)

# Munch: a softer, shorter bite for chewing.
t = seconds(0.14)
x = band(rng.standard_normal(len(t)), 700, 4000) * np.exp(-t / 0.014) + 0.3 * np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.025)
save('munch', x, 0.4)

# Sizzle: a hiss that dies away, with a few crackles.
t = seconds(0.6)
x = band(rng.standard_normal(len(t)), 2500, 9000) * np.exp(-t / 0.18) * 0.6
for at in (0.04, 0.11, 0.2, 0.27, 0.38):
    s0 = int(at * RATE); n = int(RATE * 0.004)
    x[s0:s0 + n] += rng.standard_normal(n) * np.exp(-np.arange(n) / (RATE * 0.001)) * 1.5
save('sizzle', x, 0.35)

# Sigh: a soft exhale, falling away.
t = seconds(0.9)
env = np.minimum(1, t / 0.12) * np.exp(-np.maximum(0, t - 0.12) / 0.28)
noise = rng.standard_normal(len(t))
f = np.fft.rfftfreq(len(t), 1 / RATE)
shape = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / 900) / 1.1) ** 2)
x = np.fft.irfft(np.fft.rfft(noise) * shape, len(t)) * env
save('sigh', x, 0.4)

# Scribble: a pencil scratching, short strokes of grainy noise.
t = seconds(0.55)
strokes = (np.sin(2 * np.pi * 9 * t) > -0.2).astype(float) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 23 * t)))
x = band(rng.standard_normal(len(t)), 1800, 7500) * strokes * np.sin(np.pi * t / t[-1]) ** 0.5
save('scribble', x, 0.3)

# Steam: a faint, airy hiss.
t = seconds(1.2)
x = band(rng.standard_normal(len(t)), 3000, 10000) * np.sin(np.pi * t / t[-1]) ** 2
save('steam', x, 0.2)

# Rise: a slow swell of air that builds and settles.
t = seconds(1.4)
x = band(rng.standard_normal(len(t)), 200, 2500) * np.sin(np.pi * np.minimum(1, t / 1.0) / 2) ** 2 * np.minimum(1, (t[-1] - t) / 0.35)
save('rise', x, 0.35)

# Swish: a quick, light movement of air.
t = seconds(0.28)
x = band(rng.standard_normal(len(t)), 900, 6000) * np.sin(np.pi * t / t[-1]) ** 3
save('swish', x, 0.3)


def rattle(length, clicks):
    """Clicks that start quick and slow down, the way a counter settles on its number."""
    x = np.zeros(int(RATE * length))
    click = band(rng.standard_normal(int(RATE * 0.012)), 2500, 8000) * np.exp(-seconds(0.012) / 0.0015)
    for k in range(clicks):
        at = length * 0.9 * (1 - (1 - k / clicks) ** 0.5)
        s0 = int(at * RATE)
        x[s0:s0 + len(click)] += click[: len(x) - s0] * (0.6 + 0.4 * (k == clicks - 1))
    return x


save('count', rattle(0.42, 9), 0.35)
save('countlong', rattle(1.0, 14), 0.35)

# Tap: a small ceramic tap, short and dry.
t = seconds(0.1)
x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in ((1450, 1.0, 0.012), (2900, 0.4, 0.007), (4100, 0.25, 0.004)))
x += 0.3 * band(rng.standard_normal(len(t)), 3000, 9000) * np.exp(-t / 0.002)
save('tap', x, 0.35)

# Patter: four quick, soft footfalls, like something small scurrying.
x = np.zeros(int(RATE * 0.36))
foot = seconds(0.05)
step = np.sin(2 * np.pi * 180 * foot) * np.exp(-foot / 0.012) + 0.4 * band(rng.standard_normal(len(foot)), 400, 2500) * np.exp(-foot / 0.006)
for k, at in enumerate((0.0, 0.085, 0.17, 0.25)):
    s0 = int(at * RATE)
    x[s0:s0 + len(step)] += step * (1 - 0.12 * k)
save('patter', x, 0.4)

# Puff: a short, soft breath of air that stops, like a small flame blown out.
t = seconds(0.3)
x = band(rng.standard_normal(len(t)), 150, 1800) * np.minimum(1, t / 0.02) * np.exp(-t / 0.07)
save('puff', x, 0.45)

# Zip: a thread pulled quickly taut, a short grainy rasp that rises.
t = seconds(0.32)
grain = (np.sin(2 * np.pi * (40 + 90 * t / t[-1]) * t * 6) > 0.3).astype(float)
x = band(rng.standard_normal(len(t)), 1500, 7000) * (0.4 + 0.6 * grain) * np.sin(np.pi * t / t[-1]) ** 1.5
save('zip', x, 0.3)

# Glint: a few tiny grains of high sparkle, like light catching sand. No pitch, so never a chime.
x = np.zeros(int(RATE * 0.12))
for at, level in ((0.0, 1.0), (0.024, 0.55), (0.052, 0.3)):
    s0 = int(at * RATE); n = int(RATE * 0.02)
    x[s0:s0 + n] += level * band(rng.standard_normal(n), 6000, 12000) * np.exp(-seconds(0.02) / 0.003)
save('glint', x, 0.25)

# Smack: a mouth opening, a short wet burst with a low bubble in it.
t = seconds(0.12)
x = band(rng.standard_normal(len(t)), 300, 2500) * np.exp(-t / 0.012)
x[int(RATE * 0.008):] += 0.8 * bubble(380, 4, 0.015, 0.112)
save('smack', x, 0.4)

# Crackle: two or three tiny pops from a small flame, over a breath of its air.
t = seconds(0.1)
x = 0.3 * band(rng.standard_normal(len(t)), 200, 900) * np.exp(-t / 0.02)
for at, level in ((0.0, 1.0), (0.028, 0.5), (0.061, 0.75)):
    s0 = int(at * RATE); n = int(RATE * 0.004)
    x[s0:s0 + n] += level * band(rng.standard_normal(n), 800, 9000) * np.exp(-np.arange(n) / (RATE * 0.0008)) * 3
save('crackle', x, 0.4)

# Wobble: jelly settling, a low bubble on each bounce, each one smaller.
x = np.zeros(int(RATE * 0.6))
for k in range(5):
    s0 = int(k / 9 * RATE)
    b = 0.85 ** k * bubble(200 + 12 * k, 2, 0.03, 0.12)
    x[s0:s0 + len(b)] += b[: len(x) - s0]
x += 0.15 * band(rng.standard_normal(len(x)), 150, 900) * np.exp(-seconds(0.6) / 0.15)
save('wobble', x, 0.45)

# Slosh: the last of the water moving in a tipping glass.
t = seconds(0.45)
x = 0.5 * band(rng.standard_normal(len(t)), 300, 3000) * np.sin(np.pi * t / t[-1]) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
for at, f0 in ((0.06, 620), (0.14, 780), (0.21, 540), (0.3, 900)):
    s0 = int(at * RATE)
    b = 0.5 * bubble(f0, 5, 0.018, 0.08)
    x[s0:s0 + len(b)] += b[: len(x) - s0]
save('slosh', x, 0.4)

# Static: a short burst of crackly static, cut on and off at random.
t = seconds(0.22)
gate = np.repeat(rng.random(len(t) // int(RATE * 0.006) + 1) > 0.45, int(RATE * 0.006))[: len(t)]
x = band(rng.standard_normal(len(t)), 1000, 10000) * gate * np.exp(-t / 0.09)
save('static', x, 0.3)

# Slurp: goo pulling itself together, bubbles climbing as it gathers.
x = np.zeros(int(RATE * 0.42))
for k, at in enumerate((0.0, 0.05, 0.1, 0.15, 0.21, 0.27)):
    s0 = int(at * RATE)
    b = (0.6 + 0.08 * k) * bubble(250 + 80 * k, 3, 0.025, 0.1)
    x[s0:s0 + len(b)] += b[: len(x) - s0]
x += 0.2 * band(rng.standard_normal(len(x)), 200, 1500) * np.sin(np.pi * seconds(0.42) / 0.42) ** 2
save('slurp', x, 0.4)

# Ooze: a slow, low spread of goo, a few lazy bubbles in it.
t = seconds(1.0)
x = 0.35 * band(rng.standard_normal(len(t)), 100, 700) * np.sin(np.pi * t / t[-1]) ** 2
for at, f0 in ((0.08, 170), (0.3, 210), (0.52, 150), (0.74, 190)):
    s0 = int(at * RATE)
    b = 0.7 * bubble(f0, 1.5, 0.06, 0.22)
    x[s0:s0 + len(b)] += b[: len(x) - s0]
save('ooze', x, 0.4)

# Blink: a tiny, soft, slightly wet click.
t = seconds(0.05)
x = band(rng.standard_normal(len(t)), 600, 3000) * np.exp(-t / 0.002) + 0.4 * bubble(1700, 3, 0.006, 0.05)
save('blink', x, 0.3)

print('wrote', ', '.join(sorted(p.stem for p in (here / 'sfx').glob('*.wav'))))

"""Synthesises the promo's three quiet sound effects. Standard library only, so it runs anywhere."""
import math, struct, wave, os

RATE = 48000

def write(name, samples, peak=0.5):
    top = max(abs(s) for s in samples) or 1.0
    frames = b''.join(struct.pack('<h', int(s / top * peak * 32767)) for s in samples)
    with wave.open(os.path.join(os.path.dirname(__file__), 'sfx', name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(frames)

def fade_edges(samples, ms=2):
    n = int(RATE * ms / 1000)
    for i in range(min(n, len(samples))):
        samples[i] *= i / n
        samples[-1 - i] *= i / n
    return samples

# Tick: a short, bright wooden click for cuts and word slams.
tick = [(math.sin(2 * math.pi * 2100 * t) + 0.35 * math.sin(2 * math.pi * 4300 * t)) * math.exp(-t / 0.007)
        for t in (i / RATE for i in range(int(RATE * 0.05)))]
write('tick.wav', fade_edges(tick, 0.3), 0.45)

# Pop: the tap on a score, a soft falling blip.
pop, phase = [], 0.0
for i in range(int(RATE * 0.11)):
    t = i / RATE
    freq = 420 + 520 * math.exp(-t / 0.018)
    phase += 2 * math.pi * freq / RATE
    pop.append(math.sin(phase) * math.exp(-t / 0.032))
write('pop.wav', fade_edges(pop, 0.3), 0.55)

# Chime: two soft bell notes for the logo.
def bell(f, t):
    return (math.sin(2 * math.pi * f * t) * math.exp(-t / 0.9)
            + 0.4 * math.sin(2 * math.pi * f * 2.76 * t) * math.exp(-t / 0.35)
            + 0.18 * math.sin(2 * math.pi * f * 5.4 * t) * math.exp(-t / 0.12))
chime = []
for i in range(int(RATE * 2.4)):
    t = i / RATE
    s = bell(1318.5, t)
    if t >= 0.11:
        s += 0.8 * bell(1975.5, t - 0.11)
    chime.append(s * min(1.0, t / 0.003))
write('chime.wav', fade_edges(chime, 20), 0.5)

"""Synthesises the promo's three quiet sound effects: a tick, a pop and a water drop. No musical
notes or instruments. Standard library only, so it runs anywhere."""
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

# Drop: two water drops for the logo, the second smaller. A drop's sound is the tiny bubble it
# traps ringing as it closes, so its pitch climbs quickly and it fades in a few hundredths of
# a second. A few faint reflections give it a little space.
def drop(f0, f1, decay, at, level, out):
    phase = 0.0
    for i in range(int(RATE * decay * 8)):
        t = i / RATE
        freq = f0 + (f1 - f0) * (1 - math.exp(-t / 0.012))
        phase += 2 * math.pi * freq / RATE
        out[int(at * RATE) + i] += level * math.sin(phase) * math.exp(-t / decay) * min(1.0, t / 0.0008)

drops = [0.0] * int(RATE * 1.0)
drop(820, 1750, 0.030, 0.0, 1.0, drops)
drop(1150, 2300, 0.022, 0.36, 0.45, drops)
space = drops[:]
for delay, gain in ((0.023, 0.22), (0.041, 0.14), (0.067, 0.08), (0.101, 0.04)):
    d = int(RATE * delay)
    for i in range(d, len(space)):
        space[i] += gain * drops[i - d]
write('drop.wav', fade_edges(space, 20), 0.5)

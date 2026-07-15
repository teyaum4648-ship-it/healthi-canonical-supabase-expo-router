import { describe, expect, it } from 'vitest';

import {
  circadianEnergyAt,
  computeRestorationFactor,
  deriveEnergyExtrema,
  deriveEnergyZones
} from '../../../src/engines/circadian';
import type { CircadianEnergyPoint } from '../../../src/engines/circadian';

describe('computeRestorationFactor', () => {
  it('rates a full, high-quality, debt-free night higher than a short poor one', () => {
    const rested = computeRestorationFactor({
      quality: 5,
      durationMinutes: 480,
      sleepNeedMinutes: 480,
      avgDebtMinutes: 0
    });
    const depleted = computeRestorationFactor({
      quality: 1,
      durationMinutes: 300,
      sleepNeedMinutes: 480,
      avgDebtMinutes: 150
    });

    expect(rested).toBeGreaterThan(depleted);
    expect(rested).toBeLessThanOrEqual(1);
    expect(depleted).toBeGreaterThanOrEqual(0.15); // floor keeps the curve from collapsing
  });

  it('falls back to a neutral factor when quality is unknown', () => {
    const factor = computeRestorationFactor({ quality: null, durationMinutes: 480, sleepNeedMinutes: 480, avgDebtMinutes: 0 });
    expect(factor).toBeGreaterThan(0.5);
  });
});

describe('circadianEnergyAt', () => {
  const R = 0.9;

  it('is groggy right after waking (sleep inertia)', () => {
    const atWake = circadianEnergyAt(0, 16 * 60, R);
    const morningPeak = circadianEnergyAt(3.5 * 60, 12.5 * 60, R);
    expect(atWake).toBeLessThan(morningPeak);
  });

  it('dips in the early afternoon relative to the morning peak', () => {
    const morningPeak = circadianEnergyAt(3.5 * 60, 12.5 * 60, R);
    const afternoonDip = circadianEnergyAt(7 * 60, 9 * 60, R);
    expect(afternoonDip).toBeLessThan(morningPeak);
  });

  it('under-rested nights lower the whole curve amplitude', () => {
    const restedPeak = circadianEnergyAt(3.5 * 60, 12.5 * 60, 1);
    const tiredPeak = circadianEnergyAt(3.5 * 60, 12.5 * 60, 0.2);
    expect(tiredPeak).toBeLessThan(restedPeak);
  });
});

function point(time: string, energy: number): CircadianEnergyPoint {
  return { time, estimated_energy: energy, label: 'x' };
}

describe('deriveEnergyZones', () => {
  it('splits the curve into contiguous high/moderate/low bands', () => {
    const points = [
      point('2026-06-10T06:00:00.000Z', 30),
      point('2026-06-10T06:20:00.000Z', 55),
      point('2026-06-10T06:40:00.000Z', 80),
      point('2026-06-10T07:00:00.000Z', 40)
    ];
    const zones = deriveEnergyZones(points);
    expect(zones.map((zone) => zone.level)).toEqual(['low', 'moderate', 'high', 'low']);
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].start_at).toBe(zones[i - 1].end_at);
    }
  });
});

describe('deriveEnergyExtrema', () => {
  it('finds prominent peaks and lows but ignores endpoints', () => {
    const points = [
      point('2026-06-10T06:00:00.000Z', 40),
      point('2026-06-10T06:20:00.000Z', 82),
      point('2026-06-10T06:40:00.000Z', 50),
      point('2026-06-10T07:00:00.000Z', 30),
      point('2026-06-10T07:20:00.000Z', 60)
    ];
    const extrema = deriveEnergyExtrema(points);
    expect(extrema).toContainEqual({ type: 'peak', time: '2026-06-10T06:20:00.000Z', energy: 82 });
    expect(extrema).toContainEqual({ type: 'low', time: '2026-06-10T07:00:00.000Z', energy: 30 });
  });
});

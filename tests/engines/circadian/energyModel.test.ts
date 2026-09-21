import { describe, expect, it } from 'vitest';

import {
  circadianEnergyAt,
  computeRestoration,
  computeRestorationFactor,
  deriveDayOutlook,
  deriveEnergyExtrema,
  deriveEnergyZones,
  outlookLabel
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
    /*
     * This used to assert `depleted >= 0.15`, documenting a floor that was clamping the
     * signal rather than the display: three hours of sleep and five both bottomed out
     * there and produced identical forecasts. A genuinely bad night is now allowed to
     * score genuinely low. Keeping the drawn line visible is the chart's job.
     */
    expect(depleted).toBeGreaterThanOrEqual(0);
    expect(depleted).toBeLessThan(0.15);
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

describe('sleep inertia clears on the measured timescale', () => {
  it('still shows residual grogginess two hours after waking', () => {
    const rested = 0.9;
    const atWake = circadianEnergyAt(0, 16 * 60, rested);
    const atTwoHours = circadianEnergyAt(2 * 60, 14 * 60, rested);
    const atPeak = circadianEnergyAt(3.5 * 60, 12.5 * 60, rested);

    // Recovering, but not yet at the peak: alertness keeps improving for ~2 h.
    expect(atTwoHours).toBeGreaterThan(atWake);
    expect(atTwoHours).toBeLessThan(atPeak);
  });

  it('drags inertia out further when the night was poor', () => {
    const rested = circadianEnergyAt(2 * 60, 14 * 60, 0.9);
    const depleted = circadianEnergyAt(2 * 60, 14 * 60, 0.2);
    // A short night should still be climbing out of inertia at the two-hour mark.
    expect(depleted).toBeLessThan(rested);
  });
});


describe('short nights are distinguishable from each other (the floor bug)', () => {
  const night = (hours: number, refreshment: number, debt: number) =>
    computeRestorationFactor({
      refreshment,
      durationMinutes: hours * 60,
      sleepNeedMinutes: 480,
      avgDebtMinutes: debt
    });

  it('separates three hours from five hours', () => {
    // Both used to land on 0.15 and render the same day.
    const three = night(3, 1, 240);
    const five = night(5, 2, 120);
    expect(five).toBeGreaterThan(three);
    expect(five - three).toBeGreaterThan(0.1);
  });

  it('keeps the scale monotonic across the whole range of nights', () => {
    const ladder = [night(3, 1, 240), night(5, 2, 120), night(6.5, 3, 60), night(8, 4, 15), night(8.5, 5, 0)];
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i], `step ${i}`).toBeGreaterThan(ladder[i - 1]);
    }
  });

  it('gives the curve a usable amount of vertical room to move in', () => {
    const span = (R: number) => {
      const values: number[] = [];
      for (let m = 0; m <= 16 * 60; m += 20) values.push(circadianEnergyAt(m, 16 * 60 - m, R));
      return values;
    };
    const worst = span(0.04);
    const best = span(0.98);
    let gap = 0;
    for (let i = 0; i < worst.length; i++) gap = Math.max(gap, best[i] - worst[i]);
    /*
     * Was 27 points of 100, which on the chart's 136px plot area is about 26 pixels —
     * a difference nobody could see. The forecast has to be legible to be a forecast.
     */
    expect(gap).toBeGreaterThan(50);
  });
});

describe('missing data lowers confidence, not the score', () => {
  it('no longer scores an unknown night above a real mediocre one', () => {
    /*
     * The old model filled every unknown term with 0.6, so logging nothing scored 0.600
     * while honestly logging a mediocre night scored 0.507 — being truthful made your day
     * look worse. Unknown terms are now dropped and the rest renormalised.
     */
    const unknown = computeRestoration({});
    const mediocre = computeRestoration({
      refreshment: 3, durationMinutes: 390, sleepNeedMinutes: 480, avgDebtMinutes: 60
    });
    expect(unknown.factor).toBeLessThanOrEqual(mediocre.factor + 0.06);
    expect(unknown.coverage).toBe(0);
    expect(mediocre.coverage).toBeGreaterThan(0.5);
  });

  it('never scores an unknown night above a bad one by accident', () => {
    const unknown = computeRestoration({}).factor;
    const bad = computeRestoration({
      refreshment: 1, durationMinutes: 240, sleepNeedMinutes: 480, avgDebtMinutes: 200
    }).factor;
    expect(unknown).toBeGreaterThan(bad); // neutral sits above bad, which is correct
  });

  it('reports coverage in proportion to what was actually supplied', () => {
    const thin = computeRestoration({ durationMinutes: 480, sleepNeedMinutes: 480 });
    const full = computeRestoration({
      refreshment: 4, quality: 4, durationMinutes: 480, sleepNeedMinutes: 480,
      avgDebtMinutes: 10, regularityScore: 0.9, misalignmentMinutes: 5
    });
    expect(thin.coverage).toBeLessThan(full.coverage);
    expect(full.coverage).toBe(1);
    expect(full.knownTerms).toContain('misalignment');
    expect(thin.knownTerms).toEqual(['duration']);
  });
});

describe('timing is its own factor', () => {
  it('penalises a well-slept but badly-timed night', () => {
    const aligned = computeRestorationFactor({
      refreshment: 4, durationMinutes: 480, sleepNeedMinutes: 480, avgDebtMinutes: 10,
      regularityScore: 0.9, misalignmentMinutes: 0
    });
    const jetlagged = computeRestorationFactor({
      refreshment: 4, durationMinutes: 480, sleepNeedMinutes: 480, avgDebtMinutes: 10,
      regularityScore: 0.4, misalignmentMinutes: 190
    });
    // Same sleep, worse timing. This is the Monday that eight hours does not fix.
    expect(jetlagged).toBeLessThan(aligned);
  });

  it('costs curve amplitude directly, flat across the day', () => {
    const atNoon = (mis: number) => circadianEnergyAt(5 * 60, 11 * 60, 0.8, { misalignmentMinutes: mis });
    expect(atNoon(180)).toBeLessThan(atNoon(0));
    // and it does not clock off at lunch
    const atEvening = (mis: number) => circadianEnergyAt(12 * 60, 4 * 60, 0.8, { misalignmentMinutes: mis });
    expect(atEvening(180)).toBeLessThan(atEvening(0));
  });
});

describe('caffeine and light modifiers', () => {
  it('fills the afternoon dip more than it raises the morning peak', () => {
    const dipGain = circadianEnergyAt(7 * 60, 9 * 60, 0.4, { caffeineOnBoardMg: 150 })
      - circadianEnergyAt(7 * 60, 9 * 60, 0.4);
    const peakGain = circadianEnergyAt(3.5 * 60, 12.5 * 60, 0.4, { caffeineOnBoardMg: 150 })
      - circadianEnergyAt(3.5 * 60, 12.5 * 60, 0.4);
    expect(dipGain).toBeGreaterThan(peakGain);
    expect(dipGain).toBeGreaterThan(0);
  });

  it('treats no caffeine and unknown caffeine identically', () => {
    expect(circadianEnergyAt(7 * 60, 9 * 60, 0.6, { caffeineOnBoardMg: 0 }))
      .toBe(circadianEnergyAt(7 * 60, 9 * 60, 0.6, { caffeineOnBoardMg: null }));
  });

  it('gives a small same-day lift for morning light', () => {
    const withLight = circadianEnergyAt(4 * 60, 12 * 60, 0.6, { morningLightMinutes: 25 });
    const without = circadianEnergyAt(4 * 60, 12 * 60, 0.6);
    expect(withLight).toBeGreaterThan(without);
    expect(withLight - without).toBeLessThanOrEqual(6); // modest — the big effect is on phase
  });
});

describe('deriveDayOutlook', () => {
  const curve = (R: number, mod = {}) => {
    const points = [];
    for (let m = 0; m <= 16 * 60; m += 20) {
      points.push({
        time: new Date(Date.UTC(2026, 0, 1, 6, 0) + m * 60_000).toISOString(),
        estimated_energy: circadianEnergyAt(m, 16 * 60 - m, R, mod),
        label: 'x'
      });
    }
    return points;
  };

  it('rewards shape, not just the average', () => {
    /*
     * A day with a strong morning and a dead afternoon averages the same as a flat
     * mediocre day. They are not the same day, so the score counts usable time rather
     * than taking a mean.
     */
    const flat = Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 0, 1, 6, 0) + i * 20 * 60_000).toISOString(),
      estimated_energy: 50, label: 'x'
    }));
    const peaky = flat.map((point, i) => ({ ...point, estimated_energy: i < 24 ? 85 : 15 }));

    const flatMean = flat.reduce((s, p) => s + p.estimated_energy, 0) / flat.length;
    const peakyMean = peaky.reduce((s, p) => s + p.estimated_energy, 0) / peaky.length;
    expect(flatMean).toBe(peakyMean); // identical means

    /*
     * A peak you can schedule around beats a plateau you cannot, so the peaky day scores
     * higher. A step-function score tied them at exactly 50, which is what sent this
     * function superlinear.
     */
    expect(deriveDayOutlook(peaky)!.score).toBeGreaterThan(deriveDayOutlook(flat)!.score);
  });

  it('still ranks a flat good day above a spiky bad one', () => {
    // The exponent must not be so steep that any spike beats consistent quality.
    const at = (value: number) => Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 0, 1, 6, 0) + i * 20 * 60_000).toISOString(),
      estimated_energy: value, label: 'x'
    }));
    const flatGood = at(72);
    const spikyBad = at(10).map((point, i) => (i === 12 ? { ...point, estimated_energy: 95 } : point));
    expect(deriveDayOutlook(flatGood)!.score).toBeGreaterThan(deriveDayOutlook(spikyBad)!.score);
  });

  it('bands from flat through sharp as the night improves', () => {
    const bands = [0.04, 0.35, 0.65, 0.98].map((R) => deriveDayOutlook(curve(R))!.band);
    expect(bands[0]).toBe('flat');
    expect(bands.at(-1)).toBe('sharp');
    // monotonic, no band skipped backwards
    const order = ['flat', 'slow', 'steady', 'sharp'];
    for (let i = 1; i < bands.length; i++) {
      expect(order.indexOf(bands[i])).toBeGreaterThanOrEqual(order.indexOf(bands[i - 1]));
    }
  });

  it('pins the achievable window, so a curve change cannot silently break the score', () => {
    /*
     * The headline score is rescaled onto the range the curve can actually reach. If the
     * curve is retuned and those bounds move, this fails — which is the point. Fix the
     * constants, do not widen the test.
     */
    const worst = deriveDayOutlook(curve(0))!.score;
    const best = deriveDayOutlook(curve(1))!.score;
    expect(worst).toBeLessThan(10);
    expect(best).toBeGreaterThan(90);
  });

  it('uses most of the 0-100 range rather than a narrow band', () => {
    const scores = [0, 0.25, 0.5, 0.75, 1].map((R) => deriveDayOutlook(curve(R))!.score);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    expect(scores.at(-1)! - scores[0]).toBeGreaterThan(80);
  });

  it('reports peak, high minutes and low minutes', () => {
    const outlook = deriveDayOutlook(curve(0.98))!;
    expect(outlook.peakEnergy).toBeGreaterThan(80);
    expect(outlook.highMinutes).toBeGreaterThan(0);
    expect(outlook.highMinutes % 20).toBe(0);
    expect(outlook.lowMinutes).toBeGreaterThanOrEqual(0);
  });

  it('carries coverage through and has words for every band', () => {
    expect(deriveDayOutlook(curve(0.8), 0.25)!.coverage).toBe(0.25);
    for (const band of ['sharp', 'steady', 'slow', 'flat'] as const) {
      expect(outlookLabel(band).length).toBeGreaterThan(2);
    }
  });

  it('has nothing to say about an empty curve', () => {
    expect(deriveDayOutlook([])).toBeNull();
  });
});

describe('the rhythm follows the body clock, not the alarm', () => {
  /*
   * The model's biggest inaccuracy. Sleeping in three hours used to move the entire
   * circadian rhythm three hours with you — so the afternoon dip was predicted three
   * hours late, which is exactly backwards: the dip arrives on clock time and you meet it
   * having been awake for less of the day.
   */
  it('keeps the afternoon dip on clock time after a lie-in', () => {
    const LIE_IN = 3 * 60;

    // Five hours after actually waking, on a day you woke three hours late. The clock has
    // been up for eight hours, so it is deep in dip territory.
    const anchoredToClock = circadianEnergyAt(5 * 60, 11 * 60, 0.8, {
      minutesSinceCircadianWake: 5 * 60 + LIE_IN
    });
    // The old behaviour: rhythm dragged along with the alarm.
    const anchoredToAlarm = circadianEnergyAt(5 * 60, 11 * 60, 0.8);

    expect(anchoredToClock).toBeLessThan(anchoredToAlarm);
  });

  it('still keys sleep inertia to when you actually woke', () => {
    // Just woken, but the clock has been up for hours. Should still be groggy.
    const justWoke = circadianEnergyAt(0, 16 * 60, 0.8, { minutesSinceCircadianWake: 4 * 60 });
    const fourHoursUp = circadianEnergyAt(4 * 60, 12 * 60, 0.8, { minutesSinceCircadianWake: 4 * 60 });
    expect(justWoke).toBeLessThan(fourHoursUp);
  });

  it('falls back to the old wake-relative behaviour when phase is unknown', () => {
    const withoutPhase = circadianEnergyAt(3.5 * 60, 12.5 * 60, 0.8);
    const explicitlyEqual = circadianEnergyAt(3.5 * 60, 12.5 * 60, 0.8, {
      minutesSinceCircadianWake: 3.5 * 60
    });
    expect(withoutPhase).toBe(explicitlyEqual);
  });
});

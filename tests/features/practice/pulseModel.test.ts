import { describe, expect, it } from 'vitest';

import {
  bpmFromCount,
  comparePulse,
  isPlausibleBpm,
  isRestingContext,
  pulseBaseline,
  summarisePulseDay,
  type PulseContext,
  type PulseReading
} from '../../../src/features/practice/pulseModel';

function reading(bpm: number, context: PulseContext = 'sitting', takenAt = '2026-09-16T08:00:00.000Z'): PulseReading {
  return { id: `r-${bpm}-${takenAt}`, date: '2026-09-16', bpm, context, method: 'counted', takenAt };
}

describe('bpmFromCount', () => {
  it('scales a fifteen-second count to a minute', () => {
    expect(bpmFromCount(15)).toBe(60);
    expect(bpmFromCount(18)).toBe(72);
  });

  it('honours a different window', () => {
    expect(bpmFromCount(30, 30)).toBe(60);
  });
});

describe('isPlausibleBpm', () => {
  it('accepts a human pulse and rejects a typo', () => {
    expect(isPlausibleBpm(58)).toBe(true);
    expect(isPlausibleBpm(7)).toBe(false);
    expect(isPlausibleBpm(600)).toBe(false);
    expect(isPlausibleBpm(60.5)).toBe(false);
    expect(isPlausibleBpm(Number.NaN)).toBe(false);
  });
});

describe('pulseBaseline', () => {
  it('has nothing to say with no resting readings', () => {
    expect(pulseBaseline([])).toBeNull();
    expect(pulseBaseline([reading(140, 'after_moving')])).toBeNull();
  });

  it('excludes non-resting readings from the baseline', () => {
    /*
     * The whole point of asking what someone was doing. A post-stairs 150 must not move
     * the reference point that later readings are judged against.
     */
    const readings = [reading(60), reading(62), reading(58), reading(61), reading(59)];
    const clean = pulseBaseline(readings);
    const polluted = pulseBaseline([...readings, reading(150, 'after_moving'), reading(148, 'after_moving')]);

    expect(clean?.median).toBe(60);
    expect(polluted?.median).toBe(clean?.median);
    expect(polluted?.sampleSize).toBe(5);
  });

  it('resists a single wild resting reading, where a mean would not', () => {
    const steady = [reading(60), reading(61), reading(59), reading(60), reading(61)];
    const withOutlier = [...steady, reading(190)];

    const clean = pulseBaseline(steady)!;
    const polluted = pulseBaseline(withOutlier)!;

    // What a mean would have done to the reference point.
    const mean = withOutlier.reduce((sum, r) => sum + r.bpm, 0) / withOutlier.length;
    expect(mean).toBeGreaterThan(80);

    /*
     * The median shifts by at most a beat — adding a sixth value makes the list even, so
     * it lands between the two middle readings rather than on one. That is the property
     * being bought here, not a fixed number.
     */
    expect(Math.abs(polluted.median - clean.median)).toBeLessThanOrEqual(1);
    expect(polluted.median).toBeLessThan(65);

    // And the spread stays usable rather than swallowing every future reading.
    expect(polluted.spread).toBeLessThan(10);
  });

  it('never reports zero spread, even when every reading is identical', () => {
    const baseline = pulseBaseline([reading(60), reading(60), reading(60)]);
    expect(baseline?.spread).toBeGreaterThanOrEqual(2);
  });

  it('grades its own confidence by sample size', () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => reading(60, 'sitting', `2026-09-16T08:${String(i).padStart(2, '0')}:00.000Z`));
    expect(pulseBaseline(make(1))?.confidence).toBe('thin');
    expect(pulseBaseline(make(4))?.confidence).toBe('thin');
    expect(pulseBaseline(make(5))?.confidence).toBe('building');
    expect(pulseBaseline(make(14))?.confidence).toBe('building');
    expect(pulseBaseline(make(15))?.confidence).toBe('settled');
  });
});

describe('comparePulse', () => {
  const baseline = { median: 60, spread: 3, sampleSize: 20, confidence: 'settled' as const };

  it('calls a reading inside the spread typical', () => {
    expect(comparePulse(62, baseline).band).toBe('typical');
    expect(comparePulse(57, baseline).band).toBe('typical');
  });

  it('bands by multiples of the spread, in both directions', () => {
    expect(comparePulse(65, baseline).band).toBe('above');
    expect(comparePulse(80, baseline).band).toBe('well_above');
    expect(comparePulse(55, baseline).band).toBe('below');
    expect(comparePulse(40, baseline).band).toBe('well_below');
  });

  it('reports the signed distance from the median', () => {
    expect(comparePulse(74, baseline).delta).toBe(14);
    expect(comparePulse(46, baseline).delta).toBe(-14);
  });

  it('never names a cause', () => {
    /*
     * A single pulse count cannot tell a hard week from a cold coming on. Guessing
     * between them is the line between a wellness reading and a diagnosis, so the copy
     * is held to the arithmetic.
     */
    const { headline, detail } = comparePulse(82, baseline);
    const forbidden = /stress|anxious|anxiety|sick|illness|infection|overtrain|diagnos|condition|disease/i;
    expect(headline).not.toMatch(forbidden);
    expect(detail).not.toMatch(forbidden);
  });

  it('says out loud when the baseline is too thin to lean on', () => {
    const thin = { median: 60, spread: 2, sampleSize: 2, confidence: 'thin' as const };
    expect(comparePulse(90, thin).detail).toMatch(/loosely/);
    expect(comparePulse(90, baseline).detail).not.toMatch(/loosely/);
  });
});

describe('contexts', () => {
  it('treats only genuinely quiet states as resting', () => {
    expect(isRestingContext('waking')).toBe(true);
    expect(isRestingContext('sitting')).toBe(true);
    expect(isRestingContext('after_moving')).toBe(false);
    expect(isRestingContext('after_caffeine')).toBe(false);
    expect(isRestingContext('wound_up')).toBe(false);
  });
});

describe('summarisePulseDay', () => {
  it('keeps only today, in the order taken', () => {
    const rows: PulseReading[] = [
      reading(60, 'sitting', '2026-09-16T09:00:00.000Z'),
      reading(58, 'sitting', '2026-09-16T07:00:00.000Z'),
      { ...reading(70), date: '2026-09-15' }
    ];
    const day = summarisePulseDay(rows, '2026-09-16');
    expect(day.readings.map((r) => r.bpm)).toEqual([58, 60]);
    expect(day.latest?.bpm).toBe(60);
  });

  it('has no latest on an empty day', () => {
    expect(summarisePulseDay([], '2026-09-16').latest).toBeNull();
  });
});

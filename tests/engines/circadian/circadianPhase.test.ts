import { describe, expect, it } from 'vitest';

import {
  circularDifference,
  circularMeanMinutes,
  circularSdMinutes,
  describeMisalignment,
  estimateCircadianPhase,
  LIGHT_ADVANCE_BONUS_MINUTES,
  MAX_PHASE_ADVANCE_MINUTES,
  MAX_PHASE_DELAY_MINUTES,
  midSleepMinutes
} from '../../../src/engines/circadian/circadianPhase';
import type { SleepSession } from '../../../src/engines/circadian/types';

/** A night, given as local clock times. `date` is the morning it ends on. */
function night(date: string, bedHour: number, bedMin: number, wakeHour: number, wakeMin: number): SleepSession {
  const prev = new Date(`${date}T00:00:00`);
  prev.setDate(prev.getDate() - 1);
  const startDay = bedHour >= 12
    ? `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
    : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date,
    sleep_start_at: `${startDay}T${pad(bedHour)}:${pad(bedMin)}:00`,
    sleep_end_at: `${date}T${pad(wakeHour)}:${pad(wakeMin)}:00`,
    duration_minutes: null,
    sleep_quality: null,
    source: 'manual',
    source_confidence: 'high'
  } as SleepSession;
}

describe('circularDifference', () => {
  it('takes the short way round midnight', () => {
    // 23:30 -> 00:30 is one hour later, not twenty-three hours earlier.
    expect(circularDifference(30, 23 * 60 + 30)).toBe(60);
    expect(circularDifference(23 * 60 + 30, 30)).toBe(-60);
  });

  it('is zero for the same time and stays within half a day', () => {
    expect(circularDifference(500, 500)).toBe(0);
    for (const [a, b] of [[0, 719], [0, 721], [100, 900], [1439, 1]]) {
      expect(Math.abs(circularDifference(a, b))).toBeLessThanOrEqual(720);
    }
  });
});

describe('circularMeanMinutes', () => {
  it('averages across midnight correctly, where a plain mean would not', () => {
    // 23:00 and 01:00 average to midnight. An arithmetic mean says 12:00 — the opposite
    // side of the clock, and the exact bug this function exists to avoid.
    const mean = circularMeanMinutes([23 * 60, 1 * 60])!;
    expect(Math.min(mean, 1440 - mean)).toBeLessThan(2);

    const arithmetic = (23 * 60 + 1 * 60) / 2;
    expect(arithmetic).toBe(720); // midday — wrong by twelve hours
  });

  it('returns the value itself for a single time', () => {
    expect(Math.round(circularMeanMinutes([480])!)).toBe(480);
  });

  it('has no mean for times spread evenly around the clock', () => {
    expect(circularMeanMinutes([0, 360, 720, 1080])).toBeNull();
  });

  it('has nothing to say about an empty set', () => {
    expect(circularMeanMinutes([])).toBeNull();
  });
});

describe('circularSdMinutes', () => {
  it('is zero when every night is identical', () => {
    expect(circularSdMinutes([180, 180, 180, 180])).toBe(0);
  });

  it('grows as nights scatter', () => {
    const tight = circularSdMinutes([180, 190, 175, 185])!;
    const loose = circularSdMinutes([60, 300, 120, 420])!;
    expect(tight).toBeLessThan(loose);
    expect(tight).toBeLessThan(15);
  });

  it('does not blow up across midnight', () => {
    // 23:50, 00:00, 00:10 is a twenty-minute spread.
    const sd = circularSdMinutes([23 * 60 + 50, 0, 10])!;
    expect(sd).toBeLessThan(20);
  });

  it('needs at least two nights', () => {
    expect(circularSdMinutes([480])).toBeNull();
  });
});

describe('midSleepMinutes', () => {
  it('finds the midpoint of a night that crosses midnight', () => {
    // 23:00 to 07:00 -> mid-sleep 03:00.
    expect(midSleepMinutes(night('2026-09-21', 23, 0, 7, 0))).toBe(180);
  });

  it('rejects a window that does not move forward', () => {
    expect(midSleepMinutes({ sleep_start_at: '2026-09-21T07:00:00', sleep_end_at: '2026-09-21T07:00:00' })).toBeNull();
    expect(midSleepMinutes({ sleep_start_at: 'nonsense', sleep_end_at: '2026-09-21T07:00:00' })).toBeNull();
  });
});

describe('estimateCircadianPhase', () => {
  const steady = Array.from({ length: 14 }, (_, i) =>
    night(`2026-09-${String(i + 1).padStart(2, '0')}`, 23, 0, 7, 0));

  it('settles on the habitual rhythm when nights are consistent', () => {
    const estimate = estimateCircadianPhase({ sessions: steady })!;
    expect(estimate.phaseMinutes).toBe(180); // 03:00
    expect(estimate.misalignmentMinutes).toBe(0);
    expect(estimate.regularitySdMinutes).toBe(0);
    expect(estimate.regularityScore).toBe(1);
    expect(estimate.confidence).toBe('high');
  });

  it('does NOT move the clock a full night when one lie-in happens', () => {
    /*
     * The bug this module exists to fix. Two weeks of 23:00-07:00, then one Sunday of
     * 02:00-11:00 — a three-and-a-half hour shift in behaviour. The clock may move by at
     * most one night's drift, so the person is left misaligned rather than relocated.
     */
    const lieIn = [...steady, night('2026-09-15', 2, 0, 11, 0)];
    const estimate = estimateCircadianPhase({ sessions: lieIn })!;

    const behaviouralShift = estimate.behaviouralMinutes! - 180;
    expect(behaviouralShift).toBeGreaterThan(200); // behaviour moved 3.5h

    const clockShift = estimate.phaseMinutes - 180;
    expect(clockShift).toBeLessThanOrEqual(MAX_PHASE_DELAY_MINUTES);
    expect(estimate.misalignmentMinutes).toBeGreaterThan(120); // and it shows up as misalignment
  });

  it('caps an advance more tightly than a delay, because advancing is harder', () => {
    expect(MAX_PHASE_ADVANCE_MINUTES).toBeLessThan(MAX_PHASE_DELAY_MINUTES);

    const earlier = [...steady, night('2026-09-15', 20, 0, 4, 0)]; // mid-sleep 00:00, 3h earlier
    const estimate = estimateCircadianPhase({ sessions: earlier })!;
    const moved = circularDifference(estimate.phaseMinutes, 180);
    expect(moved).toBeGreaterThanOrEqual(-MAX_PHASE_ADVANCE_MINUTES);
    expect(moved).toBeLessThan(0);
  });

  it('lets morning light buy extra advance on the day it was logged', () => {
    const earlier = [...steady, night('2026-09-15', 20, 0, 4, 0)];
    const without = estimateCircadianPhase({ sessions: earlier })!;
    const withLight = estimateCircadianPhase({ sessions: earlier, morningLightDates: ['2026-09-15'] })!;

    const movedWithout = Math.abs(circularDifference(without.phaseMinutes, 180));
    const movedWith = Math.abs(circularDifference(withLight.phaseMinutes, 180));
    expect(movedWith).toBeGreaterThan(movedWithout);
    expect(movedWith - movedWithout).toBeLessThanOrEqual(LIGHT_ADVANCE_BONUS_MINUTES + 1);
  });

  it('reports low confidence and no regularity from a single night', () => {
    const estimate = estimateCircadianPhase({ sessions: [steady[0]] })!;
    expect(estimate.nightsUsed).toBe(1);
    expect(estimate.confidence).toBe('low');
    expect(estimate.regularitySdMinutes).toBeNull();
    expect(estimate.regularityScore).toBeNull();
  });

  it('scores an irregular schedule below a regular one', () => {
    const irregular = [
      night('2026-09-01', 22, 0, 6, 0), night('2026-09-02', 1, 0, 9, 0),
      night('2026-09-03', 23, 30, 6, 30), night('2026-09-04', 3, 0, 11, 0),
      night('2026-09-05', 21, 0, 5, 0), night('2026-09-06', 2, 0, 10, 0)
    ];
    const messy = estimateCircadianPhase({ sessions: irregular })!;
    const tidy = estimateCircadianPhase({ sessions: steady.slice(0, 6) })!;
    expect(messy.regularityScore!).toBeLessThan(tidy.regularityScore!);
    expect(messy.regularitySdMinutes!).toBeGreaterThan(60);
  });

  it('ignores unusable sessions and returns null when none survive', () => {
    expect(estimateCircadianPhase({ sessions: [] })).toBeNull();
    expect(estimateCircadianPhase({
      sessions: [{ ...steady[0], sleep_start_at: null, sleep_end_at: null } as SleepSession]
    })).toBeNull();
  });

  it('only looks at the trailing window', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      night(`2026-09-${String((i % 28) + 1).padStart(2, '0')}`, 23, 0, 7, 0));
    expect(estimateCircadianPhase({ sessions: many, windowNights: 7 })!.nightsUsed).toBe(7);
  });
});

describe('describeMisalignment', () => {
  it('calls a small gap in step', () => {
    expect(describeMisalignment(0)).toMatch(/In step/);
    expect(describeMisalignment(25)).toMatch(/In step/);
  });

  it('names the direction', () => {
    expect(describeMisalignment(150)).toBe('2h 30m later than your usual rhythm');
    expect(describeMisalignment(-90)).toBe('1h 30m earlier than your usual rhythm');
    expect(describeMisalignment(45)).toBe('45m later than your usual rhythm');
  });

  it('has nothing to say without data', () => {
    expect(describeMisalignment(null)).toBeNull();
  });
});

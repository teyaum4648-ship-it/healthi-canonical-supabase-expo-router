import { describe, expect, it } from 'vitest';

import {
  BREATH_RHYTHMS,
  cycleMs,
  cyclesInMinutes,
  practiceDayLine,
  rhythmById,
  summarisePracticeDay
} from '../../../src/features/practice/practiceModel';

function session(overrides: { date: string; seconds: number; rhythmId?: string; at?: string }) {
  return {
    id: `${overrides.date}-${overrides.seconds}`,
    date: overrides.date,
    rhythmId: overrides.rhythmId ?? 'settle',
    seconds: overrides.seconds,
    finishedAt: overrides.at ?? `${overrides.date}T09:00:00.000Z`
  };
}

describe('paced breathing, as a rhythm rather than a hard-coded circle', () => {
  it('keeps a zero hold in the cycle length rather than dropping the step', () => {
    const settle = rhythmById('settle');
    expect(settle.holdMs).toBe(0);
    expect(cycleMs(settle)).toBe(12_000);
  });

  it('preserves the pace the sleep screen already used', () => {
    // 4s in, a pause at the top, 5s out. Changing this silently would change a
    // behaviour people have already been following before bed.
    const wind = rhythmById('wind_down');
    expect([wind.inhaleMs, wind.holdMs, wind.exhaleMs]).toEqual([4000, 3500, 5000]);
  });

  it('gives every rhythm a stated reason', () => {
    // A ratio with nothing behind it is a number somebody picked.
    for (const rhythm of BREATH_RHYTHMS) {
      expect(rhythm.purpose.length).toBeGreaterThan(20);
    }
  });

  it('never offers less than one cycle', () => {
    expect(cyclesInMinutes(rhythmById('zone'), 0)).toBe(1);
    expect(cyclesInMinutes(rhythmById('steady'), 2)).toBe(10);
  });

  it('counts only today, and says so plainly', () => {
    const day = summarisePracticeDay([
      session({ date: '2026-09-14', seconds: 300 }),
      session({ date: '2026-09-15', seconds: 90, at: '2026-09-15T08:00:00.000Z' }),
      session({ date: '2026-09-15', seconds: 150, at: '2026-09-15T19:00:00.000Z', rhythmId: 'wind_down' })
    ], '2026-09-15');
    expect(day.sessions).toHaveLength(2);
    expect(day.totalSeconds).toBe(240);
    // The last one done is the one worth offering again.
    expect(day.lastRhythm?.id).toBe('wind_down');
    expect(practiceDayLine(day)).toBe('4 minutes today, across 2 sessions.');
  });

  it('says nothing yet rather than zero', () => {
    const day = summarisePracticeDay([], '2026-09-15');
    expect(day.lastRhythm).toBeNull();
    expect(practiceDayLine(day)).toBe('Nothing yet today.');
  });
});

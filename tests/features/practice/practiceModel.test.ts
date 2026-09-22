import { describe, expect, it } from 'vitest';

import {
  BREATH_TECHNIQUES,
  cycleMs,
  cyclesInMinutes,
  techniqueById
} from '../../../src/features/practice/breathTechniques';
import {
  practiceDayLine,
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

describe('paced breathing, as named techniques rather than one circle with a dial', () => {
  it('sums a cycle from its phases', () => {
    expect(cycleMs(techniqueById('settle'))).toBe(12_000);
  });

  it('preserves the pace the sleep screen already used', () => {
    // 4s in, a pause at the top, 5s out. Changing this silently would change a
    // behaviour people have already been following before bed.
    expect(techniqueById('wind_down').phases.map((phase) => [phase.kind, phase.ms])).toEqual([
      ['inhale', 4000],
      ['hold', 3500],
      ['exhale', 5000]
    ]);
  });

  it('gives every technique a stated when and why', () => {
    // A ratio with nothing behind it is a number somebody picked.
    for (const technique of BREATH_TECHNIQUES) {
      expect(technique.when.length, technique.id).toBeGreaterThan(30);
      expect(technique.why.length, technique.id).toBeGreaterThan(60);
      expect(technique.summary.length, technique.id).toBeGreaterThan(10);
    }
  });

  it('never offers less than one cycle', () => {
    expect(cyclesInMinutes(techniqueById('zone'), 0)).toBe(1);
    expect(cyclesInMinutes(techniqueById('steady'), 2)).toBe(10);
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
    expect(day.lastTechnique?.id).toBe('wind_down');
    expect(practiceDayLine(day)).toBe('4 minutes today, across 2 sessions.');
  });

  it('says nothing yet rather than zero', () => {
    const day = summarisePracticeDay([], '2026-09-15');
    expect(day.lastTechnique).toBeNull();
    expect(practiceDayLine(day)).toBe('Nothing yet today.');
  });
});

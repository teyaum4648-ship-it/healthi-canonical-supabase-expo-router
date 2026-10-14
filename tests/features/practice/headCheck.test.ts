import { describe, expect, it } from 'vitest';

import { calculateMindScore } from '../../../src/engines/mind';
import { createHeadCheck, headShift, latestHeadCheck, shiftsByTechnique } from '../../../src/features/practice/headCheck';

const date = '2026-07-14';
const at = (time: string) => `${date}T${time}:00.000Z`;

describe('How’s your head?', () => {
  it('describes a shift in the person’s own words', () => {
    expect(headShift(2, 4).line).toBe('Tense → Steady. That helped.');
    expect(headShift(3, 3).line).toBe('Okay → Okay. Holding steady.');
    expect(headShift(4, 3).change).toBe(-1);
  });

  it('reads the latest answer of the day', () => {
    const rows = [
      createHeadCheck({ date, rating: 2, moment: 'now', at: at('08:00') }),
      createHeadCheck({ date, rating: 5, moment: 'now', at: at('12:00') }),
      createHeadCheck({ date: '2026-07-15', rating: 1, moment: 'now', at: '2026-07-15T08:00:00.000Z' })
    ];
    expect(latestHeadCheck(rows, date)?.rating).toBe(5);
    expect(latestHeadCheck(rows, '2026-07-16')).toBeNull();
  });

  it('learns which technique helps from before-and-after pairs', () => {
    const rows = [
      createHeadCheck({ date, rating: 2, moment: 'before', techniqueId: 'settle', at: at('08:00') }),
      createHeadCheck({ date, rating: 4, moment: 'after', techniqueId: 'settle', at: at('08:06') }),
      createHeadCheck({ date, rating: 3, moment: 'before', techniqueId: 'steady', at: at('12:00') }),
      createHeadCheck({ date, rating: 3, moment: 'after', techniqueId: 'steady', at: at('12:05') }),
      // An answer after with no matching before an hour earlier is not a pair.
      createHeadCheck({ date, rating: 5, moment: 'after', techniqueId: 'settle', at: at('18:00') })
    ];
    expect(shiftsByTechnique(rows)).toEqual([
      { techniqueId: 'settle', sessions: 1, averageChange: 2 },
      { techniqueId: 'steady', sessions: 1, averageChange: 0 }
    ]);
  });

  it('feeds the Mind + Life Load score', () => {
    const base = { date, scheduleBlocks: 3, checkin: { demand: 'usual' as const, energy: 'steady' as const } };
    const clear = calculateMindScore({ ...base, head: { rating: 5 } });
    const overloaded = calculateMindScore({ ...base, head: { rating: 1 } });
    expect(clear.score).not.toBeNull();
    expect(clear.score!).toBeGreaterThan(overloaded.score!);
    expect(overloaded.limiters[0]?.id).toBe('head');
    expect(overloaded.suggestion.reason_codes).toContain('limited_by_head');
  });
});

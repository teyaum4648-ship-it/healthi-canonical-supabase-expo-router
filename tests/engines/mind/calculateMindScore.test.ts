import { describe, expect, it } from 'vitest';

import { calculateMindScore, type MindScoreInput } from '../../../src/engines/mind';

const day = '2026-10-01';
const full: MindScoreInput = {
  date: day,
  sleep: { minutes: 480, needMinutes: 480 },
  scheduleBlocks: 3,
  checkin: { demand: 'usual', energy: 'steady' },
  pulseBand: 'typical',
  resets: { breathingSeconds: 180, tensionReleases: 0, morningLightMinutes: 10, habitsDone: 1 }
};

const CLINICAL = /diagnos|treat|cure|prescri|cortisol|adrenal|hormone|anxiety|depress|disorder|clinical|guarantee/i;

describe('Mind + Life Load score', () => {
  it('scores a well-supported day high, with every term explained', () => {
    const result = calculateMindScore(full);
    expect(result.domain).toBe('mind_life_load');
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.confidence).toBe('high');
    expect(result.limiters).toHaveLength(0);
    expect(result.summary).toBe('Today’s load looks manageable.');
    for (const term of result.contributors) expect(term.detail).toBeTruthy();
  });

  it('names what is weighing most, heaviest first', () => {
    const result = calculateMindScore({ ...full, sleep: { minutes: 330, needMinutes: 480 }, scheduleBlocks: 8, checkin: { demand: 'demanding', energy: 'tired' } });
    expect(result.score).toBeLessThan(55);
    // 2h 30m short of need carries the most weight times shortfall, then the full plan.
    expect(result.limiters.map((l) => l.id)).toEqual(['sleep', 'schedule', 'demand']);
    expect(result.summary).toMatch(/heavy load today\. Sleep is weighing most/);
    expect(result.reason_codes).toContain('limited_by_schedule');
  });

  it('lowers confidence for missing signals, never the score', () => {
    const sparse = calculateMindScore({ date: day, sleep: { minutes: 480, needMinutes: 480 }, checkin: { demand: 'usual', energy: 'unknown' } });
    const complete = calculateMindScore(full);
    expect(sparse.score).not.toBeNull();
    expect(sparse.score!).toBeGreaterThanOrEqual(85);
    expect(sparse.confidence).not.toBe('high');
    expect(sparse.coverage).toBeLessThan(complete.coverage);
  });

  it('withholds a number when too little is known, and says what would help', () => {
    const result = calculateMindScore({ date: day, resets: { breathingSeconds: 300, tensionReleases: 1, morningLightMinutes: 20, habitsDone: 3 } });
    expect(result.score).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.summary).toMatch(/Not enough to read yet/);
  });

  it('never lets a reset make the day read worse', () => {
    const without = calculateMindScore({ ...full, resets: null });
    const withReset = calculateMindScore(full);
    expect(withReset.score!).toBeGreaterThanOrEqual(without.score!);
    expect(without.contributors.find((c) => c.id === 'resets')?.value).toBeNull();
  });

  it('treats an empty plan as unknown rather than a free day', () => {
    expect(calculateMindScore({ ...full, scheduleBlocks: 0 }).contributors.find((c) => c.id === 'schedule')?.value).toBeNull();
  });

  it('reads pulse only against the person’s own range', () => {
    const above = calculateMindScore({ ...full, pulseBand: 'well_above' });
    expect(above.limiters[0].id).toBe('pulse');
    expect(above.suggestion.id).toBe('settle_and_recheck');
  });

  it('suggests one reset that fits the limiter and the time of day', () => {
    const short = { ...full, sleep: { minutes: 300, needMinutes: 480 }, resets: { ...full.resets!, morningLightMinutes: 0 } };
    expect(calculateMindScore(short, 8).suggestion.id).toBe('morning_light');
    expect(calculateMindScore({ ...short, resets: { ...full.resets!, morningLightMinutes: 15 } }, 8).suggestion.id).toBe('steady_lift');
    expect(calculateMindScore(short, 21).suggestion).toMatchObject({ id: 'wind_down', techniqueId: 'wind_down' });
    expect(calculateMindScore({ ...full, scheduleBlocks: 9 }, 14).suggestion).toMatchObject({ id: 'settle_before_block', techniqueId: 'settle' });
    expect(calculateMindScore(full, 14).suggestion.id).toBe('keep_one_reset');
  });

  it('is deterministic and uses no clinical language', () => {
    const inputs = [full, { ...full, pulseBand: 'well_above' as const, checkin: { demand: 'demanding' as const, energy: 'tired' as const } }, { date: day }];
    for (const input of inputs) {
      const result = calculateMindScore(input, 9);
      expect(calculateMindScore(input, 9)).toEqual(result);
      const text = [result.summary, result.suggestion.title, result.suggestion.detail, ...result.contributors.map((c) => c.detail)].join(' ');
      expect(text).not.toMatch(CLINICAL);
    }
  });
});

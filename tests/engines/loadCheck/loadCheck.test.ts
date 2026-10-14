import { describe, expect, it } from 'vitest';

import {
  LOAD_AREAS,
  LOAD_ITEMS,
  observeLoadCheck,
  scoreLoadCheck,
  type LoadAnswers,
  type LoadPoints
} from '../../../src/engines/loadCheck';
import { personalBaselineFrom } from '../../../src/features/loadCheck/loadCheckStore';

const all = (points: LoadPoints): LoadAnswers => Object.fromEntries(LOAD_ITEMS.map((item) => [item.id, points]));

describe('scoring the load check', () => {
  it('maps no load to the top of the range and full load to the bottom', () => {
    expect(scoreLoadCheck(all(0)).baseline).toBe(85);
    expect(scoreLoadCheck(all(3)).baseline).toBe(50);
  });

  it('puts "sometimes" across the board near the old flat start', () => {
    const result = scoreLoadCheck(all(1));
    expect(result.baseline).toBeGreaterThanOrEqual(70);
    expect(result.baseline).toBeLessThanOrEqual(75);
  });

  it('bands each area on its own, never a total', () => {
    const answers: LoadAnswers = { ...all(0), s_too_much: 3, s_money: 3, s_relationships: 3, s_switch_off: 3 };
    const result = scoreLoadCheck(answers);
    expect(result.areas.find((area) => area.area === 'life_load')?.band).toBe('heavy');
    expect(result.areas.find((area) => area.area === 'rhythm')?.band).toBe('light');
    expect(result.reason_codes).toContain('load_life_load_heavy');
  });

  it('reads more load as a lower start, never the other way', () => {
    const lighter = scoreLoadCheck(all(1)).baseline!;
    const heavier = scoreLoadCheck({ ...all(1), r_unrested: 3, r_late: 3, r_slump: 3 }).baseline!;
    expect(heavier).toBeLessThan(lighter);
  });

  it('leaves skipped questions out rather than counting them as load', () => {
    const answered = Object.fromEntries(LOAD_ITEMS.filter((_, index) => index % 2 === 0).map((item) => [item.id, 0 as LoadPoints]));
    const result = scoreLoadCheck(answered);
    expect(result.answered).toBeLessThan(result.total);
    expect(result.baseline === null || result.baseline === 85).toBe(true);
    expect(result.confidence).toBe('low');
  });

  it('gives no starting point from too little', () => {
    const result = scoreLoadCheck({ r_unrested: 2, r_late: 2, r_slump: 2 });
    expect(result.baseline).toBeNull();
    expect(result.reason_codes).toContain('load_check_incomplete');
    expect(personalBaselineFrom({ id: 'x', completedAt: '2026-07-14T00:00:00.000Z', answers: { r_unrested: 2 }, observed: {} })).toBeNull();
  });

  it('routes red-flag symptoms to a professional alongside the score', () => {
    const result = scoreLoadCheck({ ...all(1), d_pain: 2, e_headaches: 3 });
    expect(result.flags.map((flag) => flag.itemId).sort()).toEqual(['d_pain', 'e_headaches']);
    expect(result.reason_codes).toContain('professional_check_suggested');
    expect(result.baseline).not.toBeNull();
  });

  it('lets an observed answer outrank the reported one', () => {
    const reported = scoreLoadCheck({ ...all(0), r_late: 0 });
    const observed = scoreLoadCheck({ ...all(0), r_late: 0 }, { r_late: { points: 3, basis: 'From your sleep log' } });
    expect(observed.baseline!).toBeLessThan(reported.baseline!);
    expect(observed.reason_codes).toContain('load_check_observed_answers');
  });
});

describe('answering from the logs', () => {
  const today = '2026-07-14';
  const day = (offset: number) => new Date(Date.UTC(2026, 6, 14 - offset)).toISOString().slice(0, 10);

  it('reads late and shifting bedtimes from two weeks of nights', () => {
    const sleepSessions = Array.from({ length: 10 }, (_, index) => ({
      date: day(index),
      // Wall-clock times on the UTC axis: alternate 22:00 and 00:30.
      sleep_start_at: index % 2 === 0 ? `${day(index + 1)}T22:00:00.000Z` : `${day(index)}T00:30:00.000Z`
    }));
    const observed = observeLoadCheck({ today, sleepSessions });
    expect(observed.r_late?.points).toBe(2);
    expect(observed.r_late?.basis).toContain('5 of 10 nights');
    expect(observed.r_irregular?.points).toBe(3);
  });

  it('leaves the question to the person when there is too little logged', () => {
    const observed = observeLoadCheck({ today, sleepSessions: [{ date: day(0), sleep_start_at: `${day(1)}T23:30:00.000Z` }] });
    expect(observed.r_late).toBeUndefined();
  });

  it('reads first meals and caffeine', () => {
    const meals = Array.from({ length: 6 }, (_, index) => ({ logged_at: new Date(2026, 6, 14 - index, index < 4 ? 12 : 8, 0).toISOString() }));
    const caffeine = Array.from({ length: 6 }, (_, index) => [{ date: day(index) }, { date: day(index) }, { date: day(index) }]).flat();
    const observed = observeLoadCheck({ today, meals, caffeine });
    expect(observed.t_late_first?.points).toBe(2);
    expect(observed.t_caffeine?.points).toBe(2);
  });
});

describe('the words', () => {
  it('covers every area with original questions', () => {
    for (const area of LOAD_AREAS) expect(LOAD_ITEMS.some((item) => item.area === area.id)).toBe(true);
    expect(new Set(LOAD_ITEMS.map((item) => item.id)).size).toBe(LOAD_ITEMS.length);
  });

  it('never uses clinical or borrowed branded language', () => {
    const text = [
      ...LOAD_AREAS.flatMap((area) => [area.title, area.blurb]),
      ...LOAD_ITEMS.flatMap((item) => [item.prompt, ...item.options.map((option) => option.label), item.flag?.message ?? ''])
    ].join(' ').toLowerCase();
    for (const banned of ['diagnos', 'treatment', 'cure', 'prescri', 'adrenal', 'cortisol', 'hormone', 'chek', 'hlc', 'clinical', 'guarantee', 'disorder']) {
      expect(text).not.toContain(banned);
    }
  });
});

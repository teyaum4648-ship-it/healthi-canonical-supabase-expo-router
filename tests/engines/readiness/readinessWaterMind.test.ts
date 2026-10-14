import { describe, expect, it } from 'vitest';

import { generateDailyReadiness } from '../../../src/engines/readiness';
import type { GenerateDailyReadinessInput } from '../../../src/engines/readiness';
import { waterPace } from '../../../src/features/nutrition/waterPace';
import { mindReadinessSignals, EMPTY_MIND_ENTRIES } from '../../../src/features/practice/mindSignals';
import { createHeadCheck } from '../../../src/features/practice/headCheck';

const date = '2026-07-14';
const domain = (input: GenerateDailyReadinessInput, name: string) =>
  generateDailyReadiness(input).contributions!.domains.find((d) => d.domain === name)!;

describe('water counts as a readiness entry', () => {
  it('brings Nourishment in on its own', () => {
    const result = generateDailyReadiness({ date, nutrition: { meal_count: 0, water_ml: 500, water_pace: null } });
    expect(result.label).not.toBe('calibrating');
    expect(result.missing_data).not.toContain('nourishment');
    expect(result.confidence).toBe('low');
  });

  it('adds for keeping pace and never subtracts for falling behind', () => {
    const onPace = domain({ date, nutrition: { meal_count: 0, water_ml: 1500, water_pace: 1.1 } }, 'nourishment');
    const behind = domain({ date, nutrition: { meal_count: 0, water_ml: 250, water_pace: 0.2 } }, 'nourishment');
    expect(onPace.contribution).toBe(3);
    expect(behind.contribution).toBe(0);
    expect(behind.missing).toBe(false);
  });

  it('adds on top of the meals pillar rather than replacing it', () => {
    const meals = domain({ date, nutrition: { meal_count: 2, nourishment_score: 70 } }, 'nourishment');
    const both = domain({ date, nutrition: { meal_count: 2, nourishment_score: 70, water_ml: 1500, water_pace: 1 } }, 'nourishment');
    expect(both.contribution).toBe(meals.contribution + 3);
  });
});

describe('water pace', () => {
  it('measures against the part of the day that has passed', () => {
    // 07:00 to 23:00, 15:00 is halfway: 1300 mL of a 2600 target is on pace.
    expect(waterPace({ mlToday: 1300, targetMl: 2600, wakeMinute: 420, bedMinute: 1380, nowMinute: 900 })).toBe(1);
  });

  it('gives no pace early in the day or with no water', () => {
    expect(waterPace({ mlToday: 250, wakeMinute: 420, bedMinute: 1380, nowMinute: 480 })).toBeNull();
    expect(waterPace({ mlToday: 0, nowMinute: 900 })).toBeNull();
  });

  it('handles a bedtime after midnight', () => {
    // 09:00 to 01:00 is sixteen hours; 17:00 is halfway.
    expect(waterPace({ mlToday: 1300, targetMl: 2600, wakeMinute: 540, bedMinute: 60, nowMinute: 1020 })).toBe(1);
  });
});

describe('mood entries count as a readiness entry', () => {
  it('a head check-in alone brings Mind + Life Load in', () => {
    const result = generateDailyReadiness({ date, mind: { head_rating: 4 } });
    expect(result.label).not.toBe('calibrating');
    expect(result.missing_data).not.toContain('mind_life_load');
    expect(domain({ date, mind: { head_rating: 4 } }, 'mind_life_load').contribution).toBe(2);
  });

  it('moves with how the person says their head is', () => {
    const clear = generateDailyReadiness({ date, mind: { head_rating: 5 } });
    const overloaded = generateDailyReadiness({ date, mind: { head_rating: 1 } });
    expect(clear.score).toBeGreaterThan(overloaded.score);
  });

  it('counts a reset only in the person’s favour', () => {
    expect(domain({ date, mind: { resets_today: 2 } }, 'mind_life_load').contribution).toBe(2);
    expect(domain({ date, mind: { resets_today: 0 } }, 'mind_life_load').missing).toBe(true);
  });

  it('reads a demanding day and a raised pulse as load', () => {
    expect(domain({ date, mind: { demand: 'demanding', pulse_band: 'well_above' } }, 'mind_life_load').contribution).toBe(-7);
  });

  it('keeps the plan and the mood entries together, within the range', () => {
    const full = domain({ date, schedule: { block_count: 8, open_window_count: 0 }, mind: { head_rating: 1, demand: 'demanding' } }, 'mind_life_load');
    expect(full.contribution).toBe(-10);
  });

  it('labels the domain with its own name', () => {
    const driver = generateDailyReadiness({ date, mind: { head_rating: 3 } }).driver_cards.find((d) => d.domain === 'mind_life_load')!;
    expect(driver.label).toBe('Mind + Life Load');
    expect(driver.detail).toContain('head okay');
  });
});

describe('gathering today’s mood entries', () => {
  it('returns nothing when nothing was logged today', () => {
    expect(mindReadinessSignals(EMPTY_MIND_ENTRIES, date)).toBeNull();
    const yesterday = { ...EMPTY_MIND_ENTRIES, heads: [createHeadCheck({ date: '2026-07-13', rating: 2, moment: 'now', at: '2026-07-13T09:00:00.000Z' })] };
    expect(mindReadinessSignals(yesterday, date)).toBeNull();
  });

  it('uses the latest head answer and counts real resets', () => {
    const signals = mindReadinessSignals({
      ...EMPTY_MIND_ENTRIES,
      heads: [
        createHeadCheck({ date, rating: 2, moment: 'before', techniqueId: 'settle', at: `${date}T09:00:00.000Z` }),
        createHeadCheck({ date, rating: 4, moment: 'after', techniqueId: 'settle', at: `${date}T09:06:00.000Z` })
      ],
      practice: [
        { id: 'a', date, rhythmId: 'settle', seconds: 300, finishedAt: `${date}T09:05:00.000Z` },
        { id: 'b', date, rhythmId: 'settle', seconds: 20, finishedAt: `${date}T10:00:00.000Z` }
      ]
    }, date);
    expect(signals?.head_rating).toBe(4);
    // The twenty-second session was opened, not done.
    expect(signals?.resets_today).toBe(1);
  });
});

describe('a personal baseline', () => {
  it('replaces the flat starting point when the person has one', () => {
    const flat = generateDailyReadiness({ date, mind: { head_rating: 3 } });
    const personal = generateDailyReadiness({ date, mind: { head_rating: 3 }, user_context: { personal_baseline: { score: 62, confidence: 'medium' } } });
    expect(flat.baseline_score).toBe(70);
    expect(personal.baseline_score).toBe(62);
    expect(personal.score).toBe(flat.score - 8);
    expect(personal.reason_codes).toContain('baseline_personal');
    expect(flat.reason_codes).toContain('baseline_default');
  });

  it('cannot sit outside its range', () => {
    expect(generateDailyReadiness({ date, mind: { head_rating: 3 }, user_context: { personal_baseline: { score: 20, confidence: 'high' } } }).baseline_score).toBe(50);
    expect(generateDailyReadiness({ date, mind: { head_rating: 3 }, user_context: { personal_baseline: { score: 99, confidence: 'high' } } }).baseline_score).toBe(85);
  });

  it('does not produce a number on its own', () => {
    const result = generateDailyReadiness({ date, user_context: { personal_baseline: { score: 75, confidence: 'high' } } });
    expect(result.label).toBe('calibrating');
    expect(result.reason_codes).toContain('readiness_needs_entry');
  });
});

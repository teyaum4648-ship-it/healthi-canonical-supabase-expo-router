import { describe, expect, it } from 'vitest';

import { calculateFoodPatternProfile } from '../../../src/engines/nutrition';
import type { FoodPatternAnswers } from '../../../src/engines/nutrition';
import {
  replaceActiveFoodPatternProfile,
  toFoodPatternProfileInsert,
  toPostMealResponseLogInsert,
  type FoodPatternProfileInsert,
  type FoodPatternProfileRow,
  type FoodPersonalizationSupabaseClient,
  type PostMealResponseLogInput
} from '../../../src/features/nutrition/foodPersonalizationPersistence';

const userId = '00000000-0000-0000-0000-000000000001';

const answers: Required<FoodPatternAnswers> = {
  protein_meal_energy: 'steady',
  carb_meal_energy: 'dip',
  hunger_frequency: 'five_plus_hours',
  cravings_pattern: 'after_sweets',
  large_meal_digestion: 'sleepy',
  higher_fat_meal_response: 'satisfied',
  breakfast_skip_response: 'crash',
  afternoon_energy: 'dip',
  late_dinner_response: 'not_sure',
  heavy_dinner_sleep: 'not_sure',
  training_fuel_need: 'extra_protein',
  appetite_stability: 'swings',
  meal_size_preference: 'larger_fewer',
  caffeine_food_sensitivity: 'need_food_first',
  stress_life_load_eating: 'forget_food',
  morning_fueling_pattern: 'protein_breakfast'
};

function profile() {
  return calculateFoodPatternProfile({
    answers,
    now: '2026-07-01T12:00:00.000Z'
  });
}

function responseLog(overrides: Partial<PostMealResponseLogInput> = {}): PostMealResponseLogInput {
  return {
    meal_log_id: '11111111-1111-1111-1111-111111111111',
    responded_at: '2026-07-01T14:00:00.000Z',
    minutes_after_meal: 90,
    overall_score: 8,
    digestion: 'good',
    energy: 'steady',
    appetite: 'stable',
    focus: 'clear',
    cravings: 'none',
    notes: 'Felt steady after lunch.',
    confidence: 'medium',
    reason_codes: ['food_response_steady'],
    ...overrides
  };
}

function createReplacementClient(calls: Array<{ action: string; payload?: unknown; column?: string; value?: unknown }>) {
  const rowFromPayload = (payload: FoodPatternProfileInsert): FoodPatternProfileRow => ({
    ...payload,
    id: '33333333-3333-3333-3333-333333333333',
    created_at: '2026-07-01T12:01:00.000Z',
    updated_at: '2026-07-01T12:01:00.000Z'
  });

  return {
    from(table: 'food_pattern_profiles' | 'post_meal_response_logs') {
      if (table !== 'food_pattern_profiles') {
        throw new Error('Unexpected table in replacement test.');
      }

      return {
        update(payload: Partial<FoodPatternProfileInsert>) {
          calls.push({ action: 'update', payload });
          const query = {
            eq(column: string, value: string | boolean) {
              calls.push({ action: 'update_eq', column, value });
              return query;
            },
            then<TResult1 = { data: FoodPatternProfileRow[] | null; error: null }, TResult2 = never>(
              onfulfilled?: ((value: { data: FoodPatternProfileRow[] | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
              _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
            ) {
              return Promise.resolve({ data: [], error: null }).then(onfulfilled ?? ((value) => value as TResult1));
            }
          };
          return query;
        },
        insert(payload: FoodPatternProfileInsert) {
          calls.push({ action: 'insert', payload });
          return {
            select(columns: string) {
              calls.push({ action: 'insert_select', payload: columns });
              return {
                single() {
                  calls.push({ action: 'insert_single' });
                  return Promise.resolve({ data: rowFromPayload(payload), error: null });
                }
              };
            }
          };
        },
        select() {
          throw new Error('Unexpected select in replacement test.');
        }
      };
    }
  } as unknown as FoodPersonalizationSupabaseClient;
}

describe('food personalization persistence mapping', () => {
  it('maps required food pattern profile fields', () => {
    const payload = toFoodPatternProfileInsert(profile(), userId);

    expect(payload.user_id).toBe(userId);
    expect(payload.source).toBe('food_pattern_test');
    expect(payload.confidence).toBe('medium');
    expect(payload.pattern_label).toBe('protein_forward');
    expect(payload.is_active).toBe(true);
  });

  it('preserves nested food pattern JSON fields', () => {
    const source = profile();
    const payload = toFoodPatternProfileInsert(source, userId);

    expect(payload.scores).toEqual(source.scores);
    expect(payload.macro_tendency).toEqual(source.macro_tendency);
    expect(payload.meal_timing_tendency).toEqual(source.meal_timing_tendency);
    expect(payload.response_tendencies).toEqual(source.response_tendencies);
  });

  it('does not mutate source profile nested data', () => {
    const source = profile();
    const payload = toFoodPatternProfileInsert(source, userId);

    payload.scores.protein_forward = 999;
    payload.macro_tendency.protein = 'lower';

    expect(source.scores.protein_forward).not.toBe(999);
    expect(source.macro_tendency.protein).toBe('higher');
  });

  it('supports inactive profile payloads', () => {
    const payload = toFoodPatternProfileInsert({ ...profile(), is_active: false }, userId);

    expect(payload.is_active).toBe(false);
  });

  it('preserves food pattern reason codes without mutating source', () => {
    const source = profile();
    const originalReasons = [...source.reason_codes];
    const payload = toFoodPatternProfileInsert(source, userId);

    payload.reason_codes.push('food_pattern_calibrating');

    expect(source.reason_codes).toContain('protein_forward_signal');
    expect(source.reason_codes).toEqual(originalReasons);
  });

  it('maps required post-meal response log fields', () => {
    const payload = toPostMealResponseLogInsert(responseLog(), userId);

    expect(payload).toEqual({
      user_id: userId,
      meal_log_id: '11111111-1111-1111-1111-111111111111',
      responded_at: '2026-07-01T14:00:00.000Z',
      minutes_after_meal: 90,
      overall_score: 8,
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable',
      focus: 'clear',
      cravings: 'none',
      notes: 'Felt steady after lunch.',
      confidence: 'medium',
      reason_codes: ['food_response_steady']
    });
  });

  it('preserves overall score and meal linkage', () => {
    const payload = toPostMealResponseLogInsert(
      responseLog({
        overall_score: 10,
        meal_log_id: '22222222-2222-2222-2222-222222222222'
      }),
      userId
    );

    expect(payload.overall_score).toBe(10);
    expect(payload.meal_log_id).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('handles optional post-meal response fields safely', () => {
    const payload = toPostMealResponseLogInsert(
      responseLog({
        meal_log_id: undefined,
        minutes_after_meal: undefined,
        digestion: undefined,
        energy: undefined,
        appetite: undefined,
        focus: undefined,
        cravings: undefined,
        notes: undefined
      }),
      userId
    );

    expect(payload.meal_log_id).toBeNull();
    expect(payload.minutes_after_meal).toBeNull();
    expect(payload.digestion).toBeNull();
    expect(payload.energy).toBeNull();
    expect(payload.appetite).toBeNull();
    expect(payload.focus).toBeNull();
    expect(payload.cravings).toBeNull();
    expect(payload.notes).toBeNull();
  });

  it('preserves notes and reason codes without mutating source', () => {
    const reasons = ['digestion_discomfort_reported', 'energy_dip_reported'];
    const payload = toPostMealResponseLogInsert(
      responseLog({
        notes: 'Lunch felt heavier than expected.',
        reason_codes: reasons
      }),
      userId
    );

    payload.reason_codes.push('source_low_confidence');

    expect(payload.notes).toBe('Lunch felt heavier than expected.');
    expect(reasons).toEqual(['digestion_discomfort_reported', 'energy_dip_reported']);
  });

  it('keeps payloads serializable', () => {
    const profilePayload = toFoodPatternProfileInsert(profile(), userId);
    const responsePayload = toPostMealResponseLogInsert(responseLog(), userId);

    expect(JSON.parse(JSON.stringify(profilePayload))).toEqual(profilePayload);
    expect(JSON.parse(JSON.stringify(responsePayload))).toEqual(responsePayload);
  });

  it('does not introduce blocked language in persistence payloads', () => {
    const output = JSON.stringify({
      profile: toFoodPatternProfileInsert(profile(), userId),
      response: toPostMealResponseLogInsert(responseLog(), userId)
    }).toLowerCase();
    const blockedTerms = [
      'diag' + 'nosis',
      'diag' + 'nose',
      'treat' + 'ment',
      'c' + 'ure',
      'pre' + 'scribe',
      'pre' + 'scription',
      'ad' + 'renal',
      'h' + 'pa',
      'cor' + 'tisol',
      'hor' + 'mone',
      'clin' + 'ical',
      'medical ' + 'decision',
      'dys' + 'regulated',
      'dys' + 'function',
      'de' + 'tox',
      'tox' + 'in',
      'tox' + 'ic',
      'clean' + 'se',
      'cheat ' + 'meal',
      'guilt-' + 'free',
      'bad ' + 'food',
      'metabolic ' + 'type',
      'metabolic ' + 'typing',
      'che' + 'k',
      'h' + 'lc',
      '4 doctors',
      'primal pattern',
      'work-in'
    ];

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });

  it('replaces the active food pattern profile by deactivating before insert', async () => {
    const calls: Array<{ action: string; payload?: unknown; column?: string; value?: unknown }> = [];
    const client = createReplacementClient(calls);
    const source = profile();
    const inserted = await replaceActiveFoodPatternProfile(client, userId, source);

    expect(calls.map((call) => call.action)).toEqual([
      'update',
      'update_eq',
      'update_eq',
      'insert',
      'insert_select',
      'insert_single'
    ]);
    expect(calls[0].payload).toEqual({ is_active: false });
    expect(calls[1]).toEqual({ action: 'update_eq', column: 'user_id', value: userId });
    expect(calls[2]).toEqual({ action: 'update_eq', column: 'is_active', value: true });
    expect(inserted.user_id).toBe(userId);
    expect(inserted.is_active).toBe(true);
    expect(inserted.scores).toEqual(source.scores);
    expect(inserted.reason_codes).toEqual(source.reason_codes);
    expect(JSON.parse(JSON.stringify(inserted))).toEqual(inserted);
  });
});

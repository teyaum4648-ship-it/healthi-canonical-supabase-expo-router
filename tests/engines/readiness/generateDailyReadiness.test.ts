import { describe, expect, it } from 'vitest';

import { generateDailyReadiness, type GenerateDailyReadinessInput } from '../../../src/engines/readiness';

const strongInput: GenerateDailyReadinessInput = {
  date: '2026-07-14',
  rhythm: {
    sleep_duration_hours: 8.1,
    sleep_debt_hours: 0.2,
    energy_phase: 'morning_peak',
    deep_work_window: { start: '08:30', end: '11:00' },
    exercise_window: { start: '16:00', end: '17:30' },
    wind_down_start: '21:15',
    confidence: 'high',
    reason_codes: ['rhythm_window_available']
  },
  nutrition: {
    meal_count: 2,
    readiness_adjustment: 4,
    food_quality_label: 'supportive',
    food_response_label: 'steady',
    confidence: 'medium',
    reason_codes: ['fueling_signal_available']
  },
  movement: {
    workout_count_7d: 3,
    total_minutes_7d: 145,
    training_load_label: 'steady',
    readiness_label: 'ready_to_build',
    confidence: 'high',
    reason_codes: ['weekly_workouts_available']
  },
  schedule: {
    block_count: 4,
    open_window_count: 3,
    confidence: 'medium',
    reason_codes: ['open_window_detected']
  }
};

describe('generateDailyReadiness', () => {
  it('returns a calibrating result for empty input', () => {
    const result = generateDailyReadiness({ date: '2026-07-14' });
    expect(result.label).toBe('calibrating');
    expect(result.confidence).toBe('low');
    expect(result.missing_data).toEqual([
      'recovery_rhythm',
      'nourishment',
      'movement_capacity',
      'mind_life_load'
    ]);
    expect(result.driver_cards).toHaveLength(4);
  });

  it('produces a primed or steady result from supportive whole-day signals', () => {
    const result = generateDailyReadiness(strongInput);
    expect(['primed', 'steady']).toContain(result.label);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.mode).toBe('build');
  });

  it('gives rhythm the largest influence when sleep debt is elevated', () => {
    const rested = generateDailyReadiness(strongInput);
    const limited = generateDailyReadiness({
      ...strongInput,
      rhythm: {
        ...strongInput.rhythm,
        sleep_duration_hours: 5.2,
        sleep_debt_hours: 3.4,
        energy_phase: 'rising'
      }
    });
    expect(rested.score - limited.score).toBeGreaterThanOrEqual(25);
    expect(limited.primary_focus).toBe('recovery_rhythm');
    expect(['correct', 'restore']).toContain(limited.mode);
  });

  it('lets missing nutrition lower confidence without applying a score penalty', () => {
    const withoutNutrition = generateDailyReadiness({ ...strongInput, nutrition: undefined });
    const neutralNutrition = generateDailyReadiness({
      ...strongInput,
      nutrition: {
        meal_count: 1,
        readiness_adjustment: 0,
        food_quality_label: 'unknown',
        food_response_label: 'unknown',
        confidence: 'medium'
      }
    });
    expect(withoutNutrition.score).toBe(neutralNutrition.score);
    expect(withoutNutrition.confidence).not.toBe('high');
    expect(withoutNutrition.missing_data).toContain('nourishment');
  });

  it('uses lighter movement guidance when movement readiness is limited', () => {
    const result = generateDailyReadiness({
      ...strongInput,
      movement: {
        ...strongInput.movement,
        readiness_label: 'recovery_support'
      }
    });
    const movement = result.recommended_actions.find((action) => action.domain === 'movement_capacity');
    expect(movement?.id).toBe('lighter_movement');
    expect(movement?.detail).toContain('comfortable walk');
  });

  it('lets a crowded schedule shift the primary focus to mind and life load', () => {
    const result = generateDailyReadiness({
      ...strongInput,
      rhythm: { ...strongInput.rhythm, sleep_duration_hours: 7.2, sleep_debt_hours: 0.8 },
      nutrition: { ...strongInput.nutrition, readiness_adjustment: 0, food_quality_label: 'steady' },
      movement: { ...strongInput.movement, readiness_label: 'steady_maintenance' },
      schedule: { block_count: 9, open_window_count: 0, confidence: 'high' }
    });
    expect(result.primary_focus).toBe('mind_life_load');
    expect(result.reason_codes).toContain('schedule_load_high');
  });

  it('avoids higher-intensity movement guidance in restore mode', () => {
    const result = generateDailyReadiness({
      ...strongInput,
      rhythm: { ...strongInput.rhythm, sleep_duration_hours: 4.5, sleep_debt_hours: 4 },
      movement: { ...strongInput.movement, readiness_label: 'recovery_support' }
    });
    expect(result.mode).toBe('restore');
    const movement = result.recommended_actions.find((action) => action.domain === 'movement_capacity');
    expect(movement?.id).toBe('lighter_movement');
    expect(JSON.stringify(movement).toLowerCase()).not.toContain('hard session');
  });

  it('only preserves professional guidance mode when supplied', () => {
    expect(generateDailyReadiness(strongInput).mode).not.toBe('professional_guidance');
    expect(generateDailyReadiness({
      ...strongInput,
      user_context: { baseline_mode: 'professional_guidance' }
    }).mode).toBe('professional_guidance');
  });

  it('keeps the score within 0-100 and returns serializable reasoned output', () => {
    const high = generateDailyReadiness(strongInput);
    const low = generateDailyReadiness({
      ...strongInput,
      rhythm: { sleep_duration_hours: 2, sleep_debt_hours: 9, confidence: 'high' },
      nutrition: { meal_count: 1, readiness_adjustment: -50, confidence: 'high' },
      movement: { readiness_label: 'recovery_support', training_load_label: 'high_frequency', confidence: 'high' },
      schedule: { block_count: 20, open_window_count: 0, confidence: 'high' }
    });
    expect(high.score).toBeLessThanOrEqual(100);
    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(low.reason_codes.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(low))).toEqual(low);
  });

  it('keeps generated copy within Healthi general-wellness language', () => {
    const output = JSON.stringify(generateDailyReadiness(strongInput)).toLowerCase();
    const blocked = [
      'diag' + 'nosis', 'diag' + 'nose', 'treat' + 'ment', 'c' + 'ure', 'pre' + 'scribe',
      'pre' + 'scription', 're' + 'hab', 'clin' + 'ical', 'medical ' + 'decision',
      'dys' + 'function', 'dys' + 'regulated', 'ad' + 'renal', 'h' + 'pa', 'cor' + 'tisol',
      'hor' + 'mone', 'de' + 'tox', 'clean' + 'se', 'tox' + 'ic', 'bad ' + 'food',
      'bad ' + 'body', 'bad ' + 'movement', 'cheat ' + 'meal', 'guilt-' + 'free',
      'metabolic ' + 'type', 'che' + 'k', 'work-' + 'in', 'whoop ' + 'strain',
      'scout ' + 'score', 'bobby ' + 'approved', 'fit' + 'bod', 'strong ' + 'app'
    ];
    for (const term of blocked) expect(output).not.toContain(term);
  });
});

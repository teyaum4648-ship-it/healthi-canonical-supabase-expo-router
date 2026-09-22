import { describe, expect, it } from 'vitest';

import {
  buildAdaptiveDietPresentation
} from '../../../src/features/nutrition/adaptiveDietPresentation';
import type {
  FoodQualitySummary,
  FoodResponseSummary,
  NutrientSummary,
  NutritionReadinessSignal,
  NutritionTargets
} from '../../../src/engines/nutrition';

const targets: NutritionTargets = {
  calories_target: 2200,
  protein_g_target: 140,
  carbs_g_target: 240,
  fat_g_target: 75,
  fiber_g_target: 30,
  sodium_mg_limit: 2300,
  confidence: 'medium',
  basis: ['onboarding']
};

function summary(overrides: Partial<NutrientSummary> = {}): NutrientSummary {
  return {
    date: '2026-07-29',
    meal_count: 2,
    micronutrients: {},
    micronutrient_coverage: { reported: 0, tracked: 27, fraction: 0 },
    calories: 1200,
    protein_g: 78,
    carbs_g: 125,
    fat_g: 44,
    fiber_g: 13,
    sugar_g: 22,
    sodium_mg: 1100,
    targets,
    target_progress: {},
    confidence: 'medium',
    reason_codes: [],
    ...overrides
  };
}

function quality(overrides: Partial<FoodQualitySummary> = {}): FoodQualitySummary {
  return {
    date: '2026-07-29',
    score: 74,
    label: 'steady',
    flags: [],
    confidence: 'medium',
    reason_codes: [],
    ...overrides
  };
}

function response(overrides: Partial<FoodResponseSummary> = {}): FoodResponseSummary {
  return {
    date: '2026-07-29',
    label: 'unknown',
    digestion_signal: 'unknown',
    energy_signal: 'unknown',
    appetite_signal: 'unknown',
    confidence: 'low',
    reason_codes: ['food_response_missing'],
    ...overrides
  };
}

function readiness(overrides: Partial<NutritionReadinessSignal> = {}): NutritionReadinessSignal {
  return {
    date: '2026-07-29',
    score_adjustment: 0,
    label: 'neutral',
    summary: 'Nutrition context is still forming.',
    confidence: 'medium',
    reason_codes: [],
    ...overrides
  };
}

describe('buildAdaptiveDietPresentation', () => {
  it('starts conservatively and does not score coverage before a meal is logged', () => {
    const result = buildAdaptiveDietPresentation({
      summary: summary({
        meal_count: 0,
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        fiber_g: null,
        sugar_g: null,
        sodium_mg: null,
        confidence: 'low',
        reason_codes: ['food_data_missing', 'nutrition_calibrating']
      }),
      targets,
      quality: quality({ score: null, label: 'unknown', confidence: 'low' }),
      response: response(),
      readiness: readiness({ label: 'unknown', confidence: 'low' }),
      responseCount: 0
    });

    expect(result.verdict.line).toContain('Log one meal');
    expect(result.verdict.confidence).toBe('low');
    expect(result.priorities[0]).toMatchObject({
      id: 'first_meal',
      destination: 'Log Meal'
    });
    expect(result.lanes.filter((lane) => lane.state === 'Limited data')).toHaveLength(5);
    expect(result.nutrients.every((nutrient) => nutrient.amount === 'Not reported')).toBe(true);
  });

  it('limits the adaptive focus to three evidence-backed priorities', () => {
    const result = buildAdaptiveDietPresentation({
      summary: summary({
        protein_g: 35,
        carbs_g: 50,
        fiber_g: 4
      }),
      targets,
      quality: quality(),
      response: response(),
      readiness: readiness({ label: 'watch' }),
      responseCount: 0
    });

    expect(result.priorities).toHaveLength(3);
    expect(result.priorities.map((priority) => priority.id)).toEqual([
      'protein',
      'energy',
      'fiber'
    ]);
    expect(result.priorities.every((priority) => priority.reason.length > 0)).toBe(true);
  });

  it('keeps hydration and micronutrient lanes explicit when the engine lacks coverage data', () => {
    const result = buildAdaptiveDietPresentation({
      summary: summary(),
      targets,
      quality: quality(),
      response: response({ label: 'steady', confidence: 'medium' }),
      readiness: readiness(),
      responseCount: 1
    });

    expect(result.lanes.find((lane) => lane.id === 'hydration')).toMatchObject({
      state: 'Limited data',
      confidence: 'low',
      progress: 0
    });
    expect(result.lanes.find((lane) => lane.id === 'micronutrients')).toMatchObject({
      state: 'Limited data',
      confidence: 'low',
      progress: 0
    });
    /*
     * This assertion used to pin potassium, calcium and iron in that order with the
     * amount fixed at "Not reported" — which described the placeholder rows rather than
     * any behaviour, and would have passed forever whatever the providers sent. What is
     * worth holding is the property: a nutrient nothing reported says so, at low
     * confidence, and never as a zero.
     */
    for (const id of ['potassium', 'calcium', 'iron', 'vitamin_c', 'folate']) {
      const row = result.nutrients.find((nutrient) => nutrient.id === id);
      expect(row).toBeDefined();
      expect(row).toMatchObject({ amount: 'Not reported', confidence: 'low' });
    }
  });

  it('treats an unreported nutrient as missing rather than as zero or a deficit', () => {
    const result = buildAdaptiveDietPresentation({
      summary: summary({ protein_g: null }),
      targets,
      quality: quality(),
      response: response({ label: 'steady', confidence: 'medium' }),
      readiness: readiness(),
      responseCount: 1
    });

    expect(result.lanes.find((lane) => lane.id === 'protein')).toMatchObject({
      state: 'Limited data',
      progress: 0
    });
    expect(result.priorities.some((priority) => priority.id === 'protein')).toBe(false);
    expect(result.nutrients.find((nutrient) => nutrient.id === 'protein')?.amount).toBe('Not reported');
  });

  it('is deterministic, serializable, and avoids diagnosis-like output', () => {
    const input = {
      summary: summary(),
      targets,
      quality: quality(),
      response: response(),
      readiness: readiness(),
      responseCount: 0
    };
    const first = buildAdaptiveDietPresentation(input);
    const second = buildAdaptiveDietPresentation(input);
    const serialized = JSON.stringify(first).toLowerCase();

    expect(second).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(serialized).not.toMatch(/diagnos|treatment|cure|prescrib|cortisol|adrenal/);
  });
});

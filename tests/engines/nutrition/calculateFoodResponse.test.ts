import { describe, expect, it } from 'vitest';

import { calculateFoodResponse } from '../../../src/engines/nutrition';
import type { MealLog } from '../../../src/engines/nutrition';

function meal(overrides: Partial<MealLog> = {}): MealLog {
  return {
    logged_at: '2026-06-14T12:00:00.000Z',
    meal_type: 'lunch',
    name: 'Meal',
    source: 'manual',
    source_confidence: 'medium',
    calories: 700,
    protein_g: 50,
    carbs_g: 70,
    fat_g: 20,
    fiber_g: 10,
    sugar_g: 8,
    sodium_mg: 600,
    ingredients: null,
    quality_flags: [],
    user_response: {
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable'
    },
    reason_codes: [],
    created_at: '2026-06-14T12:01:00.000Z',
    ...overrides
  };
}

describe('calculateFoodResponse', () => {
  it('detects digestion discomfort', () => {
    const result = calculateFoodResponse({
      date: '2026-06-14',
      meals: [meal({ user_response: { digestion: 'uncomfortable', energy: 'steady', appetite: 'stable' } })]
    });

    expect(result.digestion_signal).toBe('watch');
    expect(result.label).toBe('mixed');
    expect(result.reason_codes).toContain('digestion_discomfort_reported');
  });

  it('detects energy dip', () => {
    const result = calculateFoodResponse({
      date: '2026-06-14',
      meals: [meal({ user_response: { digestion: 'neutral', energy: 'dip', appetite: 'stable' } })]
    });

    expect(result.energy_signal).toBe('watch');
    expect(result.reason_codes).toContain('energy_dip_reported');
  });

  it('detects stable appetite', () => {
    const result = calculateFoodResponse({
      date: '2026-06-14',
      meals: [meal()]
    });

    expect(result.appetite_signal).toBe('supportive');
    expect(result.label).toBe('steady');
    expect(result.reason_codes).toContain('food_response_steady');
  });

  it('returns unknown and low confidence when response data is missing', () => {
    const result = calculateFoodResponse({
      date: '2026-06-14',
      meals: [meal({ user_response: null })]
    });

    expect(result.label).toBe('unknown');
    expect(result.digestion_signal).toBe('unknown');
    expect(result.energy_signal).toBe('unknown');
    expect(result.appetite_signal).toBe('unknown');
    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['food_response_missing', 'nutrition_calibrating']));
  });

  it('lowers confidence when only some meals have response data', () => {
    const result = calculateFoodResponse({
      date: '2026-06-14',
      meals: [meal(), meal({ user_response: null })]
    });

    expect(result.confidence).toBe('low');
  });

  it('keeps output serializable', () => {
    const result = calculateFoodResponse({
      date: '2026-06-14',
      meals: [meal()]
    });

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

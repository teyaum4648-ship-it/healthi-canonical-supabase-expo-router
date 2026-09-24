import { describe, expect, it } from 'vitest';
import { updateFoodPatternProfileFromResponse } from '../../../src/engines/nutrition/updateFoodPatternProfileFromResponse';
import type { FoodPatternMealResponseInput, FoodPatternProfile, FoodPatternScoredLabel } from '../../../src/engines/nutrition/foodPatternTypes';

function profile(label: FoodPatternProfile['pattern_label'], confidence: FoodPatternProfile['confidence'], scores: Partial<Record<FoodPatternScoredLabel, number>> = {}): FoodPatternProfile {
  return {
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
    source: 'food_pattern_test', confidence, pattern_label: label,
    scores: { steady_balanced: 4, protein_forward: 3, carb_supported: 2, lighter_frequent: 1, evening_sensitive: 10, ...scores },
    macro_tendency: { protein: 'moderate', carbs: 'moderate', fat: 'moderate' },
    meal_timing_tendency: { breakfast: 'optional', meal_spacing: 'moderate', late_meal_sensitivity: 'low' },
    response_tendencies: { digestion: 'unknown', energy: 'unknown', appetite: 'unknown' },
    reason_codes: []
  };
}

/** A response good enough to count as supportive, about whichever style is named. */
function supportive(style: FoodPatternScoredLabel, responseCount: number): FoodPatternMealResponseInput {
  return { meal_style: style, energy: 5, digestion: 5, appetite_stability: 5, cravings: false, response_count: responseCount };
}

describe('only a style’s own evidence can make the app confident about it', () => {
  it('does not let responses about one style vouch for another', () => {
    const before = profile('evening_sensitive', 'low');
    const after = updateFoodPatternProfileFromResponse({ profile: before, response: supportive('steady_balanced', 12) });
    expect(after.pattern_label).toBe('evening_sensitive');
    expect(after.confidence).toBe('low');
  });
  it('raises confidence when the responses are about the leading style', () => {
    const before = profile('evening_sensitive', 'low');
    const after = updateFoodPatternProfileFromResponse({ profile: before, response: supportive('evening_sensitive', 12) });
    expect(after.pattern_label).toBe('evening_sensitive');
    expect(after.confidence).toBe('high');
  });
  it('makes a new leader earn its own confidence instead of inheriting', () => {
    const before = profile('evening_sensitive', 'high', { evening_sensitive: 10, protein_forward: 9 });
    const after = updateFoodPatternProfileFromResponse({ profile: before, response: supportive('protein_forward', 12) });
    expect(after.pattern_label).toBe('protein_forward');
    expect(after.confidence).not.toBe('high');
  });
  it('holds a confidence already earned when an unrelated response arrives', () => {
    const before = profile('evening_sensitive', 'high');
    expect(updateFoodPatternProfileFromResponse({ profile: before, response: supportive('carb_supported', 1) }).confidence).toBe('high');
  });
  it('never drops a leading style’s confidence because one later response was thin', () => {
    const before = profile('evening_sensitive', 'high');
    expect(updateFoodPatternProfileFromResponse({ profile: before, response: supportive('evening_sensitive', 1) }).confidence).toBe('high');
  });
  it('keeps a weak profile weak', () => {
    const before = profile('evening_sensitive', 'low');
    expect(updateFoodPatternProfileFromResponse({ profile: before, response: supportive('evening_sensitive', 1) }).confidence).toBe('low');
  });
});

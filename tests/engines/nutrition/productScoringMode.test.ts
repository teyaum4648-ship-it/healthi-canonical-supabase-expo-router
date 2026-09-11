import { afterEach, describe, expect, it, vi } from 'vitest';
import { scoreProductLabel, type ProductScoringInput } from '../../../src/engines/nutrition/productScoring';

const input: ProductScoringInput = {
  name: 'Tomato sauce',
  categoryTags: ['marinara sauces'],
  ingredientsText: 'tomatoes, olive oil, onions, garlic, basil, salt',
  ingredientEvidenceStatus: 'complete',
  sourceConfidence: 'high',
  servingQuantity: 125,
  servingUnit: 'g',
  servingNutrients: { calories: 70, protein_g: 2, carbs_g: 8, fat_g: 3, saturated_fat_g: 0.5, fiber_g: 2, sugar_g: 5, added_sugar_g: 0, sodium_mg: 250 }
};

afterEach(() => vi.unstubAllEnvs());

describe('published scanner mode selection', () => {
  it('keeps the standard kernel when the experiment is unset', () => {
    vi.stubEnv('EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT', undefined);
    const result = scoreProductLabel(input);
    expect(result.dimensionAggregation.weightedMeanBeforeCap).toBeUndefined();
    expect(result.dimensionAggregation.tier).toBeUndefined();
  });

  it('ignores unrecognized flags instead of silently enabling the experiment', () => {
    vi.stubEnv('EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT', undefined);
    const standard = scoreProductLabel(input);
    vi.stubEnv('EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT', 'true');
    expect(scoreProductLabel(input)).toEqual(standard);
  });

  it('provides a deterministic two-axis trace only with explicit opt-in', () => {
    vi.stubEnv('EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT', 'v5_two_axis');
    const result = scoreProductLabel(input);
    expect(result.dimensionAggregation.weightedMeanBeforeCap).toEqual(expect.any(Number));
    expect(result.dimensionAggregation.contribution).toEqual(expect.any(Number));
    expect(result.dimensionAggregation.load).toEqual(expect.any(Number));
    expect(result.dimensionAggregation.tier?.rationale).toEqual(expect.any(String));
    expect(scoreProductLabel(input)).toEqual(result);
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({ dimensionAggregation: result.dimensionAggregation });
  });
});

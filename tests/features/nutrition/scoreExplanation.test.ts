import { describe, expect, it } from 'vitest';

import { explainProductScore } from '../../../src/engines/nutrition/productScoring/explain';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { explainSnapshotScore } from '../../../src/features/nutrition/productLookup/scoreExplanation';

const yogurt = normalizeOpenFoodFactsProduct('0894700010045', {
  product_name: 'Greek Yogurt Plain', brands: 'Example Dairy', serving_size: '170 g',
  ingredients_text: 'Cultured nonfat milk',
  nutriments: { 'energy-kcal_100g': 53, proteins_100g: 10, carbohydrates_100g: 3.5, fat_100g: 0, sugars_100g: 3.5, fiber_100g: 0, 'saturated-fat_100g': 0, sodium_100g: 0.036 }
})!;

describe('the score breakdown behind a ring', () => {
  it('explains a food exactly as the scanner does', () => {
    const quality = calculateProductQuality(yogurt);
    const basis = quality.nutrient_basis ?? null;
    const scanner = explainProductScore({
      ingredientsText: yogurt.ingredients_text ?? null,
      nutrients: basis?.nutrients ?? null,
      basisLabel: basis?.type === 'per_100g' ? '100 g' : yogurt.serving_size ?? 'serving',
      dimensions: quality.dimensions ?? [],
      grade: quality.letter_grade ?? null
    });
    expect(explainSnapshotScore(yogurt, quality)).toEqual(scanner);
  });

  it('says something whether or not the label was enough to score', () => {
    const quality = calculateProductQuality(yogurt);
    expect(explainSnapshotScore(yogurt, quality).verdict.length).toBeGreaterThan(0);
    const bare = { ...yogurt, ingredients_text: null, nutriments_per_100g: undefined, calories_per_serving: null, protein_g: null, carbs_g: null, fat_g: null };
    expect(explainSnapshotScore(bare, calculateProductQuality(bare)).verdict.length).toBeGreaterThan(0);
  });
});

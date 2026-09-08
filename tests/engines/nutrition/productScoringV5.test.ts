import { describe, expect, it } from 'vitest';

import {
  PRODUCT_QUALITY_ENGINE_VERSION,
  PRODUCT_QUALITY_V5_DIMENSION_WEIGHTS,
  productLetterGrade,
  scoreProductLabel,
  type ProductScoringInput
} from '../../../src/engines/nutrition/productScoring';

function complete(input: ProductScoringInput): ProductScoringInput {
  return {
    sourceConfidence: 'high',
    ingredientEvidenceStatus: 'complete',
    evidenceContext: {
      identityConfidence: 'high',
      ingredientConflict: false,
      nutritionConfidence: 'high',
      providerConflict: false,
      servingConfidence: 'high'
    },
    ...input
  };
}

describe('Product Quality V5 candidate-kernel integration', () => {
  it('uses the candidate domain weights without adding Lab Evidence to Product Quality', () => {
    expect(PRODUCT_QUALITY_ENGINE_VERSION).toBe('product_quality_v5');
    expect(PRODUCT_QUALITY_V5_DIMENSION_WEIGHTS).toEqual({
      ingredient_integrity: 0.15,
      food_structure: 0.1,
      category_nutrition_fit: 0.375,
      processing_purpose: 0.1875,
      formulation_burden: 0.1875
    });
    expect(Object.values(PRODUCT_QUALITY_V5_DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(1);
    expect(Object.keys(PRODUCT_QUALITY_V5_DIMENSION_WEIGHTS).join(' ').toLowerCase()).not.toMatch(/lab|contaminant|sourcing/);
  });

  it('never converts absent evidence into a score or perfect ingredient domains', () => {
    const absent = scoreProductLabel({ name: '' });
    expect(absent.displayScore).toBeNull();
    expect(absent.letterGrade).toBeNull();
    expect(absent.dimensions.filter((dimension) => dimension.score !== null)).toHaveLength(0);

    const uninterpretable = scoreProductLabel(complete({ name: 'Unclassified ingredient', ingredientsText: 'moringa' }));
    expect(uninterpretable.displayScore).toBeNull();
    expect(uninterpretable.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')?.score).toBeNull();
    expect(uninterpretable.dimensions.find((dimension) => dimension.id === 'food_structure')?.score).toBeNull();
  });

  it('withholds missing nutrient effects rather than treating missing values as zero', () => {
    const missingAddedSugar = scoreProductLabel(complete({
      name: 'Cultured dairy',
      category: 'yogurt',
      ingredientsText: 'cultured milk, live cultures',
      servingNutrients: { protein_g: 16, sugar_g: 6, sodium_mg: 60 }
    }));
    const explicitZeroAddedSugar = scoreProductLabel(complete({
      name: 'Cultured dairy',
      category: 'yogurt',
      ingredientsText: 'cultured milk, live cultures',
      servingNutrients: { protein_g: 16, sugar_g: 6, added_sugar_g: 0, sodium_mg: 60 }
    }));
    const missing = missingAddedSugar.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')!;
    const explicit = explicitZeroAddedSugar.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')!;
    expect(missing.missingEvidence).toContain('measured added sugar');
    expect(missing.rulesSuppressed).toContain('missing_added_sugar:not_assumed_zero');
    expect(missing.confidence).not.toBe('high');
    expect(explicit.missingEvidence).not.toContain('measured added sugar');
    expect(missing.score).toBe(explicit.score);
  });

  it('uses total sugar only when direct ingredient evidence establishes an added-sugar source', () => {
    const regular = scoreProductLabel(complete({
      name: 'Regular cola',
      category: 'soda',
      ingredientsText: 'carbonated water, sugar, caramel color, phosphoric acid, natural flavor, caffeine',
      servingNutrients: { calories: 150, sugar_g: 39, sodium_mg: 35 }
    }));
    const zeroSugar = scoreProductLabel(complete({
      name: 'Zero-sugar cola',
      category: 'soda',
      ingredientsText: 'carbonated water, caramel color, phosphoric acid, aspartame, natural flavor, caffeine',
      servingNutrients: { calories: 0, sugar_g: 0, sodium_mg: 40 }
    }));
    const cultured = scoreProductLabel(complete({
      name: 'Plain cultured dairy',
      category: 'yogurt',
      ingredientsText: 'cultured milk, live cultures',
      servingNutrients: { sugar_g: 6, protein_g: 16, sodium_mg: 60 }
    }));
    expect(regular.displayScore!).toBeLessThan(zeroSugar.displayScore!);
    expect(regular.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.rulesFired).toContain('measured_total_sugar_with_added_sugar_ingredient');
    expect(cultured.dimensions.find((dimension) => dimension.id === 'category_nutrition_fit')?.rulesFired).not.toContain('measured_total_sugar_with_added_sugar_ingredient');
  });

  it('keeps a simple whole-food label strong while requiring multidimensional evidence for A', () => {
    const simple = scoreProductLabel(complete({
      name: 'Whole almonds',
      ingredientsText: 'almonds',
      servingNutrients: { protein_g: 6, fiber_g: 4, sugar_g: 1, sodium_mg: 0, saturated_fat_g: 1 }
    }));
    const formulatedHighFiberDrink = scoreProductLabel(complete({
      name: 'High-fiber sparkling drink',
      category: 'prebiotic_soda',
      ingredientsText: 'carbonated water, cassava root fiber, chicory root inulin, apple juice concentrate, natural flavors, stevia',
      servingNutrients: { calories: 35, fiber_g: 9, sugar_g: 4, sodium_mg: 35 }
    }));
    const formulatedCereal = scoreProductLabel(complete({
      name: 'Protein cereal',
      category: 'cereal',
      ingredientsText: 'milk protein isolate, chicory root inulin, whole oats, natural flavors, sucralose',
      servingNutrients: { calories: 150, protein_g: 15, fiber_g: 8, sugar_g: 0, sodium_mg: 120 }
    }));
    expect(simple.letterGrade).toBe('A');
    expect(simple.gradeEligibility).toMatchObject({ aEligible: true });
    expect(formulatedHighFiberDrink.letterGrade).not.toBe('A');
    if (formulatedHighFiberDrink.rawScore! >= 90) {
      expect(formulatedHighFiberDrink.gradeEligibility).toMatchObject({
        aEligible: false,
        deniedReasons: expect.arrayContaining(['formulation_complexity_not_low'])
      });
      expect(formulatedHighFiberDrink.scoreLedger.find((entry) => entry.ruleId === 'grade_eligibility_adjustment')).toBeTruthy();
    }
    expect(formulatedCereal.letterGrade).not.toBe('A');
  });

  it('keeps plant sweeteners, rare sugars, sugar alcohols, and synthetic sweeteners distinct', () => {
    const result = scoreProductLabel(complete({
      name: 'Mixed sweetener formulation',
      category: 'protein_bar',
      ingredientsText: 'peanuts, allulose, stevia, monk fruit, erythritol, sucralose',
      servingNutrients: { protein_g: 10, fiber_g: 3, sugar_g: 1, sodium_mg: 80 }
    }));
    const formulation = result.dimensions.find((dimension) => dimension.id === 'formulation_burden')!;
    expect(formulation.rulesFired).toEqual(expect.arrayContaining(['sugar_alcohol_system', 'synthetic_high_intensity_sweetener']));
    expect(formulation.rulesFired).not.toEqual(expect.arrayContaining(['allulose', 'stevia', 'monk_fruit']));
    expect(formulation.rulesSuppressed.join(' ')).toMatch(/plant_high_intensity_sweetener/);
    expect(formulation.rulesSuppressed.join(' ')).toMatch(/rare_sugar/);
  });

  it('uses standard ten-point grade bands while keeping the public A–F API', () => {
    expect([100, 90, 89, 80, 79, 70, 69, 60, 59, 0].map(productLetterGrade)).toEqual([
      'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'F', 'F'
    ]);
  });

  it('generates every negative explanation from a visible dimension contribution', () => {
    const result = scoreProductLabel(complete({
      name: 'Formulated snack',
      category: 'cereal_bar',
      ingredientsText: 'corn syrup, modified starch, protein isolate, natural flavor, xanthan gum, red 40, sucralose',
      servingNutrients: { sugar_g: 24, sodium_mg: 360, saturated_fat_g: 4, protein_g: 8, fiber_g: 1 }
    }));
    const contributionLabels = result.dimensions.flatMap((dimension) => dimension.negativeContributions.map((item) => item.label));
    for (const label of contributionLabels) {
      expect(result.considerations.some((item) => item.includes(label)), label).toBe(true);
    }
  });
});

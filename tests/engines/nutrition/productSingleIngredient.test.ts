import { describe, expect, it } from 'vitest';

import { scoreProductLabel, type ProductScoringInput } from '../../../src/engines/nutrition/productScoring';

const completeContext = {
  identityConfidence: 'high' as const,
  nutritionConfidence: 'high' as const,
  servingConfidence: 'high' as const,
  productFormConfidence: 'low' as const
};

function single(ingredient: string, overrides: Partial<ProductScoringInput> = {}) {
  return scoreProductLabel({
    name: 'Generic specimen',
    ingredientsText: ingredient,
    ingredientEvidenceStatus: 'complete',
    sourceConfidence: 'high',
    evidenceContext: completeContext,
    ...overrides
  });
}

describe('generic complete single-ingredient evidence', () => {
  it('uses completeness to support formulation simplicity without inventing identity quality', () => {
    const result = single('opaque botanical');
    const byId = (id: string) => result.dimensions.find((dimension) => dimension.id === id);

    expect(result.displayScore).toBeNull();
    expect(byId('formulation_burden')).toMatchObject({ score: expect.any(Number), evidenceState: 'supported_absence' });
    expect(byId('ingredient_integrity')?.score).toBeNull();
    expect(byId('food_structure')?.score).toBeNull();
    expect(byId('category_nutrition_fit')?.score).toBeNull();
    expect(byId('processing_purpose')?.score).toBeNull();
  });

  it('lets direct identity semantics distinguish whole, concentrated, refined, technical, and extracted ingredients', () => {
    const whole = single('whole intact seed', { categoryTags: ['seeds'], servingNutrients: { protein_g: 6, fiber_g: 5, sugar_g: 1, serving_quantity_g: 30 } });
    const sweetener = single('granulated sweetener', { servingNutrients: { sugar_g: 4, added_sugar_g: 4, serving_quantity_g: 4 } });
    const starch = single('refined isolated starch');
    const technical = single('technical thickener gum');
    const oil = single('cold pressed culinary oil');

    expect(whole.displayScore).not.toBeNull();
    expect(sweetener.displayScore).not.toBeNull();
    expect(whole.displayScore!).toBeGreaterThan(sweetener.displayScore!);
    expect(sweetener.letterGrade).not.toBe('A');
    expect(starch.letterGrade).not.toBe('A');
    expect(technical.letterGrade).not.toBe('A');
    expect(oil.letterGrade).not.toBe('A');
  });

  it('does not grant supported absence to partial or conflicting ingredient evidence', () => {
    const incomplete = single('opaque botanical', { ingredientEvidenceStatus: 'partial', sourceConfidence: 'medium' });
    const conflicting = single('opaque botanical', { evidenceContext: { ...completeContext, ingredientConflict: true, providerConflict: true } });

    for (const result of [incomplete, conflicting]) {
      expect(result.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.evidenceState).not.toBe('supported_absence');
      expect(result.displayScore).toBeNull();
    }
  });

  it('does not let favorable product naming change direct ingredient scoring', () => {
    const plain = single('refined isolated starch');
    const marketed = single('refined isolated starch', { name: 'Pure vitality whole original' });
    expect(marketed.displayScore).toBe(plain.displayScore);
    expect(marketed.letterGrade).toBe(plain.letterGrade);
  });
});

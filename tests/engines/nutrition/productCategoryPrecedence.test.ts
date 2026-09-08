import { describe, expect, it } from 'vitest';

import {
  resolveProductCategory,
  scoreProductLabel,
  type CategoryResolutionInput
} from '../../../src/engines/nutrition/productScoring';

const directEvidence = {
  ingredientEvidenceStatus: 'complete' as const,
  sourceConfidence: 'high' as const,
  evidenceContext: {
    identityConfidence: 'high' as const,
    nutritionConfidence: 'high' as const,
    servingConfidence: 'high' as const,
    productFormConfidence: 'medium' as const
  },
  servingNutrients: { calories: 160, protein_g: 5, fiber_g: 3, sugar_g: 2, sodium_mg: 140 }
};

describe('category evidence precedence', () => {
  it.each(['salt', 'sugar', 'oil'])(
    'does not let the common ingredient token %s define a multi-ingredient snack category',
    (token) => {
      const resolution = resolveProductCategory({
        name: 'Crisp snack',
        categoryTags: ['chips'],
        ingredientsText: `ground base, ${token}, seasoning`
      });

      expect(resolution.selectedCategoryId).toBe('chips');
      expect(resolution.candidates.find((candidate) => candidate.selected)).toMatchObject({
        categoryId: 'chips',
        precedence: 400,
        selectionReason: expect.stringContaining('precedence 400')
      });
      expect(resolution.candidates.flatMap((candidate) => candidate.evidence).some((item) => (
        item.level === 'individual_ingredient_token'
      ))).toBe(false);
    }
  );

  it('keeps a weak provider parent below direct product-form evidence', () => {
    const resolution = resolveProductCategory({
      name: 'Crisp snack',
      categoryTags: ['foods with sauce for meals', 'chips'],
      ingredientsText: 'ground base, seasoning'
    });

    expect(resolution.selectedCategoryId).toBe('chips');
    expect(resolution.candidates.find((candidate) => candidate.categoryId === 'condiments')).toMatchObject({
      precedence: 300,
      selected: false,
      rejectionReason: expect.stringContaining('stronger evidence precedence')
    });
  });

  it('treats grouped provider taxonomy labels as broad context rather than direct product form', () => {
    const resolution = resolveProductCategory({
      name: 'Crisp snack',
      categoryTags: ['cereals and potatoes', 'potato crisps'],
      ingredientsText: 'ground base, oil, seasoning'
    });

    expect(resolution.selectedCategoryId).toBe('chips');
    expect(resolution.candidates.find((candidate) => candidate.categoryId === 'cereal')).toMatchObject({
      precedence: 300,
      selected: false
    });
    expect(resolution.candidates.find((candidate) => candidate.categoryId === 'chips')).toMatchObject({
      precedence: 400,
      selected: true
    });
  });

  it('is invariant to provider-tag ordering and added common ingredient tokens', () => {
    const base = {
      name: 'Crisp snack',
      ingredientsText: 'ground base, seasoning'
    };
    const first = resolveProductCategory({ ...base, categoryTags: ['foods with sauce for meals', 'chips'] });
    const reordered = resolveProductCategory({ ...base, categoryTags: ['chips', 'foods with sauce for meals'] });
    const withToken = resolveProductCategory({ ...base, categoryTags: ['chips', 'foods with sauce for meals'], ingredientsText: `${base.ingredientsText}, salt` });

    expect(reordered.selectedCategoryId).toBe(first.selectedCategoryId);
    expect(reordered.selectionReason).toBe(first.selectionReason);
    expect(withToken.selectedCategoryId).toBe(first.selectedCategoryId);
  });

  it('rejects materially conflicting narrow categories and preserves scoreable broad evidence', () => {
    const input = {
      name: 'Packaged staple',
      categoryTags: ['breakfast cereals', 'canned soups'],
      ingredientsText: 'whole grain, seeds, water, sea salt'
    };
    const resolution = resolveProductCategory(input);
    const scored = scoreProductLabel({ ...input, ...directEvidence });

    expect(resolution).toMatchObject({
      selectedCategoryId: null,
      contradictionLevel: 'material_contradiction',
      interpretationConfidence: 'low'
    });
    expect(resolution.conflicts).not.toHaveLength(0);
    expect(resolution.candidates.every((candidate) => !candidate.selected)).toBe(true);
    expect(scored).toMatchObject({
      displayScore: expect.any(Number),
      generalizedFallbackUsed: true,
      categoryComparisonAvailable: false,
      scoreEligibility: { eligible: true }
    });
  });

  it('does not turn broad fallback or a favorable-sounding name into positive evidence', () => {
    const scored = scoreProductLabel({
      name: 'Pure complete vitality staple',
      categoryTags: ['breakfast cereals', 'canned soups'],
      ingredientsText: 'compound',
      ingredientEvidenceStatus: 'partial',
      evidenceContext: { identityConfidence: 'high', nutritionConfidence: 'low', servingConfidence: 'low' }
    });

    expect(scored.displayScore).toBeNull();
    expect(scored.dimensions.filter((dimension) => dimension.score !== null)).toHaveLength(0);
  });

  it('keeps singular/plural wording and ignored brand/barcode metadata out of precedence', () => {
    const base: CategoryResolutionInput = {
      name: 'Crisp snack',
      categoryTags: ['chips'],
      ingredientsText: 'ground base, seasoning'
    };
    const plural = resolveProductCategory({ ...base, categoryTags: ['chip'] });
    const singular = resolveProductCategory({ ...base, categoryTags: ['chips'] });
    const metadata = resolveProductCategory({
      ...base,
      brand: 'Arbitrary maker',
      barcode: '000000000000'
    } as CategoryResolutionInput & { brand: string; barcode: string });

    expect(plural.selectedCategoryId).toBe('chips');
    expect(singular.selectedCategoryId).toBe(plural.selectedCategoryId);
    expect(metadata.selectedCategoryId).toBe(plural.selectedCategoryId);
    expect(metadata.candidates.map((candidate) => candidate.precedence)).toEqual(
      plural.candidates.map((candidate) => candidate.precedence)
    );
  });

  it('rejects a commodity-like seasoning candidate when complete product evidence shows a multi-ingredient snack', () => {
    const input = {
      name: 'Sea salt snack',
      categoryTags: ['snacks'],
      ingredientsText: 'whole grain base, pressed oil, sea salt',
      ingredientEvidenceStatus: 'complete' as const
    };
    const resolution = resolveProductCategory(input);
    const scored = scoreProductLabel({ ...input, ...directEvidence });
    const salt = resolution.candidates.find((candidate) => candidate.categoryId === 'salt');

    expect(resolution).toMatchObject({
      selectedCategoryId: null,
      contradictionLevel: 'unsafe_narrow_classification'
    });
    expect(salt).toMatchObject({
      selected: false,
      compatibilityStatus: 'incompatible',
      rejectionReason: expect.stringContaining('product-level compatibility failed')
    });
    expect(salt?.incompatibilitySignals.join(' ')).toContain('multi-ingredient formulation');
    expect(scored).toMatchObject({
      displayScore: expect.any(Number),
      generalizedFallbackUsed: true,
      categoryComparisonAvailable: false
    });
  });

  it('still resolves a true complete single-ingredient commodity', () => {
    const resolution = resolveProductCategory({
      name: 'Sea salt',
      categoryTags: ['pantry staples'],
      ingredientsText: 'sea salt',
      ingredientEvidenceStatus: 'complete'
    });

    expect(resolution.selectedCategoryId).toBe('salt');
    expect(resolution.candidates.find((candidate) => candidate.selected)).toMatchObject({
      compatibilityStatus: 'compatible',
      compatibilitySignals: expect.arrayContaining([
        expect.stringContaining('one matching commodity ingredient')
      ])
    });
  });

  it.each([
    {
      id: 'oil modifier on snack',
      input: { name: 'Oil seasoned crisps', categoryTags: ['chips'], ingredientsText: 'grain base, vegetable oil, seasoning' },
      expected: 'chips'
    },
    {
      id: 'sugar modifier on cereal',
      input: { name: 'Sugar coated cereal', categoryTags: ['breakfast cereals'], ingredientsText: 'whole grain, sugar, spice' },
      expected: 'cereal'
    },
    {
      id: 'cheese modifier on prepared meal',
      input: { name: 'Cheese pasta meal', categoryTags: ['pasta', 'prepared foods'], ingredientsText: 'pasta, cheese, vegetables' },
      expected: 'pasta'
    },
    {
      id: 'flavor modifier on beverage',
      input: { name: 'Berry flavored soda', categoryTags: ['carbonated soft drinks', 'beverages'], ingredientsText: 'carbonated water, flavor, acid' },
      expected: 'soda'
    }
  ])('keeps the primary product category for $id', ({ input, expected }) => {
    const resolution = resolveProductCategory({
      ...input,
      ingredientEvidenceStatus: 'complete'
    });
    expect(resolution.selectedCategoryId).toBe(expected);
    expect(resolution.candidates.find((candidate) => candidate.selected)?.compatibilityStatus).toBe('compatible');
  });

  it('is invariant to modifier punctuation, capitalization, pluralization, and provider-tag order', () => {
    const variants = [
      resolveProductCategory({ name: 'SEA-SALT SNACK!', categoryTags: ['snacks', 'foods'], ingredientsText: 'grain, oil, sea salt', ingredientEvidenceStatus: 'complete' }),
      resolveProductCategory({ name: 'sea salt snacks', categoryTags: ['foods', 'snack'], ingredientsText: 'grain, oil, sea salt', ingredientEvidenceStatus: 'complete' }),
      resolveProductCategory({ name: 'Sea Salt Snack', categoryTags: ['snack', 'foods'], ingredientsText: 'grain, oil, sea salt', ingredientEvidenceStatus: 'complete' })
    ];

    expect(variants.map((resolution) => resolution.selectedCategoryId)).toEqual([null, null, null]);
    expect(variants.map((resolution) => resolution.candidates.find((candidate) => candidate.categoryId === 'salt')?.compatibilityStatus))
      .toEqual(['incompatible', 'incompatible', 'incompatible']);
  });

  it('does not let broad mixed taxonomy parents contradict a direct solid-food category', () => {
    const resolution = resolveProductCategory({
      name: 'Whole grain loaf',
      categoryTags: ['plant-based foods and beverages', 'whole grain breads'],
      ingredientsText: 'whole grain flour, water, yeast, salt',
      ingredientEvidenceStatus: 'complete'
    });

    expect(resolution.selectedCategoryId).toBe('bread');
    expect(resolution.candidates.find((candidate) => candidate.categoryId === 'bread')).toMatchObject({
      selected: true,
      compatibilityStatus: 'compatible'
    });
  });

  it('treats a category word embedded in another product form as modifier context', () => {
    const resolution = resolveProductCategory({
      name: 'Chocolate protein shake',
      categoryTags: ['beverages', 'chocolate protein shakes'],
      ingredientsText: 'water, milk protein concentrate, cocoa, natural flavor',
      ingredientEvidenceStatus: 'complete'
    });

    expect(resolution.selectedCategoryId).toBe('ready_to_drink_protein');
    expect(resolution.candidates.find((candidate) => candidate.categoryId === 'chocolate')?.evidence)
      .toEqual(expect.arrayContaining([expect.objectContaining({ source: 'provider_broad' })]));
  });
});

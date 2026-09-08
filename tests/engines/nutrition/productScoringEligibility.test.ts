import { describe, expect, it } from 'vitest';

import {
  PRODUCT_SCORE_ELIGIBILITY_POLICY,
  scoreProductLabel,
  type ProductScoringInput
} from '../../../src/engines/nutrition/productScoring';

const completeContext = {
  identityConfidence: 'high' as const,
  nutritionConfidence: 'high' as const,
  servingConfidence: 'high' as const,
  productFormConfidence: 'low' as const
};

function completeInput(overrides: Partial<ProductScoringInput> = {}): ProductScoringInput {
  return {
    name: 'Specimen alpha',
    ingredientsText: 'whole grain, seeds, water, sea salt',
    ingredientEvidenceStatus: 'complete',
    servingNutrients: { calories: 170, protein_g: 6, fiber_g: 4, sugar_g: 2, sodium_mg: 120 },
    sourceConfidence: 'high',
    evidenceContext: completeContext,
    ...overrides
  };
}

describe('generalized Product Quality score eligibility', () => {
  it('uses explicit material-evidence thresholds rather than category permission', () => {
    const result = scoreProductLabel(completeInput({ categoryTags: [] }));

    expect(PRODUCT_SCORE_ELIGIBILITY_POLICY).toEqual({
      minimumSupportedDimensions: 3,
      minimumSupportedRawWeight: 0.5,
      minimumDirectEvidenceStrength: 2,
      maximumEffectiveWeight: 0.6
    });
    expect(result).toMatchObject({
      displayScore: expect.any(Number),
      generalizedFallbackUsed: true,
      categoryComparisonAvailable: false,
      scoreBaseline: null,
      scoreEligibility: {
        eligible: true,
        exactIdentityEstablished: true,
        generalizedFallbackUsed: true
      }
    });
    expect(result.scoreEligibility.supportedDimensionCount).toBeGreaterThanOrEqual(3);
    expect(result.scoreEligibility.supportedRawWeight).toBeGreaterThanOrEqual(0.5);
    expect(result.scoreEligibility.rangeWidth).not.toBeNull();
    expect(result.reasonCodes).toContain('generalized_evidence_fallback');
  });

  it('does not let removing only a narrow category eliminate an otherwise defensible score', () => {
    const categorized = scoreProductLabel(completeInput({ category: 'cereal', categoryTags: ['breakfast cereals'] }));
    const fallback = scoreProductLabel(completeInput({ category: null, categoryTags: [] }));

    expect(categorized.scoreEligibility.eligible).toBe(true);
    expect(fallback.scoreEligibility.eligible).toBe(true);
    expect(fallback.displayScore).not.toBeNull();
    expect(fallback.generalizedFallbackUsed).toBe(true);
    expect(fallback.categoryComparisonAvailable).toBe(false);
    expect(fallback.scoreEligibility.rangeWidth!).toBeGreaterThanOrEqual(categorized.scoreEligibility.rangeWidth!);
  });

  it('keeps eligibility invariant under renaming, singular/plural wording, and category-tag order', () => {
    const inputs = [
      completeInput({ name: 'Specimen alpha', categoryTags: [] }),
      completeInput({ name: 'Specimen renamed', categoryTags: [] }),
      completeInput({ name: 'Plain specimen', categoryTags: [] }),
      completeInput({ name: 'Original specimen', categoryTags: [] }),
      completeInput({ name: 'Specimen alpha', categoryTags: ['cereals', 'soups'] }),
      completeInput({ name: 'Specimen alpha', categoryTags: ['soups', 'cereals'] })
    ];
    const results = inputs.map(scoreProductLabel);

    expect(new Set(results.map((result) => result.scoreEligibility.eligible))).toEqual(new Set([true]));
    expect(results[4]?.displayScore).toBe(results[5]?.displayScore);
    expect(results[4]?.scoreEligibility.supportedRawWeight).toBe(results[5]?.scoreEligibility.supportedRawWeight);
  });

  it('requires exact identity even when every scoring dimension is directly supported', () => {
    const result = scoreProductLabel(completeInput({
      evidenceContext: { ...completeContext, identityConfidence: 'low' }
    }));

    expect(result).toMatchObject({ displayScore: null, letterGrade: null });
    expect(result.scoreEligibility).toMatchObject({
      eligible: false,
      exactIdentityEstablished: false,
      deniedReasons: expect.arrayContaining(['exact_identity_not_established'])
    });
  });

  it('keeps one weak dimension, partial ingredients alone, and nutrition alone as honest no-score states', () => {
    const fixtures: ProductScoringInput[] = [
      {
        name: 'Specimen beta', ingredientsText: null, ingredientEvidenceStatus: 'absent',
        servingNutrients: { calories: 180, protein_g: 10, fiber_g: 4, sugar_g: 3, sodium_mg: 150 },
        evidenceContext: completeContext
      },
      {
        name: 'Specimen gamma', ingredientsText: 'water', ingredientEvidenceStatus: 'partial',
        sourceConfidence: 'low', evidenceContext: { ...completeContext, nutritionConfidence: 'low', servingConfidence: 'low' }
      },
      {
        name: 'Specimen delta', ingredientsText: null, ingredientEvidenceStatus: 'absent',
        nutrimentsPer100g: { protein_g: 3 },
        evidenceContext: { ...completeContext, nutritionConfidence: 'low', servingConfidence: 'low' }
      }
    ];

    for (const fixture of fixtures) {
      const result = scoreProductLabel(fixture);
      expect(result.displayScore).toBeNull();
      expect(result.scoreEligibility.eligible).toBe(false);
      expect(result.scoreEligibility.deniedReasons).toEqual(expect.arrayContaining([
        'insufficient_supported_dimension_count',
        'insufficient_supported_dimension_weight'
      ]));
    }
  });

  it('allows complete ingredients to support a bounded result when nutrition or serving data are unavailable', () => {
    for (const fixture of [
      completeInput({ servingNutrients: undefined, nutrimentsPer100g: undefined, evidenceContext: { ...completeContext, nutritionConfidence: 'low', servingConfidence: 'low' } }),
      completeInput({ servingNutrients: undefined, nutrimentsPer100g: { protein_g: 6, fiber_g: 4, sugar_g: 2, sodium_mg: 120 }, evidenceContext: { ...completeContext, servingConfidence: 'low' } })
    ]) {
      const result = scoreProductLabel(fixture);
      expect(result.displayScore).not.toBeNull();
      expect(result.scoreEligibility.eligible).toBe(true);
      expect(result.generalizedFallbackUsed).toBe(true);
      expect(result.scoreRange).not.toBeNull();
    }
  });

  it('keeps a complete unfamiliar single base unsupported rather than treating simplicity as quality', () => {
    const result = scoreProductLabel({
      name: 'Specimen epsilon',
      ingredientsText: 'moringa',
      ingredientEvidenceStatus: 'complete',
      sourceConfidence: 'medium',
      evidenceContext: { identityConfidence: 'high', nutritionConfidence: 'low', servingConfidence: 'low', productFormConfidence: 'low' }
    });

    expect(result.displayScore).toBeNull();
    expect(result.letterGrade).toBeNull();
    expect(result.scoreBaseline).toBeNull();
    expect(result.archetype).toMatchObject({ contextMode: 'evidence_fallback', confidence: 'low' });
    expect(result.dimensions.find((dimension) => dimension.id === 'formulation_burden')?.evidenceState).toBe('supported_absence');
    expect(result.dimensions.find((dimension) => dimension.id === 'ingredient_integrity')?.score).toBeNull();
    expect(result.scoreEligibility).toMatchObject({ eligible: false, directEvidenceKinds: ['ingredients'] });
  });

  it('keeps provider conflicts out of the central equation while widening uncertainty', () => {
    const clear = scoreProductLabel(completeInput());
    const conflicted = scoreProductLabel(completeInput({
      evidenceContext: { ...completeContext, providerConflict: true }
    }));

    expect(conflicted.displayScore).toBe(clear.displayScore);
    expect(conflicted.scoreEligibility.rangeWidth!).toBeGreaterThan(clear.scoreEligibility.rangeWidth!);
    expect(conflicted.dimensionAggregation.supportedWeightedSum).toBe(clear.dimensionAggregation.supportedWeightedSum);
  });

  it('keeps evidence removal from appearing more certain or escaping the prior evidence envelope', () => {
    const full = scoreProductLabel(completeInput({
      ingredientsText: 'water, pea protein isolate, vegetable oil blend, natural flavor, methylcellulose, modified starch',
      servingNutrients: { calories: 220, protein_g: 20, fiber_g: 2, sodium_mg: 420 }
    }));
    const reduced = scoreProductLabel(completeInput({
      ingredientsText: 'water, pea protein isolate, vegetable oil blend, natural flavor, methylcellulose, modified starch',
      servingNutrients: undefined,
      evidenceContext: { ...completeContext, nutritionConfidence: 'low', servingConfidence: 'low' }
    }));

    expect(reduced.scoreScope).toBe('supported_evidence');
    expect(reduced.scoreEligibility.rangeWidth!).toBeGreaterThan(full.scoreEligibility.rangeWidth!);
    expect(reduced.scoreRange![0]).toBeLessThanOrEqual(full.displayScore!);
    expect(reduced.scoreRange![1]).toBeGreaterThanOrEqual(full.displayScore!);
  });

  it('does not let a favorable-sounding name override contradictory direct ingredients', () => {
    const result = scoreProductLabel(completeInput({
      name: 'Purified water',
      categoryTags: [],
      ingredientsText: 'corn syrup, vegetable oil blend, artificial flavor, red 40, modified starch',
      servingNutrients: { calories: 190, sugar_g: 38, sodium_mg: 80 }
    }));

    expect(result.letterGrade).not.toBe('A');
    expect(result.dimensions.some((dimension) => dimension.negativeContributions.length > 0)).toBe(true);
    expect(result.scoreEligibility.eligible).toBe(true);
  });

  it('covers adversarial evidence combinations without relying on named product categories', () => {
    const fixtures: Array<{ id: string; input: ProductScoringInput; eligible: boolean }> = [
      { id: 'complete single solid', input: completeInput({ name: 'Specimen one', ingredientsText: 'moringa', servingNutrients: undefined }), eligible: false },
      { id: 'complete single pantry', input: completeInput({ name: 'Specimen two', ingredientsText: 'whole sesame seeds', servingNutrients: undefined }), eligible: true },
      { id: 'complete plain plant', input: completeInput({ name: 'Specimen three', ingredientsText: 'whole green vegetable' }), eligible: true },
      { id: 'complete whole seed', input: completeInput({ name: 'Specimen four', ingredientsText: 'whole chia seed' }), eligible: true },
      { id: 'complete multi ingredient', input: completeInput({ name: 'Specimen five', ingredientsText: 'whole corn, oil, sea salt, natural flavor' }), eligible: true },
      { id: 'complete mixed preparation', input: completeInput({ name: 'Specimen six', ingredientsText: 'water, beans, brown rice, tomatoes, onions, olive oil, sea salt' }), eligible: true },
      { id: 'complete reconstruction', input: completeInput({ name: 'Specimen seven', ingredientsText: 'water, pea protein isolate, oil blend, natural flavor, methylcellulose, modified starch' }), eligible: true },
      { id: 'metadata only', input: { name: 'Specimen eight', categoryTags: ['snacks'], ingredientEvidenceStatus: 'absent', evidenceContext: completeContext }, eligible: false },
      { id: 'ingredients no serving', input: completeInput({ name: 'Specimen nine', servingNutrients: undefined }), eligible: true },
      { id: 'nutrition no ingredients', input: completeInput({ name: 'Specimen ten', ingredientsText: null, ingredientEvidenceStatus: 'absent' }), eligible: false },
      { id: 'conflicting records', input: completeInput({ name: 'Specimen eleven', evidenceContext: { ...completeContext, providerConflict: true } }), eligible: true },
      { id: 'weak partial evidence', input: { name: 'Specimen twelve', ingredientsText: 'water', ingredientEvidenceStatus: 'partial', evidenceContext: completeContext }, eligible: false }
    ];

    for (const fixture of fixtures) {
      const result = scoreProductLabel(fixture.input);
      expect(result.scoreEligibility.eligible, fixture.id).toBe(fixture.eligible);
      expect(result.displayScore === null, fixture.id).toBe(!fixture.eligible);
      if (fixture.eligible) {
        expect(result.generalizedFallbackUsed, fixture.id).toBe(true);
        expect(result.scoreBaseline, fixture.id).toBeNull();
        if (result.gradeEligibility?.aEligible === false) {
          expect(result.displayScore, fixture.id).toBeLessThan(result.rawScore!);
          expect(result.scoreLedger.some((entry) => entry.ruleId === 'grade_eligibility_adjustment'), fixture.id).toBe(true);
        } else {
          expect(result.displayScore, fixture.id).toBe(result.rawScore);
        }
      }
    }
  });
});

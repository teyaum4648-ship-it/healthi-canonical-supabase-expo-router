import { describe, expect, it } from 'vitest';

import {
  productGradeCertainty,
  scoreProductLabel
} from '../../../src/engines/nutrition/productScoring';
import { buildProductQualityScorePresentation } from '../../../src/features/nutrition/productLookup/productQualityPresentation';
import type { ProductQualitySnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

function quality(overrides: Partial<ProductQualitySnapshot> = {}): ProductQualitySnapshot {
  return {
    score: 71,
    central_score: 71,
    label: 'steady',
    summary: 'Bounded result.',
    positives: [],
    considerations: [],
    confidence: 'low',
    reason_codes: [],
    letter_grade: 'C',
    result_state: 'provisional',
    estimated_score_range: [35, 90],
    estimated_grade_range: ['A', 'F'],
    grade_certainty: productGradeCertainty(71, [35, 90]),
    ...overrides
  };
}

describe('score-range and grade certainty', () => {
  it('derives stable, provisional, and unresolved states from crossed grade boundaries', () => {
    expect(productGradeCertainty(85, [81, 89])).toMatchObject({ state: 'stable', boundariesCrossed: 0, gradesSpanned: ['B'] });
    expect(productGradeCertainty(85, [78, 88])).toMatchObject({ state: 'stable', boundariesCrossed: 1, gradesSpanned: ['C', 'B'] });
    expect(productGradeCertainty(71, [35, 95])).toMatchObject({ state: 'unresolved', boundariesCrossed: 4, gradesSpanned: ['F', 'D', 'C', 'B', 'A'] });
    expect(productGradeCertainty(85, [78, 88])).toMatchObject({ state: 'stable', boundariesCrossed: 1 });
    expect(productGradeCertainty(80, [78, 82])).toMatchObject({ state: 'provisional', boundariesCrossed: 1 });
  });

  it('keeps confidence separate and never suppresses a wide-range central score', () => {
    const low = buildProductQualityScorePresentation(quality({ confidence: 'low' }));
    const high = buildProductQualityScorePresentation(quality({ confidence: 'high' }));

    expect(low.grade).toBe('C?');
    expect(low.scoreLine).toBe('Score 71');
    expect(low.stateLine).toBe('Provisional');
    expect(low.gradeCertaintyLine).toContain('Grade uncertain');
    expect(low.rangeLine).toContain('35–90');
    expect(high.grade).toBe(low.grade);
    expect(high.gradeCertaintyLine).toBe(low.gradeCertaintyLine);
    expect(high.confidenceLine).not.toBe(low.confidenceLine);
  });

  it('renders a normal grade for a narrow stable range', () => {
    const presentation = buildProductQualityScorePresentation(quality({
      score: 85,
      central_score: 85,
      letter_grade: 'B',
      confidence: 'high',
      result_state: 'estimated',
      estimated_score_range: [81, 89],
      estimated_grade_range: ['B', 'B'],
      grade_certainty: productGradeCertainty(85, [81, 89])
    }));

    expect(presentation).toMatchObject({ grade: 'B', scoreLine: 'Score 85', stateLine: 'Estimated', gradeCertaintyLine: null });
  });

  it('keeps every calculated central score inside a bounded 0–100 range', () => {
    const inputs = [
      {
        name: 'Generic staple', ingredientsText: 'whole grain, seeds, water, sea salt', ingredientEvidenceStatus: 'complete' as const,
        servingNutrients: { calories: 170, protein_g: 6, fiber_g: 4, sugar_g: 2, sodium_mg: 120 }
      },
      {
        name: 'Generic formulated snack', ingredientsText: 'base, syrup, oil blend, natural flavor, color, modified starch', ingredientEvidenceStatus: 'complete' as const,
        servingNutrients: { calories: 250, protein_g: 2, fiber_g: 1, sugar_g: 22, sodium_mg: 420 },
        evidenceContext: { providerConflict: true }
      }
    ];

    for (const input of inputs) {
      const result = scoreProductLabel({
        sourceConfidence: 'high',
        evidenceContext: {
          identityConfidence: 'high', nutritionConfidence: 'high', servingConfidence: 'high',
          ...input.evidenceContext
        },
        ...input
      });
      expect(result.displayScore).not.toBeNull();
      expect(result.scoreRange?.[0]).toBeGreaterThanOrEqual(0);
      expect(result.scoreRange?.[1]).toBeLessThanOrEqual(100);
      expect(result.scoreRange?.[0]).toBeLessThanOrEqual(result.displayScore!);
      expect(result.scoreRange?.[1]).toBeGreaterThanOrEqual(result.displayScore!);
      expect(result.gradeCertainty).not.toBeNull();
    }
  });
});

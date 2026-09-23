import { describe, expect, it } from 'vitest';

import { calculateNourishmentScore } from '../../../src/engines/nutrition/calculateNourishmentScore';
import { MICRONUTRIENTS } from '../../../src/engines/nutrition/micronutrients';
import { nourishmentContribution } from '../../../src/engines/readiness';
import type {
  FoodQualitySummary,
  FoodResponseSummary,
  NutrientSummary,
  NutritionTargets
} from '../../../src/engines/nutrition/types';

/**
 * The nourishment pillar.
 *
 * The point of it is the sentence the app could not previously say: "of course you feel
 * like a 60 — you have eaten once and it was mostly sugar." That needs two things this
 * tests. The score has to be built from terms that can be named afterwards, and it has to
 * be allowed to matter: nutrition used to reach readiness as five points of range, which
 * meant a week of bad eating moved the day less than one short night.
 */

const DATE = '2026-08-11';

const targets: NutritionTargets = {
  calories_target: 2200,
  protein_g_target: 140,
  carbs_g_target: 240,
  fat_g_target: 75,
  fiber_g_target: 30,
  sodium_mg_limit: 2300,
  confidence: 'high',
  basis: ['onboarding']
};

function summary(overrides: Partial<NutrientSummary> = {}): NutrientSummary {
  return {
    date: DATE,
    meal_count: 3,
    calories: 2200,
    protein_g: 140,
    carbs_g: 230,
    fat_g: 70,
    fiber_g: 30,
    sugar_g: 40,
    sodium_mg: 1800,
    targets,
    target_progress: {},
    micronutrients: Object.fromEntries(MICRONUTRIENTS.map((item) => [item.id, item.dailyValue])),
    micronutrient_coverage: { reported: MICRONUTRIENTS.length, tracked: MICRONUTRIENTS.length, fraction: 1 },
    confidence: 'high',
    reason_codes: [],
    ...overrides
  };
}

const quality = (score: number | null): FoodQualitySummary => ({
  date: DATE, score, label: 'steady', flags: [], confidence: 'high', reason_codes: []
});

const response = (label: FoodResponseSummary['label']): FoodResponseSummary => ({
  date: DATE,
  label,
  digestion_signal: 'neutral',
  energy_signal: 'neutral',
  appetite_signal: 'neutral',
  confidence: 'high',
  reason_codes: []
});

const score = (over: Partial<NutrientSummary> = {}, q: number | null = 85, r: FoodResponseSummary['label'] = 'steady') =>
  calculateNourishmentScore({ date: DATE, nutrientSummary: summary(over), foodQuality: quality(q), foodResponse: response(r), targets });

describe('the nourishment pillar', () => {
  it('scores a day that hit everything near the top', () => {
    const result = score();
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.coverage).toBe(1);
    expect(result.confidence).toBe('high');
    expect(result.limiters).toEqual([]);
  });

  it('scores a thin day low and names what made it thin', () => {
    const result = score({ calories: 700, protein_g: 30, fiber_g: 4, micronutrients: {}, micronutrient_coverage: { reported: 0, tracked: MICRONUTRIENTS.length, fraction: 0 } }, 35, 'watch');
    expect(result.score).toBeLessThan(45);
    expect(result.limiters.length).toBeGreaterThan(0);
    // The limiter is the thing to act on, so it has to be the heaviest drag, not the first.
    expect(result.limiters[0].weight * (1 - (result.limiters[0].value ?? 0)))
      .toBeGreaterThanOrEqual(result.limiters[1].weight * (1 - (result.limiters[1].value ?? 0)));
    expect(result.summary.toLowerCase()).toContain(result.limiters[0].label.toLowerCase());
  });

  it('does not reward eating far past the target', () => {
    // Energy is a band, not a ladder: 4000 kcal against a 2200 target is not a better day.
    const onTarget = score().contributors.find((c) => c.id === 'energy')!.value!;
    const wayOver = score({ calories: 4000 }).contributors.find((c) => c.id === 'energy')!.value!;
    expect(onTarget).toBe(1);
    expect(wayOver).toBeLessThan(0.3);
  });

  it('withholds the micronutrient term rather than scoring a sliver of the panel', () => {
    // Two of twenty-seven says nothing about a day, and scoring it anyway would let one
    // fortified cereal carry a fifth of the pillar.
    const thin = score({
      micronutrients: { vitamin_c: 90, iron: 18 },
      micronutrient_coverage: { reported: 2, tracked: MICRONUTRIENTS.length, fraction: 2 / MICRONUTRIENTS.length }
    });
    const term = thin.contributors.find((c) => c.id === 'micronutrients')!;
    expect(term.value).toBeNull();
    expect(term.detail).toContain('too thin');
  });

  it('drops unknown terms instead of counting them as failures', () => {
    // Fibre alone is unreported. The five terms that are known carry the score, and the
    // missing one neither drags it down nor is scored as a zero.
    const withGap = score({ fiber_g: null });
    const fibre = withGap.contributors.find((c) => c.id === 'fiber')!;

    expect(fibre.value).toBeNull();
    expect(withGap.coverage).toBeLessThan(1);
    expect(withGap.score).toBeGreaterThan(80);
    expect(withGap.limiters.map((limiter) => limiter.id)).not.toContain('fiber');
  });

  it('withholds a score when too little of the pillar is known to speak for it', () => {
    /*
     * This began as a real defect on screen. The movement pillar showed "100 / 100 — in
     * good shape this week" for a profile with nothing logged, because one term had data
     * and trivially scored full marks. Coverage was 9% and confidence was 'low', and
     * neither mattered: people read the number.
     */
    const almostNothing = calculateNourishmentScore({
      date: DATE,
      nutrientSummary: summary({ targets: null }),
      foodQuality: quality(null),
      foodResponse: response('unknown'),
      targets: null
    });

    expect(almostNothing.coverage).toBeLessThan(0.4);
    expect(almostNothing.score).toBeNull();
    expect(almostNothing.confidence).toBe('low');
    // The terms are still reported, so the screen can say what is missing.
    expect(almostNothing.contributors.find((c) => c.id === 'micronutrients')!.value).not.toBeNull();
  });

  it('returns no score at all rather than inventing one', () => {
    const nothing = calculateNourishmentScore({
      date: DATE,
      nutrientSummary: summary({
        meal_count: 0, calories: null, protein_g: null, fiber_g: null, targets: null,
        micronutrients: {}, micronutrient_coverage: { reported: 0, tracked: MICRONUTRIENTS.length, fraction: 0 }
      }),
      foodQuality: quality(null),
      foodResponse: response('unknown'),
      targets: null
    });

    expect(nothing.score).toBeNull();
    expect(nothing.confidence).toBe('low');
    expect(nothing.reason_codes).toContain('nourishment_not_yet_measurable');
  });
});

describe('what food is allowed to do to the day', () => {
  it('maps the pillar onto readiness points, asymmetrically', () => {
    expect(nourishmentContribution(100)).toBeCloseTo(10, 6);
    expect(nourishmentContribution(70)).toBeCloseTo(0, 6);
    expect(nourishmentContribution(0)).toBeCloseTo(-18, 6);
    // Falling short costs more than excelling pays.
    expect(Math.abs(nourishmentContribution(40)!)).toBeGreaterThan(nourishmentContribution(100)!);
  });

  it('moves the score in the direction the food actually went', () => {
    // The sign error this test caught on the way in had a terrible day adding points.
    expect(nourishmentContribution(30)).toBeLessThan(0);
    expect(nourishmentContribution(90)).toBeGreaterThan(0);
  });

  it('gives no reading when there is no pillar score', () => {
    expect(nourishmentContribution(null)).toBeNull();
    expect(nourishmentContribution(undefined)).toBeNull();
    expect(nourishmentContribution(Number.NaN)).toBeNull();
  });
});

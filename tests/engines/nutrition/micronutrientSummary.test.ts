import { describe, expect, it } from 'vitest';

import { calculateNutrientSummary } from '../../../src/engines/nutrition/calculateNutrientSummary';
import { MICRONUTRIENTS } from '../../../src/engines/nutrition/micronutrients';
import type { MealLog } from '../../../src/engines/nutrition/types';

/**
 * Micronutrients across a day.
 *
 * The rule the macros already follow, applied to the panel: a total is summed over the
 * meals that reported the nutrient, and the meals that did not are neither counted as
 * zero nor allowed to drag the figure down. What changes is that the summary now has to
 * say how much of the panel it could read at all, because a vitamin C total drawn from
 * one of three meals is a true number about an incomplete day.
 */

const DATE = '2026-08-03';

function meal(overrides: Partial<MealLog> = {}): MealLog {
  return {
    logged_at: `${DATE}T12:30:00.000Z`,
    meal_type: 'lunch',
    name: 'Lunch',
    source: 'manual',
    source_confidence: 'high',
    calories: 400,
    protein_g: 20,
    quality_flags: [],
    reason_codes: [],
    created_at: `${DATE}T12:31:00.000Z`,
    ...overrides
  };
}

describe('micronutrient totals for a day', () => {
  it('sums only across the meals that reported each nutrient', () => {
    const summary = calculateNutrientSummary({
      date: DATE,
      meals: [
        meal({ micronutrients: { vitamin_c: 30, iron: 2 } }),
        meal({ micronutrients: { vitamin_c: 12 } }),
        meal({ micronutrients: null })
      ]
    });

    expect(summary.micronutrients.vitamin_c).toBeCloseTo(42, 6);
    expect(summary.micronutrients.iron).toBeCloseTo(2, 6);
  });

  it('leaves a nutrient nobody reported absent rather than zero', () => {
    const summary = calculateNutrientSummary({
      date: DATE,
      meals: [meal({ micronutrients: { vitamin_c: 30 } })]
    });

    // The difference matters on screen: absent reads "Not reported", zero reads "none".
    expect(Object.keys(summary.micronutrients)).toEqual(['vitamin_c']);
    expect(summary.micronutrients.folate).toBeUndefined();
  });

  it('reports how much of the panel it could read', () => {
    const summary = calculateNutrientSummary({
      date: DATE,
      meals: [meal({ micronutrients: { vitamin_c: 30, iron: 2, calcium: 100 } })]
    });

    expect(summary.micronutrient_coverage.reported).toBe(3);
    expect(summary.micronutrient_coverage.tracked).toBe(MICRONUTRIENTS.length);
    expect(summary.micronutrient_coverage.fraction).toBeCloseTo(3 / MICRONUTRIENTS.length, 6);
  });

  it('flags a day too thin to read anything into', () => {
    const thin = calculateNutrientSummary({ date: DATE, meals: [meal({ micronutrients: { iron: 2 } })] });
    expect(thin.reason_codes).toContain('micronutrient_coverage_thin');

    const full = calculateNutrientSummary({
      date: DATE,
      meals: [meal({ micronutrients: Object.fromEntries(MICRONUTRIENTS.map((item) => [item.id, 1])) })]
    });
    expect(full.reason_codes).not.toContain('micronutrient_coverage_thin');
  });

  it('does not flag thin coverage on a day with nothing logged', () => {
    // Nothing logged is not thin data, it is no data, and the empty-day copy says so.
    const summary = calculateNutrientSummary({ date: DATE, meals: [] });
    expect(summary.reason_codes).not.toContain('micronutrient_coverage_thin');
    expect(summary.micronutrients).toEqual({});
    expect(summary.micronutrient_coverage.reported).toBe(0);
  });

  it('never lets a missing panel move the macro totals', () => {
    // The whole point of the rule: reading fewer nutrients must not change the ones read.
    const withPanel = calculateNutrientSummary({
      date: DATE,
      meals: [meal({ micronutrients: { vitamin_c: 30 } })]
    });
    const withoutPanel = calculateNutrientSummary({ date: DATE, meals: [meal()] });

    expect(withPanel.calories).toBe(withoutPanel.calories);
    expect(withPanel.protein_g).toBe(withoutPanel.protein_g);
  });
});

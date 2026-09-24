import { describe, expect, it } from 'vitest';

import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';
import { composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';


function createMeal(overrides: Partial<MealLog> = {}): MealLog {
  return {
    logged_at: '2026-06-12T12:00:00.000Z',
    meal_type: 'lunch',
    name: 'Lunch bowl',
    source: 'manual',
    source_confidence: 'medium',
    calories: 620,
    protein_g: 42,
    carbs_g: 58,
    fat_g: 22,
    fiber_g: 10,
    sugar_g: 8,
    sodium_mg: 640,
    ingredients: null,
    quality_flags: ['balanced_meal', 'whole_food_emphasis'],
    user_response: {
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable',
      cravings: 'none',
      notes: null
    },
    corrected_by_user: false,
    confirmed_by_user: true,
    reason_codes: ['manual_food_log'],
    created_at: '2026-06-12T12:01:00.000Z',
    ...overrides
  };
}

const nutritionTargets: NutritionTargets = {
  calories_target: 700,
  protein_g_target: 45,
  carbs_g_target: 70,
  fat_g_target: 28,
  fiber_g_target: 10,
  sodium_mg_limit: 2300,
  confidence: 'medium',
  basis: ['manual_adjustment']
};


describe('the dashboard nutrition summary', () => {
  it('maps real nutrition engine outputs into the dashboard nutrition summary', () => {
    const summary = composeDashboardNutritionSummary({
      date: '2026-06-12',
      meals: [createMeal()],
      targets: nutritionTargets
    });

    expect(summary.meal_count).toBe(1);
    expect(summary.calorie_label).toBe('620 / 700');
    expect(summary.protein_label).toBe('42g / 45g');
    expect(summary.food_quality_label).toBe('Supportive');
    expect(summary.food_response_label).toBe('Steady');
    expect(summary.readiness_support_label).toBe("Logged meals are supporting today's readiness.");
    expect(summary.confidence).toBe('medium');
    expect(summary.source_label).toBe('logged');
  });

  it('returns a calibrating nutrition state when meal data is missing', () => {
    const summary = composeDashboardNutritionSummary({
      date: '2026-06-12',
      meals: [],
      targets: nutritionTargets
    });

    expect(summary.meal_count).toBe(0);
    expect(summary.calorie_label).toBe('Calibrating');
    expect(summary.protein_label).toBe('Calibrating');
    expect(summary.food_quality_label).toBe('Calibrating');
    expect(summary.food_response_label).toBe('Calibrating');
    expect(summary.confidence).toBe('low');
    expect(summary.readiness_adjustment).toBe(0);
    expect(summary.next_action).toBe('Log a meal to improve today’s fueling signal.');
  });
  it('contributes nothing and lowers confidence when nothing was logged', () => {
    const without = composeDashboardNutritionSummary({ date: '2026-06-12', meals: [], targets: nutritionTargets });
    const with_ = composeDashboardNutritionSummary({ date: '2026-06-12', meals: [createMeal()], targets: nutritionTargets });
    /*
     * Missing data lowers confidence rather than the score. The two bounds that used to
     * follow pinned a [-3, +2] squash applied to days that DID have data, which is what
     * kept food from ever moving readiness — a week of eating badly moved the day less
     * than one short night. What is asserted now is the rule, not the old constant.
     */
    expect(without.confidence).toBe('low');
    expect(without.readiness_adjustment).toBe(0);
    expect(without.nourishment_score).toBeNull();
    expect(with_.readiness_adjustment).not.toBe(0);
    expect(with_.nourishment_score).not.toBeNull();
  });

  it('does not introduce blocked language in generated copy', () => {
    const output = JSON.stringify(composeDashboardNutritionSummary({
      date: '2026-06-12', meals: [createMeal()], targets: nutritionTargets
    })).toLowerCase();
    const blockedTerms = [
      'che' + 'k', 'h' + 'lc', 'primal ' + 'pattern', 'work-' + 'in', 'diag' + 'nosis',
      'diag' + 'nose', 'treat' + 'ment', 'c' + 'ure', 'pre' + 'scribe', 'pre' + 'scription',
      'ad' + 'renal', 'h' + 'pa', 'cor' + 'tisol', 'hor' + 'mone', 'clin' + 'ical',
      'medical ' + 'decision', 'dys' + 'regulated', 'dys' + 'function', 'de' + 'tox',
      'tox' + 'in', 'tox' + 'ic', 'clean' + 'se', 'cheat ' + 'meal', 'guilt-' + 'free',
      'bad ' + 'food', 'metabolic ' + 'type', 'metabolic ' + 'typing', '4 doc' + 'tors'
    ];
    for (const term of blockedTerms) expect(output).not.toContain(term);
  });
});

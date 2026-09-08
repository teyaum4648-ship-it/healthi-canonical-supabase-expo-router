import { describe, expect, it } from 'vitest';

import { calculateFoodPatternProfile, getFoodPatternResultCopy } from '../../../src/engines/nutrition';
import type { FoodPatternAnswers, FoodPatternLabel, FoodPatternProfile } from '../../../src/engines/nutrition';

const baseAnswers: Required<FoodPatternAnswers> = {
  protein_meal_energy: 'neutral',
  carb_meal_energy: 'steady',
  hunger_frequency: 'three_to_four_hours',
  cravings_pattern: 'rare',
  large_meal_digestion: 'fine',
  higher_fat_meal_response: 'neutral',
  breakfast_skip_response: 'fine',
  afternoon_energy: 'steady',
  late_dinner_response: 'fine',
  heavy_dinner_sleep: 'unchanged',
  training_fuel_need: 'normal_meals',
  appetite_stability: 'predictable',
  meal_size_preference: 'three_balanced',
  caffeine_food_sensitivity: 'fine',
  stress_life_load_eating: 'steady',
  morning_fueling_pattern: 'no_breakfast'
};

function makeProfile(label: FoodPatternLabel): FoodPatternProfile {
  const profile = calculateFoodPatternProfile({ answers: baseAnswers, now: '2026-07-01T12:00:00.000Z' });
  return {
    ...profile,
    pattern_label: label,
    confidence: label === 'calibrating' ? 'low' : 'medium'
  };
}

describe('getFoodPatternResultCopy', () => {
  it('returns copy for every profile label', () => {
    const labels: FoodPatternLabel[] = [
      'steady_balanced',
      'protein_forward',
      'carb_supported',
      'lighter_frequent',
      'evening_sensitive',
      'calibrating'
    ];

    for (const label of labels) {
      const copy = getFoodPatternResultCopy(makeProfile(label));

      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.summary.length).toBeGreaterThan(0);
      expect(copy.confidence_note.length).toBeGreaterThan(0);
    }
  });

  it('uses tentative confidence language', () => {
    const copy = getFoodPatternResultCopy(makeProfile('protein_forward'));

    expect(copy.summary.toLowerCase()).toContain('may support');
    expect(copy.confidence_note.toLowerCase()).toContain('confidence');
    expect(copy.confidence_note.toLowerCase()).toContain('refining');
  });

  it('does not introduce blocked language in user-facing copy', () => {
    const labels: FoodPatternLabel[] = [
      'steady_balanced',
      'protein_forward',
      'carb_supported',
      'lighter_frequent',
      'evening_sensitive',
      'calibrating'
    ];
    const blockedTerms = [
      'diag' + 'nosis',
      'diag' + 'nose',
      'treat' + 'ment',
      'c' + 'ure',
      'pre' + 'scribe',
      'pre' + 'scription',
      'ad' + 'renal',
      'h' + 'pa',
      'cor' + 'tisol',
      'hor' + 'mone',
      'clin' + 'ical',
      'medical ' + 'decision',
      'dys' + 'regulated',
      'dys' + 'function',
      'de' + 'tox',
      'tox' + 'in',
      'tox' + 'ic',
      'clean' + 'se',
      'cheat ' + 'meal',
      'guilt-' + 'free',
      'bad ' + 'food',
      'metabolic ' + 'type',
      'metabolic ' + 'typing',
      'che' + 'k',
      'h' + 'lc',
      '4 doctors',
      'primal pattern',
      'work-in'
    ];

    for (const label of labels) {
      const output = JSON.stringify(getFoodPatternResultCopy(makeProfile(label))).toLowerCase();

      for (const term of blockedTerms) {
        expect(output).not.toContain(term);
      }
    }
  });
});

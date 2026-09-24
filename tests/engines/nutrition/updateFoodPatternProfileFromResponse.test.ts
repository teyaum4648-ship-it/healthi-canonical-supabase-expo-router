import { describe, expect, it } from 'vitest';

import {
  calculateFoodPatternProfile,
  scoreFoodPatternMealResponse,
  updateFoodPatternProfileFromResponse
} from '../../../src/engines/nutrition';
import type { FoodPatternAnswers } from '../../../src/engines/nutrition';

const now = '2026-07-01T12:00:00.000Z';
const answers: Required<FoodPatternAnswers> = {
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

function baseProfile() {
  return calculateFoodPatternProfile({ answers, now });
}

describe('food pattern response loop', () => {
  it('scores supportive meal responses', () => {
    const result = scoreFoodPatternMealResponse({
      meal_style: 'protein_forward',
      energy: 5,
      digestion: 4,
      appetite_stability: 5,
      cravings: false,
      response_count: 3
    });

    expect(result.label).toBe('supportive');
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.confidence).toBe('medium');
    expect(result.reason_codes).toContain('protein_forward_signal');
  });

  it('scores watch responses and includes response reasons', () => {
    const result = scoreFoodPatternMealResponse({
      meal_style: 'carb_supported',
      energy: 1,
      digestion: 2,
      appetite_stability: 2,
      cravings: true
    });

    expect(result.label).toBe('watch');
    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toEqual(
      expect.arrayContaining(['afternoon_energy_dip', 'digestion_sensitivity', 'appetite_instability'])
    );
  });

  it('nudges a profile toward supportive repeated responses', () => {
    const profile = baseProfile();
    const updated = updateFoodPatternProfileFromResponse({
      profile,
      response: {
        meal_style: 'protein_forward',
        energy: 5,
        digestion: 5,
        appetite_stability: 5,
        cravings: false,
        response_count: 8,
        responded_at: '2026-07-02T12:00:00.000Z'
      }
    });

    expect(updated.source).toBe('adaptive_update');
    expect(updated.updated_at).toBe('2026-07-02T12:00:00.000Z');
    expect(updated.scores.protein_forward).toBe(profile.scores.protein_forward + 2);
    expect(updated.reason_codes).toContain('protein_forward_signal');

    /*
     * These answers read as steady-balanced, and the responses here are about
     * protein-forward meals. They move that style's score, which is the point — but they
     * are not evidence about the label that is actually leading, so they do not make the
     * app more sure of it. This assertion used to expect 'high', which is the borrowed
     * confidence the evidence rule exists to stop.
     */
    expect(updated.pattern_label).toBe(profile.pattern_label);
    expect(updated.confidence).toBe(profile.confidence);
  });

  it('does not set high confidence from a single response', () => {
    const updated = updateFoodPatternProfileFromResponse({
      profile: baseProfile(),
      response: {
        meal_style: 'lighter_frequent',
        energy: 5,
        digestion: 5,
        appetite_stability: 5,
        cravings: false,
        response_count: 1
      },
      now: '2026-07-02T12:00:00.000Z'
    });

    expect(updated.confidence).not.toBe('high');
  });

  it('updates response tendencies from watch responses', () => {
    const updated = updateFoodPatternProfileFromResponse({
      profile: baseProfile(),
      response: {
        meal_style: 'carb_supported',
        energy: 1,
        digestion: 2,
        appetite_stability: 2,
        cravings: true,
        response_count: 3
      },
      now: '2026-07-02T12:00:00.000Z'
    });

    expect(updated.response_tendencies).toEqual({
      digestion: 'sensitive',
      energy: 'dip_prone',
      appetite: 'hungry_soon'
    });
  });

  it('keeps response-loop output serializable', () => {
    const updated = updateFoodPatternProfileFromResponse({
      profile: baseProfile(),
      response: {
        meal_style: 'evening_sensitive',
        energy: 4,
        digestion: 4,
        appetite_stability: 4,
        cravings: false,
        response_count: 5
      },
      now: '2026-07-02T12:00:00.000Z'
    });

    expect(JSON.parse(JSON.stringify(updated))).toEqual(updated);
  });

  it('does not introduce blocked language in response-loop output', () => {
    const updated = updateFoodPatternProfileFromResponse({
      profile: baseProfile(),
      response: {
        meal_style: 'evening_sensitive',
        energy: 2,
        digestion: 2,
        appetite_stability: 2,
        cravings: true,
        response_count: 3
      },
      now: '2026-07-02T12:00:00.000Z'
    });
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
    const output = JSON.stringify(updated).toLowerCase();

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});

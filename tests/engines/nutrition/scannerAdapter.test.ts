import { describe, expect, it } from 'vitest';

import {
  adaptScannedProductToMealLog,
  calculateFoodQuality,
  calculateNutrientSummary
} from '../../../src/engines/nutrition';
import type { NutritionTargets, ScannedProductInput } from '../../../src/engines/nutrition';

const loggedAt = '2026-07-01T12:00:00.000Z';

const targets: NutritionTargets = {
  calories_target: 2200,
  protein_g_target: 140,
  fiber_g_target: 30,
  sodium_mg_limit: 2300,
  confidence: 'medium',
  basis: ['onboarding']
};

describe('adaptScannedProductToMealLog', () => {
  it('scales scanned product nutrients into a MealLog', () => {
    const product: ScannedProductInput = {
      product_name: 'Greek yogurt',
      nova_group: 2,
      nutriments: {
        'energy-kcal_100g': 100,
        proteins_100g: 10,
        carbohydrates_100g: 5,
        fat_100g: 3,
        fiber_100g: 0,
        sugars_100g: 4,
        sodium_100g: 0.05
      }
    };
    const meal = adaptScannedProductToMealLog({
      product,
      servingGrams: 170,
      loggedAt,
      mealType: 'snack'
    });

    expect(meal.name).toBe('Greek yogurt');
    expect(meal.meal_type).toBe('snack');
    expect(meal.source).toBe('barcode_pending');
    expect(meal.source_confidence).toBe('medium');
    expect(meal.calories).toBe(170);
    expect(meal.protein_g).toBe(17);
    expect(meal.carbs_g).toBe(8.5);
    expect(meal.fat_g).toBe(5.1);
    expect(meal.sodium_mg).toBe(85);
  });

  it('maps product signals to existing quality flags and reason codes', () => {
    const product: ScannedProductInput = {
      product_name: 'Packaged bar',
      nova_group: 4,
      additives_n: 5,
      nutriments: {
        energy_kcal_100g: 450,
        proteins_100g: 5,
        carbohydrates_100g: 65,
        fat_100g: 18,
        fiber_100g: 2,
        sugars_100g: 30,
        sodium_mg_100g: 700
      }
    };
    const meal = adaptScannedProductToMealLog({ product, servingGrams: 100, loggedAt });

    expect(meal.quality_flags).toEqual(
      expect.arrayContaining(['ultra_processed_indicator', 'added_sugar', 'high_sodium', 'protein_low', 'low_fiber'])
    );
    expect(meal.reason_codes).toEqual(
      expect.arrayContaining(['processing_level_high', 'added_sugar_high', 'sodium_high', 'protein_low', 'fiber_low'])
    );
  });

  it('converts salt grams to sodium milligrams once and ignores negative values', () => {
    const meal = adaptScannedProductToMealLog({
      product: {
        product_name: 'Salt reference',
        nutriments: { salt_100g: 80, sodium_100g: -1 }
      },
      servingGrams: 5,
      loggedAt
    });
    expect(meal.sodium_mg).toBe(1600);
  });

  it('uses low confidence and partial data reasons when nutrition fields are sparse', () => {
    const meal = adaptScannedProductToMealLog({
      product: { product_name: 'Unknown item', nutriments: null },
      servingGrams: 100,
      loggedAt
    });

    expect(meal.source_confidence).toBe('low');
    expect(meal.calories).toBeNull();
    expect(meal.reason_codes).toEqual(expect.arrayContaining(['source_low_confidence', 'partial_nutrition_data']));
  });

  it('marks user-corrected scanned products as confirmed with high confidence when core data exists', () => {
    const meal = adaptScannedProductToMealLog({
      product: {
        product_name: 'Corrected bowl',
        nutriments: {
          'energy-kcal_100g': 160,
          proteins_100g: 12,
          carbohydrates_100g: 20,
          fat_100g: 4
        }
      },
      servingGrams: 250,
      loggedAt,
      source: 'user_corrected'
    });

    expect(meal.source_confidence).toBe('high');
    expect(meal.corrected_by_user).toBe(true);
    expect(meal.confirmed_by_user).toBe(true);
  });

  it('feeds existing nutrient and quality calculations without special handling', () => {
    const meal = adaptScannedProductToMealLog({
      product: {
        product_name: 'Rice chicken bowl',
        nova_group: 2,
        nutriments: {
          'energy-kcal_100g': 150,
          proteins_100g: 11,
          carbohydrates_100g: 18,
          fat_100g: 4,
          fiber_100g: 3,
          sugars_100g: 2,
          sodium_100g: 0.12
        }
      },
      servingGrams: 400,
      loggedAt,
      mealType: 'lunch'
    });
    const nutrientSummary = calculateNutrientSummary({ date: '2026-07-01', meals: [meal], targets });
    const quality = calculateFoodQuality({ date: '2026-07-01', meals: [meal], nutrientSummary });

    expect(nutrientSummary.meal_count).toBe(1);
    expect(nutrientSummary.calories).toBe(600);
    expect(quality.confidence).toBe('medium');
    expect(JSON.parse(JSON.stringify({ meal, nutrientSummary, quality }))).toEqual({ meal, nutrientSummary, quality });
  });

  it('does not introduce blocked language in adapter output', () => {
    const meal = adaptScannedProductToMealLog({
      product: {
        product_name: 'Simple item',
        nutriments: {
          'energy-kcal_100g': 120,
          proteins_100g: 8,
          carbohydrates_100g: 20,
          fat_100g: 2
        }
      },
      servingGrams: 100,
      loggedAt
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
    const output = JSON.stringify(meal).toLowerCase();

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});

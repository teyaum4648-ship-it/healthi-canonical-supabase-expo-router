import { describe, expect, it } from 'vitest';

import {
  resolveProductIdentity,
  validateNutritionData
} from '../../../src/features/nutrition/productLookup/nutritionValidation';
import {
  mergeProviderRecords,
  type ResolverProviderRecord
} from '../../../supabase/functions/_shared/productDataResolver';

const completeValues = {
  calories: 200,
  protein_g: 10,
  carbs_g: 30,
  fat_g: 4,
  saturated_fat_g: 1,
  fiber_g: 5,
  sugar_g: 3,
  added_sugar_g: 0,
  sodium_mg: 100,
  caffeine_mg: 0
};

function validate(overrides: Partial<Parameters<typeof validateNutritionData>[0]> = {}) {
  return validateNutritionData({
    source: 'synthetic_provider',
    values: completeValues,
    basis: 'PER_SERVING',
    servingQuantity: 50,
    servingUnit: 'g',
    servingDescription: '1 portion (50 g)',
    ingredientsText: 'whole grain, seeds, sea salt',
    categoryAvailable: true,
    categories: ['whole grain foods'],
    ...overrides
  });
}

function provider(providerName: ResolverProviderRecord['provider'], calories: number): ResolverProviderRecord {
  const scale = calories / 200;
  return {
    provider: providerName,
    status: 'found',
    recordId: providerName === 'open_food_facts' ? '898248001411' : 'synthetic-secondary-record',
    updatedAt: providerName === 'open_food_facts' ? '2026-01-01' : '2026-02-01',
    fields: {
      canonical_gtin: '898248001411',
      name: 'Whole grain fixture',
      brand: 'Fixture foods',
      ingredients_text: 'whole grain, seeds, sea salt',
      serving_size: '1 portion (100 g)',
      serving_quantity: 100,
      serving_unit: 'g',
      calories,
      protein_g: 10 * scale,
      carbs_g: 30 * scale,
      fat_g: 4 * scale,
      saturated_fat_g: 1 * scale,
      fiber_g: 5 * scale,
      sugar_g: 3 * scale,
      added_sugar_g: 0,
      sodium_mg: 100 * scale,
      caffeine_mg: 0,
      categories: ['whole grain foods'],
      labels: [],
      packaging: []
    }
  };
}

describe('nutrition validation and provider resolution', () => {
  it('T01 rejects zero added sugar when a caloric added sweetener is declared', () => {
    const result = validate({ ingredientsText: 'whole grain, cane sugar, sea salt' });
    expect(result.nutrients.added_sugar_g).toMatchObject({ value: null, reliability: 'CONFLICTED' });
    expect(result.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ADDED_SUGAR_INGREDIENT_CONFLICT' })
    ]));
    expect(result.requiresFallback).toBe(true);
  });

  it('T02 rejects added sugar greater than total sugar', () => {
    const result = validate({ values: { ...completeValues, sugar_g: 3, added_sugar_g: 8 } });
    expect(result.nutrients.added_sugar_g.value).toBeNull();
    expect(result.validationIssues.map((issue) => issue.code)).toContain('ADDED_SUGAR_EXCEEDS_TOTAL_SUGAR');
  });

  it('T03 rejects near-zero sodium when meaningful sodium ingredients are declared', () => {
    const result = validate({ values: { ...completeValues, sodium_mg: 0 }, ingredientsText: 'beans, sea salt, sodium citrate' });
    expect(result.nutrients.sodium_mg).toMatchObject({ value: null, reliability: 'CONFLICTED' });
    expect(result.validationIssues.map((issue) => issue.code)).toContain('SODIUM_INGREDIENT_CONFLICT');
  });

  it('T04 rejects an implausible metric-only package-to-serving relationship', () => {
    const result = validate({
      servingQuantity: 5,
      servingDescription: '5 g',
      packageQuantity: 1_000,
      packageUnit: 'g'
    });
    expect(result.serving).toMatchObject({ value: null, reliability: 'UNRELIABLE' });
    expect(result.validationIssues.map((issue) => issue.code)).toContain('SERVING_PACKAGE_RATIO_IMPLAUSIBLE');
  });

  it('T05 rejects a nutrient mass that exceeds represented food mass', () => {
    const result = validate({ servingQuantity: 30, values: { ...completeValues, protein_g: 60 } });
    expect(result.nutrients.protein_g).toMatchObject({ value: null, reliability: 'UNRELIABLE' });
    expect(result.validationIssues.map((issue) => issue.code)).toContain('NUTRIENT_EXCEEDS_FOOD_MASS');
  });

  it('T06 rejects energy that materially conflicts with compatible macros', () => {
    const result = validate({
      servingQuantity: 100,
      values: { ...completeValues, calories: 10, protein_g: 10, carbs_g: 10, fat_g: 10, fiber_g: 0 }
    });
    expect(result.nutrients.calories).toMatchObject({ value: null, reliability: 'CONFLICTED' });
    expect(result.validationIssues.map((issue) => issue.code)).toContain('ENERGY_MACRO_CONFLICT');
  });

  it('T07 rejects conflicting per-serving and per-100 representations', () => {
    const result = validate({ values: { ...completeValues, sugar_g: 10 }, per100g: { sugar_g: 2 } });
    expect(result.nutrients.sugar_g.value).toBeNull();
    expect(result.validationIssues.map((issue) => issue.code)).toContain('SERVING_100G_CONFLICT');
  });

  it('T08 preserves absent nutrient values as missing rather than zero', () => {
    const result = validate({ values: { ...completeValues, fiber_g: null } });
    expect(result.nutrients.fiber_g).toMatchObject({ value: null, reliability: 'MISSING' });
    expect(result.fallbackReasons).toContain('fiber_g:missing');
  });

  it('T09 treats missing category evidence as fallback-worthy without fabricating a category', () => {
    const result = validate({ categoryAvailable: false, categories: [] });
    expect(result.fallbackReasons).toContain('category:missing');
    expect(result.categoryResolution).toEqual({ category: null, confidence: 0, source: [] });
    expect(result.requiresFallback).toBe(true);
  });

  it('T10 rejects a weak secondary identity match despite an asserted barcode match', () => {
    const identity = resolveProductIdentity({
      barcodeMatch: true,
      primaryBrand: 'North field',
      secondaryBrand: 'South market',
      primaryName: 'Whole grain loaf',
      secondaryName: 'Vanilla dairy dessert',
      primaryIngredients: 'whole wheat, water, yeast',
      secondaryIngredients: 'milk, cream, sugar'
    });
    expect(identity).toMatchObject({ accepted: false, confidence: 0.65 });
    const primary = provider('open_food_facts', 200);
    const secondary = provider('usda_food_data_central', 240);
    secondary.fields = {
      ...secondary.fields,
      name: 'Vanilla dairy dessert',
      brand: 'South market',
      ingredients_text: 'milk, cream, sugar'
    };
    const merged = mergeProviderRecords('898248001411', [primary, secondary]);
    expect(merged.status).toBe('resolved');
    if (merged.status !== 'resolved') return;
    expect(merged.product).toMatchObject({
      calories_per_serving: 200,
      product_identity_resolution: { accepted: false, confidence: 0.65 }
    });
  });

  it('T11 leaves materially conflicting provider nutrient values unresolved', () => {
    const result = mergeProviderRecords('898248001411', [
      provider('open_food_facts', 200),
      provider('usda_food_data_central', 300)
    ]);
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.product.calories_per_serving).toBeNull();
    expect(result.product.validation_issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PROVIDER_NUTRIENT_CONFLICT', field: 'calories' })
    ]));
  });

  it('T12 passes a complete internally consistent label without fallback', () => {
    const result = validate();
    expect(result.validationIssues).toEqual([]);
    expect(result.requiresFallback).toBe(false);
    expect(result.nutrients.protein_g).toMatchObject({ value: 10, reliability: 'KNOWN' });
  });

  it('T13 marks an unambiguous unit-scale correction as derived', () => {
    const result = validate({
      values: { ...completeValues, sodium_mg: 0.12 },
      per100g: { sodium_mg: 240 },
      ingredientsText: 'whole grain, sea salt'
    });
    expect(result.nutrients.sodium_mg).toMatchObject({ value: 120, reliability: 'ESTIMATED', derived: true });
    expect(result.validationIssues.map((issue) => issue.code)).toContain('UNIT_SCALE_CORRECTED_FROM_REDUNDANT_FIELD');
  });

  it('T14 isolates one invalid field while preserving unrelated known values', () => {
    const result = validate({ values: { ...completeValues, sodium_mg: -1 } });
    expect(result.nutrients.sodium_mg).toMatchObject({ value: null, reliability: 'UNRELIABLE' });
    expect(result.nutrients.protein_g).toMatchObject({ value: 10, reliability: 'KNOWN' });
    expect(result.nutrients.fiber_g).toMatchObject({ value: 5, reliability: 'KNOWN' });
  });
});

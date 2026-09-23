import { describe, expect, it } from 'vitest';
import { normalizeUsdaSearchFood } from '../../../src/features/nutrition/productLookup/foodSearchClient';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { foodLoggingNutrition } from '../../../src/features/nutrition/foodLoggingNutrition';
import { metricServing, metricServingFromText } from '../../../src/features/nutrition/labelServing';
import { addMealBuilderItem, createEmptyMealBuilder, calculateMealBuilderTotals, mealBuilderItemToPersistenceInput, userFoodProductRowToSnapshot } from '../../../src/features/nutrition/mealBuilder';
import { toUserFoodProductInsert, type UserFoodProductRow } from '../../../src/features/nutrition/productLibraryPersistence';

const raw = { fdcId: 123, description: 'Example food', servingSize: 53, servingSizeUnit: 'g', householdServingFullText: '1 bun', foodNutrients: [
  { nutrientId: 1008, unitName: 'KCAL', value: 250 }, { nutrientId: 1003, unitName: 'G', value: 10 },
  { nutrientId: 1093, unitName: 'MG', value: 400 }, { nutrientId: 2000, unitName: 'G', value: 0 }
] };
describe('label servings in search and logging', () => {
  it('defaults to the actual bun serving and scales calories, macros and sodium once', () => {
    const p = normalizeUsdaSearchFood(raw)!;
    const before = JSON.stringify(p);
    expect(foodLoggingNutrition(p)).toMatchObject({ basis: 'serving', label: '1 bun (53 g)', amountPerPortion: 1, nutrients: { calories: 132.5, protein_g: 5.3, sodium_mg: 212, sugar_g: 0, fat_g: null } });
    expect(p.nutriments_per_100g?.calories).toBe(250);
    expect(JSON.stringify(p)).toBe(before);
  });
  it.each([0.5, 1, 2, 1.25])('logs %s labeled portions accurately', servings => {
    const p = normalizeUsdaSearchFood(raw)!;
    const builder = addMealBuilderItem(createEmptyMealBuilder(), { id: 'test', snapshot: p, source: 'search', servings });
    expect(calculateMealBuilderTotals(builder.items).calories).toBeCloseTo(132.5 * servings, 0);
    const item = mealBuilderItemToPersistenceInput(builder.items[0], 'meal', '2026-09-11T12:00:00Z', 'lunch', true);
    expect(item.serving_size).toBe('1 bun (53 g)');
    expect(item.serving_quantity_g).toBe(53);
    expect(item.calories).toBeCloseTo(132.5 * servings, 0);
  });
  it('retains portions in a saved food without changing scoring evidence', () => {
    const builder = addMealBuilderItem(createEmptyMealBuilder(), { snapshot: normalizeUsdaSearchFood(raw)!, source: 'search' });
    const { snapshot, quality } = builder.items[0];
    const row = toUserFoodProductInsert({ ...snapshot, quality }, 'demo-user') as UserFoodProductRow;
    const hydrated = userFoodProductRowToSnapshot(row);
    expect(foodLoggingNutrition(hydrated)).toEqual(foodLoggingNutrition(snapshot));
  });
  it('uses explicit milliliter units without assigning gram weight', () => {
    const p = normalizeUsdaSearchFood({ ...raw, servingSize: 240, servingSizeUnit: 'mL', householdServingFullText: '1 cup' })!;
    expect(p.nutriments_per_100g).toBeUndefined();
    expect(foodLoggingNutrition(p)).toMatchObject({ label: '1 cup (240 mL)', quantityG: null, nutrients: { calories: 600 } });
  });
  it('does not multiply already reported per-serving values again', () => {
    const p = normalizeOpenFoodFactsProduct('12345678', { product_name: 'Yogurt', serving_size: '1 container (170 g)', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 10 } })!;
    expect(foodLoggingNutrition(p).nutrients.calories).toBe(102);
  });
  it('retains a volume-based fallback even when the serving quantity is absent', () => {
    const p = normalizeUsdaSearchFood({ ...raw, servingSize: undefined, servingSizeUnit: 'mL', householdServingFullText: '' })!;
    expect(foodLoggingNutrition(p)).toMatchObject({ basis: 'per_100ml', label: '100 mL', quantityG: null });
  });
  it.each(['1 slice', '2 bars', '17 crackers', 'about 1 cup', '1 can'])('does not invent a weight for %s', household => {
    const p = normalizeUsdaSearchFood({ ...raw, servingSize: undefined, servingSizeUnit: undefined, householdServingFullText: household })!;
    expect(foodLoggingNutrition(p)).toMatchObject({ basis: 'per_100g', label: '100 g', amountPerPortion: 100 });
  });
  it('uses explicit metric equivalents and weight ounces, not fluid ounces or product names', () => {
    expect(metricServingFromText('2 bars (40 g)')).toEqual({ quantity: 40, unit: 'g' });
    expect(metricServing(2, 'oz')?.quantity).toBeCloseTo(56.699);
    expect(metricServing(2, 'fl oz')).toBeNull();
    expect(metricServing(0, 'g')).toBeNull();
    expect(metricServingFromText('1 cup')).toBeNull();
  });
});

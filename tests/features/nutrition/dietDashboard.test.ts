import { describe, expect, it } from 'vitest';
import { dietWeek, intakeProgress } from '../../../src/features/nutrition/dietDashboardModel';
import { foodLoggingNutrition } from '../../../src/features/nutrition/foodLoggingNutrition';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import { addMealBuilderItem, calculateMealBuilderTotals, createEmptyMealBuilder, mealBuilderItemToPersistenceInput, mealBuilderToAggregateMealLog } from '../../../src/features/nutrition/mealBuilder';

describe('Diet intake presentation', () => {
  it('keeps an unreported intake separate from an explicit zero', () => {
    expect(intakeProgress(null, 2000)).toEqual({ amount: null, target: 2000, fraction: null, remaining: null });
    expect(intakeProgress(0, 2000)).toEqual({ amount: 0, target: 2000, fraction: 0, remaining: 2000 });
  });
  it('does not fabricate a target or turn over-target intake into a health grade', () => {
    expect(intakeProgress(2200, 2000)).toEqual({ amount: 2200, target: 2000, fraction: 1, remaining: -200 });
    expect(intakeProgress(500, 0).fraction).toBeNull();
    expect(intakeProgress(-3, Infinity).amount).toBeNull();
    expect(intakeProgress(NaN, 20).amount).toBeNull();
  });
  it('builds continuous selectable weeks across month and year boundaries', () => {
    expect(dietWeek('2027-01-01')).toEqual(['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });
});

describe('food logging nutrition basis', () => {
  const weighed = () => normalizeOpenFoodFactsProduct('12345678', {
    product_name: 'Oat flakes', ingredients_text: 'Whole oats', categories_tags: ['en:oats'],
    nutriments: { 'energy-kcal_100g': 380, proteins_100g: 13, carbohydrates_100g: 65, fat_100g: 7 }
  })!;
  it('uses an explicit weighed portion when the published record has no label serving', () => {
    const snapshot = weighed();
    const original = JSON.stringify(snapshot);
    const quality = calculateProductQuality(snapshot);
    const logging = foodLoggingNutrition(snapshot);
    expect(logging).toMatchObject({ basis: 'per_100g', label: '100 g', amountUnit: 'g', amountPerPortion: 100, quantityG: 100 });
    const builder = addMealBuilderItem(createEmptyMealBuilder(), { snapshot, source: 'search', servings: 0.5 });
    expect(calculateMealBuilderTotals(builder.items)).toMatchObject({ calories: 190, protein_g: 6.5, carbs_g: 32.5, fat_g: 3.5, sodium_mg: null });
    expect(mealBuilderToAggregateMealLog(builder).calories).toBe(190);
    const saved = mealBuilderItemToPersistenceInput(builder.items[0], 'meal-1', '2026-09-10T12:00:00Z', 'breakfast');
    expect(saved).toMatchObject({ servings: 0.5, serving_size: '100 g', serving_quantity_g: 100, calories: 190, metadata: { logging_nutrient_basis: 'per_100g' } });
    expect(builder.items[0].quality).toEqual(quality);
    expect(JSON.stringify(snapshot)).toBe(original);
    expect(snapshot.calories_per_serving).toBeNull();
  });
  it('keeps liquid density in milliliters and never assumes a mass conversion', () => {
    const snapshot = { ...weighed(), nutriments_per_100g: undefined, nutriments_per_100ml: { calories: 40, carbs_g: 10 } };
    expect(foodLoggingNutrition(snapshot)).toMatchObject({ basis: 'per_100ml', label: '100 mL', quantityG: null, amountUnit: 'mL' });
    const builder = addMealBuilderItem(createEmptyMealBuilder(), { snapshot, source: 'search', servings: 2.5 });
    expect(calculateMealBuilderTotals(builder.items)).toMatchObject({ calories: 100, carbs_g: 25, protein_g: null });
  });
  it('preserves existing serving nutrition, including zero, without mixing bases', () => {
    const snapshot = { ...weighed(), serving_size: '1 portion', calories_per_serving: 0, protein_g: null };
    const logging = foodLoggingNutrition(snapshot);
    expect(logging).toMatchObject({ basis: 'serving', label: '1 portion', nutrients: { calories: 0, protein_g: null } });
  });
  it('keeps unavailable and invalid nutrition explicit', () => {
    const snapshot = { ...weighed(), nutriments_per_100g: { calories: -20, protein_g: NaN }, nutriments_per_100ml: undefined };
    expect(foodLoggingNutrition(snapshot)).toMatchObject({ basis: 'unreported', nutrients: { calories: null, protein_g: null } });
  });
});

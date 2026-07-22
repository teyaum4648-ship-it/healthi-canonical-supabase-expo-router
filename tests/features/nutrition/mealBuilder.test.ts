import { describe, expect, it } from 'vitest';

import {
  addMealBuilderItem,
  calculateMealBuilderTotals,
  createEmptyManualProductForm,
  createEmptyMealBuilder,
  mealBuilderItemToPersistenceInput,
  mealBuilderToAggregateMealLog,
  removeMealBuilderItem,
  updateMealBuilderItemServings,
  validateManualProductForm
} from '../../../src/features/nutrition/mealBuilder';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

const oats: HealthiProductSnapshot = {
  barcode: '012345678905',
  provider: 'open_food_facts',
  provider_product_id: '012345678905',
  name: 'Protein oats',
  brand: 'Test Foods',
  serving_size: '50 g',
  serving_quantity_g: 50,
  calories_per_serving: 220,
  protein_g: 14,
  carbs_g: 31,
  fat_g: 6,
  saturated_fat_g: 1,
  fiber_g: 5,
  sugar_g: 7,
  sodium_mg: 180,
  ingredients_text: 'Oats, seeds, whey',
  categories_tags: ['protein cereal'],
  ingredient_evidence: {
    resolved_text: 'Oats, seeds, whey', raw_text: 'Oats, seeds, whey', source_field: 'ingredients_text', language: 'en',
    structured_ingredients: [], status: 'complete', confidence: 'high', reconstructed: false, conflicts: []
  },
  quality_flags: ['balanced_meal'],
  confidence: 'high',
  reason_codes: ['product_label_data', 'fiber_supportive']
};

const yogurt: HealthiProductSnapshot = {
  ...oats,
  barcode: '',
  provider: 'manual',
  provider_product_id: null,
  name: 'Greek yogurt',
  calories_per_serving: 120,
  protein_g: 17,
  carbs_g: 7,
  fat_g: 3,
  fiber_g: null,
  sugar_g: 6,
  sodium_mg: 65,
  ingredients_text: null,
  ingredient_evidence: undefined,
  categories_tags: undefined,
  quality_flags: [],
  confidence: 'medium',
  reason_codes: ['manual_food_log']
};

describe('meal builder helpers', () => {
  it('adds foods, updates servings, and recomputes meal totals', () => {
    const first = addMealBuilderItem(createEmptyMealBuilder(), { snapshot: oats, source: 'scanner', id: 'oats' });
    const builder = addMealBuilderItem(first, { snapshot: yogurt, source: 'manual', id: 'yogurt', servings: 2 });
    const adjusted = updateMealBuilderItemServings(builder, 'oats', '1.5');

    expect(calculateMealBuilderTotals(adjusted.items)).toEqual({
      calories: 570,
      protein_g: 55,
      carbs_g: 60.5,
      fat_g: 15,
      fiber_g: 7.5,
      sugar_g: 22.5,
      sodium_mg: 400,
      saturated_fat_g: 3.5
    });
    expect(adjusted.items[0]?.quality.result_state).toBe('final');
    expect(adjusted.items[1]?.quality.result_state).toBe('estimated');
  });

  it('removes a builder item without changing the source snapshot', () => {
    const builder = addMealBuilderItem(createEmptyMealBuilder(), { snapshot: oats, source: 'scanner', id: 'oats' });
    const next = removeMealBuilderItem(builder, 'oats');

    expect(next.items).toEqual([]);
    expect(oats.name).toBe('Protein oats');
    expect(oats.reason_codes).toEqual(['product_label_data', 'fiber_supportive']);
  });

  it('creates an aggregate meal for the existing daily summaries plus detailed items', () => {
    const first = addMealBuilderItem({ ...createEmptyMealBuilder(), name: 'Breakfast', meal_type: 'breakfast' }, { snapshot: oats, source: 'scanner', id: 'oats' });
    const builder = addMealBuilderItem(first, { snapshot: yogurt, source: 'manual', id: 'yogurt' });
    const meal = mealBuilderToAggregateMealLog(builder, '2026-07-12T08:30:00.000Z', true);
    const item = mealBuilderItemToPersistenceInput(builder.items[0]!, 'meal-1', meal.logged_at, meal.meal_type, true);

    expect(meal).toMatchObject({
      name: 'Breakfast',
      meal_type: 'breakfast',
      source: 'demo',
      calories: 340,
      protein_g: 31,
      reason_codes: expect.arrayContaining(['manual_food_log', 'barcode_food_logged', 'product_label_data'])
    });
    expect(item).toMatchObject({
      meal_log_id: 'meal-1',
      name: 'Protein oats',
      servings: 1,
      calories: 220,
      source: 'demo',
      barcode: '012345678905'
    });
    expect(JSON.parse(JSON.stringify({ meal, item }))).toEqual({ meal, item });
  });

  it('validates manual products safely before adding them', () => {
    expect(validateManualProductForm(createEmptyManualProductForm())).toEqual({
      valid: false,
      message: 'Add a food name before saving it.'
    });
    expect(validateManualProductForm({ ...createEmptyManualProductForm(), name: 'Yogurt', protein_g: '-2' })).toEqual({
      valid: false,
      message: 'Use zero or a positive number for nutrition facts.'
    });

    const result = validateManualProductForm({
      ...createEmptyManualProductForm(),
      name: 'Yogurt',
      brand: 'Test Dairy',
      serving_size: '170 g',
      calories: '120',
      protein_g: '17'
    });
    expect(result).toMatchObject({ valid: true, snapshot: { provider: 'manual', name: 'Yogurt', protein_g: 17 } });
  });

  it('keeps builder output free of blocked language', () => {
    const builder = addMealBuilderItem(createEmptyMealBuilder(), { snapshot: oats, source: 'scanner' });
    const output = JSON.stringify(mealBuilderToAggregateMealLog(builder)).toLowerCase();
    const blockedTerms = ['diag' + 'nosis', 'treat' + 'ment', 'c' + 'ure', 'ad' + 'renal', 'h' + 'pa', 'cor' + 'tisol', 'clin' + 'ical', 'de' + 'tox', 'tox' + 'ic', 'clean' + 'se', 'cheat ' + 'meal', 'guilt-' + 'free', 'bad ' + 'food', 'metabolic ' + 'type', 'che' + 'k', 'scout ' + 'score', 'bobby ' + 'approved'];
    for (const term of blockedTerms) expect(output).not.toContain(term);
  });
});

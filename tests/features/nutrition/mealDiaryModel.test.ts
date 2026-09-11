import { describe, expect, it } from 'vitest';
import { chooseMealDraft, mealSectionsForDay } from '../../../src/features/nutrition/mealDiaryModel';
import { addMealBuilderItem, createEmptyMealBuilder, mealBuilderToAggregateMealLog, mealBuilderItemToPersistenceInput } from '../../../src/features/nutrition/mealBuilder';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import type { MealLog } from '../../../src/engines/nutrition';

const food = normalizeOpenFoodFactsProduct('12345678', { product_name: 'Oats', serving_size: '40 g', nutriments: { 'energy-kcal_100g': 400 } })!;
describe('visible meal sections and meal-first logging', () => {
  it('shows all four meal choices even on an empty day', () => {
    expect(mealSectionsForDay([], '2026-09-10').map(section => [section.label, section.meals.length, section.calories])).toEqual([
      ['Breakfast', 0, null], ['Lunch', 0, null], ['Dinner', 0, null], ['Snacks', 0, null]
    ]);
  });
  it('groups only the selected day, preserves multiple meals, and keeps old unclassified meals visible', () => {
    const meals = [
      { id: '1', logged_at: '2026-09-10T08:00:00Z', meal_type: 'breakfast', calories: 200 },
      { id: '2', logged_at: '2026-09-10T09:00:00Z', meal_type: 'breakfast', calories: null },
      { id: '3', logged_at: '2026-09-10T12:00:00Z', meal_type: 'lunch', calories: 400 },
      { id: '4', logged_at: '2026-09-10T14:00:00Z', meal_type: 'unknown', calories: 100 },
      { id: '5', logged_at: '2026-09-09T08:00:00Z', meal_type: 'breakfast', calories: 999 }
    ] as MealLog[];
    const sections = mealSectionsForDay(meals, '2026-09-10');
    expect(sections[0]).toMatchObject({ calories: 200, partial: true, meals: [{ id: '1' }, { id: '2' }] });
    expect(sections[1]).toMatchObject({ calories: 400, partial: false });
    expect(sections[4]).toMatchObject({ label: 'Other meals', meals: [{ id: '4' }] });
  });
  it.each(['breakfast', 'lunch', 'dinner', 'snack'] as const)('carries %s from selection through search/scan builder and persistence', type => {
    const selected = chooseMealDraft(createEmptyMealBuilder(), type);
    const builder = addMealBuilderItem(selected.draft, { snapshot: food, source: 'search', servings: 1.5 });
    const log = mealBuilderToAggregateMealLog(builder, '2026-09-10T12:00:00Z');
    const item = mealBuilderItemToPersistenceInput(builder.items[0], 'meal-1', log.logged_at, log.meal_type);
    expect(log).toMatchObject({ meal_type: type, calories: 240 });
    expect(item).toMatchObject({ meal_type: type, calories: 240, servings: 1.5 });
  });
  it('does not discard or reclassify an unfinished meal when another section is tapped', () => {
    const builder = addMealBuilderItem({ ...createEmptyMealBuilder(), name: 'My breakfast', meal_type: 'breakfast' }, { snapshot: food, source: 'scanner' });
    const blocked = chooseMealDraft(builder, 'lunch');
    expect(blocked.status).toBe('blocked'); expect(blocked.draft).toBe(builder);
    expect(chooseMealDraft(builder, 'breakfast').draft.items).toBe(builder.items);
  });
  it('allows an existing unclassified draft to receive its first meal type without losing foods', () => {
    const builder = addMealBuilderItem(createEmptyMealBuilder(), { snapshot: food, source: 'manual' });
    const result = chooseMealDraft(builder, 'dinner');
    expect(result.status).toBe('ready'); expect(result.draft.meal_type).toBe('dinner'); expect(result.draft.items).toBe(builder.items);
  });
});

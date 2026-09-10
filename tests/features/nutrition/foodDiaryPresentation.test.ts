import { describe, expect, it } from 'vitest';
import type { MealLog } from '../../../src/engines/nutrition';
import { findPersonalFoods, loggedAtForDay, mealsForDay, portionValue } from '../../../src/features/nutrition/foodDiaryPresentation';
import type { UserFoodProductRow } from '../../../src/features/nutrition/productLibraryPersistence';

function food(id: string, name: string, brand: string, saved = false, last = '2026-09-08T12:00:00Z'): UserFoodProductRow {
  return { id, name, brand, is_saved: saved, last_used_at: last, updated_at: last } as UserFoodProductRow;
}
describe('food diary presentation', () => {
  it('matches words across names and brands without changing provider data', () => {
    const foods = [food('a', 'Plain yogurt', 'Market', true), food('b', 'Oat drink', 'Kitchen')];
    expect(findPersonalFoods(foods, '  MARKET yogurt ')).toEqual([foods[0]]);
    expect(foods[0].name).toBe('Plain yogurt');
  });
  it('Saved includes saved foods outside the six most recent results', () => {
    const foods = Array.from({ length: 12 }, (_, i) => food(String(i), `Food ${i}`, 'Label', i === 11));
    expect(findPersonalFoods(foods, '', true).map((item) => item.id)).toEqual(['11']);
  });
  it('sorts recent foods without reordering the source collection', () => {
    const older = food('a', 'A', 'One'), newer = food('b', 'B', 'Two', false, '2026-09-09T12:00:00Z');
    const foods = [older, newer];
    expect(findPersonalFoods(foods, '')).toEqual([newer, older]);
    expect(foods).toEqual([older, newer]);
  });
  it('keeps diary rows on their recorded day and in time order', () => {
    const meals = [{ id: 'late', logged_at: '2026-09-09T18:00:00Z', calories: null }, { id: 'other', logged_at: '2026-09-08T12:00:00Z' }, { id: 'early', logged_at: '2026-09-09T08:00:00Z' }] as MealLog[];
    expect(mealsForDay(meals, '2026-09-09').map((meal) => meal.id)).toEqual(['early', 'late']);
    expect(mealsForDay(meals, '2026-09-09')[1].calories).toBeNull();
    expect(meals[0].id).toBe('late');
  });
  it('allows fractional portions without accepting blanks, negative or nonnumeric values', () => {
    expect(portionValue('0.5')).toBe(0.5);
    expect(portionValue(' 1.25 ')).toBe(1.25);
    for (const value of ['', ' ', '0', '0.', '-1', 'Infinity', 'NaN', '21', 'two']) expect(portionValue(value)).toBeNull();
  });
  it('logs a chosen diary day without shifting its UTC clock or recording a meal today instead', () => {
    expect(loggedAtForDay('2026-09-07', '2026-09-09T17:24:12.000Z')).toBe('2026-09-07T17:24:12.000Z');
  });
});

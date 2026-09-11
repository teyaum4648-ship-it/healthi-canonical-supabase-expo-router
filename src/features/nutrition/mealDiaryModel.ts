import type { MealLog, MealType } from '../../engines/nutrition';
import type { MealBuilderState } from './mealBuilder';
import { mealsForDay } from './foodDiaryPresentation';

export const diaryMealChoices = [
  { type: 'breakfast', label: 'Breakfast' }, { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' }, { type: 'snack', label: 'Snacks' }
] as const;
export const mealTypeLabel = (type: MealType) => diaryMealChoices.find(choice => choice.type === type)?.label ?? 'Meal';

export function mealSectionsForDay(meals: MealLog[], date: string) {
  const dayMeals = mealsForDay(meals, date);
  const choices: Array<{ type: MealType; label: string }> = [...diaryMealChoices];
  if (dayMeals.some(meal => meal.meal_type === 'unknown')) choices.push({ type: 'unknown', label: 'Other meals' });
  return choices.map(choice => {
    const entries = dayMeals.filter(meal => meal.meal_type === choice.type);
    const calories = entries.flatMap(meal => typeof meal.calories === 'number' && Number.isFinite(meal.calories) ? [meal.calories] : []);
    return { ...choice, meals: entries, calories: calories.length ? calories.reduce((a, b) => a + b, 0) : null, partial: calories.length < entries.length };
  });
}

/** Never silently move an unfinished breakfast into a new lunch. */
export function chooseMealDraft(builder: MealBuilderState, type: MealType) {
  if (builder.items.length && builder.meal_type !== 'unknown' && builder.meal_type !== type) return { status: 'blocked' as const, draft: builder };
  return { status: 'ready' as const, draft: { ...builder, meal_type: type } };
}

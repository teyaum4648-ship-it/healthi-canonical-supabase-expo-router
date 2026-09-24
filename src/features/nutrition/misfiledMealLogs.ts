import type { MealLog } from '../../engines/nutrition';
import { localDay } from '../../utils/localDay';

export type MisfiledMealLog = {
  meal: MealLog;
  /** The day the entry currently sits on. */
  filedOn: string;
  /** The day it was actually entered on. */
  enteredOn: string;
};

/**
 * Entries the manual meal form filed under the wrong day.
 *
 * Every local save path writes `created_at` equal to `logged_at` — the same instant, so a
 * deliberately back-dated entry has them agree. The one exception was the manual meal form,
 * which stamped `logged_at` when the screen mounted and `created_at` when the entry was
 * actually saved. Those two falling on different days is therefore not a heuristic: it is
 * what the defect left behind, and nothing else produces it.
 *
 * This holds for entries stored on the device. On an account, `created_at` is the moment the
 * database took the row, so it differs from `logged_at` for any entry back-dated on purpose
 * and says nothing about whether the entry is misfiled.
 */
export function findMisfiledMealLogs(meals: MealLog[]): MisfiledMealLog[] {
  const misfiled: MisfiledMealLog[] = [];
  for (const meal of meals) {
    if (!meal.created_at || !meal.logged_at) continue;
    const filedOn = localDay(meal.logged_at);
    const enteredOn = localDay(meal.created_at);
    /* An unparseable timestamp reads as an empty day; that is not evidence of anything. */
    if (!filedOn || !enteredOn || filedOn === enteredOn) continue;
    misfiled.push({ meal, filedOn, enteredOn });
  }
  return misfiled;
}

/**
 * Move the chosen entries onto the day they were entered on.
 *
 * `created_at` is the better record of when the food was eaten: it is when the person was
 * sitting there saving it, where `logged_at` is only when the screen happened to open. Meals
 * that were not chosen are returned untouched, in their original order.
 */
export function repairMisfiledMealLogs(meals: MealLog[], ids: readonly string[]): MealLog[] {
  const chosen = new Set(ids);
  return meals.map((meal) => {
    if (!meal.id || !chosen.has(meal.id) || !meal.created_at) return meal;
    if (localDay(meal.created_at) === localDay(meal.logged_at)) return meal;
    return { ...meal, logged_at: meal.created_at };
  });
}

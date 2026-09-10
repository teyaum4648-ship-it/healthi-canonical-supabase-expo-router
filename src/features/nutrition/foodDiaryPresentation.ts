import type { MealLog } from '../../engines/nutrition';
import type { UserFoodProductRow } from './productLibraryPersistence';

export function findPersonalFoods(products: UserFoodProductRow[], query: string, savedOnly = false) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return products.filter((product) => (!savedOnly || product.is_saved)
    && words.every((word) => `${product.name} ${product.brand ?? ''}`.toLocaleLowerCase().includes(word)))
    .sort((a, b) => (b.last_used_at ?? b.updated_at).localeCompare(a.last_used_at ?? a.updated_at));
}

export function mealsForDay(meals: MealLog[], date: string) {
  return meals.filter((meal) => meal.logged_at.slice(0, 10) === date)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

export function portionValue(text: string): number | null {
  const value = Number(text.trim());
  return text.trim() && Number.isFinite(value) && value > 0 && value <= 20 ? value : null;
}

export function loggedAtForDay(date: string, now: string): string {
  // Preserve the existing UTC diary convention; changing it needs a data migration.
  return `${date}${now.slice(10)}`;
}

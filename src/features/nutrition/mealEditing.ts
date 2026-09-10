import type { MealLog, MealType } from '../../engines/nutrition';
import type { MealLogRow } from './persistence';

export const mealAmountFields = [
  ['calories', 'Calories (kcal)'], ['protein_g', 'Protein (g)'], ['carbs_g', 'Carbs (g)'],
  ['fat_g', 'Fat (g)'], ['fiber_g', 'Fiber (g)'], ['sugar_g', 'Sugar (g)'], ['sodium_mg', 'Sodium (mg)']
] as const;
type AmountKey = typeof mealAmountFields[number][0];
export type MealEditDraft = { original: MealLog; name: string; meal_type: MealType; amounts: Record<AmountKey, string> };
export function createMealEditDraft(meal: MealLog): MealEditDraft {
  return { original: meal, name: meal.name, meal_type: meal.meal_type, amounts: Object.fromEntries(mealAmountFields.map(([key]) => [key, meal[key] == null ? '' : String(meal[key])])) as Record<AmountKey, string> };
}
export function applyMealEdit(draft: MealEditDraft): MealLog {
  if (!draft.original.id) throw new Error('This meal has no saved identity. Refresh the diary before editing.');
  if (!draft.name.trim()) throw new Error('Enter a meal name.');
  const amounts = Object.fromEntries(mealAmountFields.map(([key, label]) => {
    const raw = draft.amounts[key].trim();
    const value = raw ? Number(raw) : null;
    if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error(`${label} must be a number of 0 or more, or left blank.`);
    if (key === 'calories' && value !== null && !Number.isInteger(value)) throw new Error('Enter calories as a whole number. Other nutrients can include decimals.');
    return [key, value];
  }));
  return { ...draft.original, ...amounts, name: draft.name.trim(), meal_type: draft.meal_type, corrected_by_user: true, confirmed_by_user: true };
}
export type MealEditClient = { from(table: 'meal_logs'): { update(payload: Record<string, unknown>): {
  eq(column: string, value: string): { eq(column: string, value: string): { select(columns: string): { single(): Promise<{ data: MealLogRow | null; error: { message?: string } | null }> } } }
} } };

/** A single owner-scoped row update. Never insert a duplicate meal or change label evidence. */
export async function persistMealEdit(client: MealEditClient, userId: string, meal: MealLog): Promise<MealLogRow> {
  if (!meal.id || !userId) throw new Error('A saved meal and signed-in account are required.');
  const { data, error } = await client.from('meal_logs').update({
    name: meal.name, meal_type: meal.meal_type, ...Object.fromEntries(mealAmountFields.map(([key]) => [key, meal[key] ?? null])),
    corrected_by_user: true, confirmed_by_user: true
  }).eq('id', meal.id).eq('user_id', userId).select('*').single();
  if (error || !data) throw new Error(error?.message ?? 'The meal could not be updated.');
  return data;
}

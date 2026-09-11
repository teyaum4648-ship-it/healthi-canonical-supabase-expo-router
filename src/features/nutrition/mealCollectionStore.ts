import type { MealLog } from '../../engines/nutrition';
import type { MealCollectionEntry } from './mealLibrary';
import type { MealLogItemRow, MealLogItemInsert } from './mealItemPersistence';
import type { MealLogRow } from './persistence';
import type { UserFoodProductRow } from './productLibraryPersistence';

export const demoMealCollectionKey = 'healthi:demo:nutrition:mealCollection';
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Response = { data: unknown; error: { message?: string } | null };
export type MealCollectionClient = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<Response> };
export type MealHistoryPage = { meals: MealLogRow[]; items: MealLogItemRow[]; foods: UserFoodProductRow[]; has_more: boolean };
function requireAccount(userId: string | null, client: MealCollectionClient | null) {
  if (!client || !userId || userId === 'demo-user') throw new Error('Sign in to use your meal library.');
  return client;
}
export async function readMealCollection(userId: string | null, demo: boolean, client: MealCollectionClient | null, storage: Storage): Promise<MealCollectionEntry[]> {
  if (demo) {
    const raw = await storage.getItem(demoMealCollectionKey);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.some(entry => !entry?.library_key || !entry?.meal?.name || !Array.isArray(entry.items))) throw new Error('Your saved meals could not be read.');
    return data;
  }
  const { data, error } = await requireAccount(userId, client).rpc('get_meal_collection');
  if (error) throw new Error('Your saved meals could not load. Please try again.');
  return (data ?? []) as MealCollectionEntry[];
}
export async function saveMealCollectionEntry(entry: MealCollectionEntry, userId: string | null, demo: boolean, client: MealCollectionClient | null, storage: Storage) {
  if (!entry.meal.name.trim() || entry.items.length > 100) throw new Error('Check this meal before saving.');
  if (entry.is_saved && !entry.items.length) throw new Error('This meal has totals only. Add its foods before saving a reusable meal.');
  const copy = JSON.parse(JSON.stringify({ ...entry, updated_at: new Date().toISOString() })) as MealCollectionEntry;
  if (demo) {
    const current = await readMealCollection(userId, true, null, storage);
    await storage.setItem(demoMealCollectionKey, JSON.stringify([copy, ...current.filter(item => item.library_key !== copy.library_key)]));
  } else {
    const { error } = await requireAccount(userId, client).rpc('save_meal_collection_entry', { entry: copy });
    if (error) throw new Error('The meal could not be saved. Your previous library is unchanged.');
  }
  return copy;
}
export async function readMealHistory(client: MealCollectionClient, query: string, offset = 0): Promise<MealHistoryPage> {
  const { data, error } = await client.rpc('search_meal_history', { query: query.trim().slice(0, 120), page_offset: offset });
  if (error) throw new Error('Meal history could not connect. Try again; your diary is unchanged.');
  return data as MealHistoryPage;
}
/** One transaction updates the aggregate and replaces its item rows. Never silently falls back locally. */
export async function persistMealItemEdit(client: MealCollectionClient, original: MealLog, updated: MealLog, items: MealLogItemInsert[]) {
  const { data, error } = await client.rpc('replace_meal_items', {
    meal_id: original.id, meal_patch: { name: updated.name, meal_type: updated.meal_type, quality_flags: updated.quality_flags,
      reason_codes: updated.reason_codes, source_confidence: updated.source_confidence }, item_rows: items
  });
  if (error || !data) throw new Error('The meal could not be updated. Your draft is still here; try again.');
  return data as { meal: MealLogRow; items: MealLogItemRow[] };
}

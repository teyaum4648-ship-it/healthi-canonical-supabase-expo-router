import type { MealLog, MealType } from '../../engines/nutrition';
import { addMealBuilderItem, createEmptyMealBuilder, mealBuilderToAggregateMealLog, type MealBuilderState } from './mealBuilder';
import type { MealLogItemRow } from './mealItemPersistence';
import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';

export type MealCollectionEntry = {
  library_key: string; meal: MealLog; items: MealLogItemRow[];
  is_starred: boolean; is_saved: boolean; updated_at: string;
};
export const mealNutrients = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'saturated_fat_g'] as const;
export const normalizeHistoryText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
export function matchesHistory(query: string, text: string) {
  const haystack = normalizeHistoryText(text);
  return normalizeHistoryText(query).split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
}
/** Same named meal/foods share a pin even if portion sizes or dates differ. */
export function mealLibraryKey(meal: MealLog, items: MealLogItemRow[]) {
  return JSON.stringify([normalizeHistoryText(meal.name), ...items.map(item =>
    normalizeHistoryText(`${item.name}|${item.brand ?? ''}|${item.barcode ?? ''}`)).sort()]);
}
export function createMealCollectionEntry(meal: MealLog, items: MealLogItemRow[]): MealCollectionEntry {
  const ownItems = items.filter(item => item.meal_log_id === meal.id);
  return JSON.parse(JSON.stringify({ library_key: mealLibraryKey(meal, ownItems), meal, items: ownItems,
    is_starred: false, is_saved: false, updated_at: meal.logged_at }));
}
export function collectMealHistory(meals: MealLog[], items: MealLogItemRow[], collection: MealCollectionEntry[], query = '', savedOnly = false) {
  const entries = new Map<string, MealCollectionEntry>();
  [...meals].sort((a, b) => b.logged_at.localeCompare(a.logged_at)).forEach(meal => {
    const entry = createMealCollectionEntry(meal, items);
    if (!entries.has(entry.library_key)) entries.set(entry.library_key, entry);
  });
  collection.forEach(entry => {
    const recent = entries.get(entry.library_key);
    // Saved templates keep their original portions. Stars alone use the latest log.
    entries.set(entry.library_key, entry.is_saved || !recent ? entry : { ...recent, is_starred: entry.is_starred });
  });
  return [...entries.values()].filter(entry => (!savedOnly || entry.is_saved) && matchesHistory(query,
    [entry.meal.name, ...entry.items.map(item => `${item.name} ${item.brand ?? ''}`)].join(' ')))
    .sort((a, b) => Number(b.is_starred) - Number(a.is_starred)
      || b.meal.logged_at.localeCompare(a.meal.logged_at) || a.library_key.localeCompare(b.library_key));
}
/** Nutrition comes from the historical item, never a refreshed provider label. */
export function mealItemToSnapshot(item: MealLogItemRow): HealthiProductSnapshot {
  if (!Number.isFinite(item.servings) || item.servings <= 0) throw new Error('This food needs its original portion reviewed.');
  const perPortion = (key: typeof mealNutrients[number]) => typeof item[key] === 'number' ? item[key]! / item.servings : null;
  const metadata = item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata) ? item.metadata : {};
  return {
    barcode: item.barcode ?? '', provider: item.provider ?? 'manual', provider_product_id: item.provider_product_id,
    name: item.name, brand: item.brand, serving_size: item.serving_size, serving_quantity_g: item.serving_quantity_g,
    calories_per_serving: perPortion('calories'), protein_g: perPortion('protein_g'), carbs_g: perPortion('carbs_g'),
    fat_g: perPortion('fat_g'), fiber_g: perPortion('fiber_g'), sugar_g: perPortion('sugar_g'), sodium_mg: perPortion('sodium_mg'),
    saturated_fat_g: perPortion('saturated_fat_g'), ingredients_text: null,
    image_url: typeof metadata.image_url === 'string' ? metadata.image_url : null,
    quality_flags: Array.isArray(metadata.quality_flags) ? metadata.quality_flags as HealthiProductSnapshot['quality_flags'] : [],
    confidence: item.source_confidence, reason_codes: [...item.reason_codes]
  };
}
export function mealEntryToBuilder(entry: MealCollectionEntry, mealType: MealType = entry.meal.meal_type): MealBuilderState {
  if (!entry.items.length) throw new Error('This older meal has totals only. Its individual foods were not saved.');
  return entry.items.reduce((builder, item, index) => {
    const next = addMealBuilderItem(builder, {
      snapshot: mealItemToSnapshot(item), source: 'saved_food', productId: item.food_product_id,
      servings: item.servings, id: `reused-${index}`
    });
    const added = next.items[next.items.length - 1];
    added.historical_quality = {
      score: item.quality_score, label: item.quality_label ?? 'calibrating',
      confidence: item.quality_confidence ?? 'low'
    };
    return next;
  }, { ...createEmptyMealBuilder(), name: entry.meal.name, meal_type: mealType });
}
export function buildEditedMeal(original: MealLog, builder: MealBuilderState, demo: boolean): MealLog {
  if (!original.id) throw new Error('Refresh the diary before editing this meal.');
  if (!builder.name.trim()) throw new Error('Enter a meal name.');
  if (!builder.items.length) throw new Error('Keep at least one food in this meal.');
  if (builder.items.some(item => !Number.isFinite(item.servings) || item.servings <= 0 || item.servings > 20)) throw new Error('Check food portions.');
  const aggregate = mealBuilderToAggregateMealLog(builder, original.logged_at, demo);
  return { ...original, ...aggregate, id: original.id, user_id: original.user_id, logged_at: original.logged_at,
    created_at: original.created_at, source: original.source, user_response: original.user_response,
    // The existing aggregate database column stores whole calories.
    calories: aggregate.calories === null ? null : Math.round(aggregate.calories!),
    corrected_by_user: true, confirmed_by_user: true };
}

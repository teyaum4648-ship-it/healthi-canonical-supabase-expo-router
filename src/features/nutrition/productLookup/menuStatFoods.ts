import type { HealthiProductSnapshot } from './productLookupTypes';
import { MENUSTAT_DATA_TYPE, type MenuStatRow } from './restaurantFoodTypes';
import { matchesEveryTerm, queryTerms, searchWords } from './searchFoodResolution';

export type MenuStatData = { restaurants: readonly string[]; foods: readonly MenuStatRow[] };

let loading: Promise<MenuStatData> | null = null;

/**
 * The chain menu list, loaded on the first search that needs it rather than at start-up:
 * it is tens of thousands of rows, and most sessions never search for a restaurant.
 */
export function loadMenuStat(): Promise<MenuStatData> {
  loading ??= import('./generatedMenuStatFoods').then(module => ({ restaurants: module.MENUSTAT_RESTAURANTS, foods: module.MENUSTAT_FOODS }));
  return loading;
}

/**
 * A menu item as a food the diary can log. Nutrients are the chain's published per-serving
 * figures. The provider is "manual" because the diary's stored providers are the online
 * catalogues and hand entry, and a fixed list shipped in the app has no catalogue record to
 * refresh from; the data type says where it came from.
 */
export function menuStatSnapshot(row: MenuStatRow, restaurants: readonly string[]): HealthiProductSnapshot {
  const [id, restaurant, name, serving, quantity, unit, kcal, protein, carbs, fat, saturated, fiber, sugar, sodium] = row;
  return {
    barcode: '', provider: 'manual', provider_product_id: `menustat:${id}`,
    name, brand: restaurants[restaurant] ?? null, image_url: null, ingredients_text: null,
    serving_size: serving, serving_quantity: quantity, serving_unit: unit, serving_quantity_g: unit === 'g' ? quantity : null,
    food_data_type: MENUSTAT_DATA_TYPE,
    calories_per_serving: kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, saturated_fat_g: saturated,
    fiber_g: fiber, sugar_g: sugar, sodium_mg: sodium,
    confidence: 'medium', quality_flags: [], reason_codes: []
  };
}

/** Each row's words, worked out once per list rather than once per search. */
const wordCache = new WeakMap<MenuStatData, ReadonlySet<string>[]>();

/**
 * Menu items whose chain and name hold every word of the query, closest first by how few
 * other words the name carries. A broad word like "chicken" matches thousands of items;
 * only the tightest `limit` go on to full ranking.
 */
export function matchMenuStat(query: string, data: MenuStatData, limit = 80): HealthiProductSnapshot[] {
  const terms = queryTerms(query);
  if (!terms.length || !data.foods.length) return [];
  let words = wordCache.get(data);
  if (!words) {
    words = data.foods.map(row => searchWords(`${data.restaurants[row[1]] ?? ''} ${row[2]}`));
    wordCache.set(data, words);
  }
  const hits: number[] = [];
  words.forEach((set, index) => { if (matchesEveryTerm(set, terms)) hits.push(index); });
  return hits
    .sort((a, b) => words![a].size - words![b].size || a - b)
    .slice(0, limit)
    .map(index => menuStatSnapshot(data.foods[index], data.restaurants));
}

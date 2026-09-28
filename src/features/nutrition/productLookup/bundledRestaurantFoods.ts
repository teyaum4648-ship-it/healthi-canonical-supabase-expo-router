import { RESTAURANT_FOODS } from './generatedRestaurantFoods';
import { BUNDLED_RESTAURANT_DATA_TYPE, type RestaurantFoodRow } from './restaurantFoodTypes';
import { matchesEveryTerm } from './searchFoodResolution';

/** FDC nutrient ids and units, in RestaurantFoodRow column order. */
const NUTRIENTS: readonly (readonly [id: number, unit: string])[] = [
  [1008, 'kcal'], [1003, 'g'], [1005, 'g'], [1004, 'g'], [1079, 'g'], [2000, 'g'], [1258, 'g'], [1093, 'mg']
];

/** Names title case gets wrong, and one USDA typo ("WEND'YS"), as the chain writes them. */
const NAME_FIXES: Record<string, string> = { 'CHICK-FIL-A': 'Chick-fil-A', "WEND'YS": "Wendy's", DIGIORNO: 'DiGiorno' };
const NAME_FIX_PATTERN = new RegExp(Object.keys(NAME_FIXES).join('|'), 'g');

/** Short capitalised names that are initials, not words. */
const INITIALS = new Set(['KFC', 'BLT', 'BBQ', 'TGI', 'DQ', 'USA']);

function prettyWord(word: string): string {
  if (/^Mc[A-Z]{2,}/.test(word)) return `Mc${word[2]}${word.slice(3).toLowerCase()}`;
  const letters = word.replace(/[^A-Za-z]/g, '');
  if (!letters || letters !== letters.toUpperCase()) return word;
  if (INITIALS.has(letters) || letters.length <= 2 || word.includes('.')) return word;
  return `${word[0]}${word.slice(1).toLowerCase()}`;
}

/**
 * USDA writes chain names in capitals — "McDONALD'S, BIG MAC" — which reads as shouting
 * in a list. Capitalised words become title case; lower-case detail is left alone.
 */
export function prettyRestaurantName(description: string): string {
  return description.replace(NAME_FIX_PATTERN, match => NAME_FIXES[match]).split(/([\s,\-/()]+)/).map(part => /^[\s,\-/()]*$/.test(part) ? part : prettyWord(part)).join('');
}

/** The chain, when USDA led the name with one: its first segment is in capitals. */
export function restaurantBrand(description: string): { brand: string | null; dish: string } {
  const comma = description.indexOf(',');
  if (comma < 0) return { brand: null, dish: description };
  const lead = description.slice(0, comma).trim();
  const letters = lead.replace(/^Mc/, '').replace(/[^A-Za-z]/g, '');
  if (letters.length < 2 || letters !== letters.toUpperCase()) return { brand: null, dish: description };
  const dish = description.slice(comma + 1).trim();
  return dish ? { brand: prettyRestaurantName(lead), dish } : { brand: null, dish: description };
}

/** A row in the shape USDA's search API returns, so it goes through the same normaliser. */
export function restaurantFoodRecord(row: RestaurantFoodRow): Record<string, unknown> {
  const [fdcId, description, category] = row;
  const values = row.slice(3, 11) as (number | null)[];
  const portions = row[11];
  const { brand, dish } = restaurantBrand(description);
  const name = prettyRestaurantName(dish);
  return {
    fdcId,
    description: `${name.charAt(0).toUpperCase()}${name.slice(1)}`,
    ...(brand ? { brandName: brand } : {}),
    dataType: BUNDLED_RESTAURANT_DATA_TYPE,
    foodCategory: category,
    foodNutrients: NUTRIENTS.flatMap(([nutrientId, unitName], index) => values[index] === null ? [] : [{ nutrientId, unitName, value: values[index] }]),
    foodPortions: portions.map(([portionDescription, gramWeight]) => ({ portionDescription, gramWeight }))
  };
}

/**
 * Built-in restaurant dishes whose name or chain holds every word of the query. The list
 * is small and local, so this answers instantly and without a connection. Unranked: the
 * caller ranks these with the catalogue's results.
 */
export function matchRestaurantFoods(query: string, rows: readonly RestaurantFoodRow[] = RESTAURANT_FOODS): Record<string, unknown>[] {
  if (query.trim().length < 2) return [];
  return rows.flatMap(row => {
    const record = restaurantFoodRecord(row);
    return matchesEveryTerm(`${String(record.description)} ${String(record.brandName ?? '')} ${row[1]}`, query) ? [record] : [];
  });
}

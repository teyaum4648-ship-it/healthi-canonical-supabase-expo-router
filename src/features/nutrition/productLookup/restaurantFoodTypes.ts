/** The data type a search result carries when it came from the list built into the app. */
export const BUNDLED_RESTAURANT_DATA_TYPE = 'SR Legacy restaurant';

/**
 * One dish in the built-in restaurant list, as scripts/build-restaurant-foods.mjs writes it.
 * A tuple rather than an object keeps several hundred rows small in the bundle.
 * Nutrients are USDA's per 100 g; null means not reported, never zero.
 */
export type RestaurantFoodRow = readonly [
  fdcId: number,
  description: string,
  category: string,
  kcal: number | null,
  protein_g: number | null,
  carbs_g: number | null,
  fat_g: number | null,
  fiber_g: number | null,
  sugar_g: number | null,
  saturated_fat_g: number | null,
  sodium_mg: number | null,
  portions: readonly (readonly [label: string, grams: number])[]
];

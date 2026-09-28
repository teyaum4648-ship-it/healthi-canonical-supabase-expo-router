/**
 * Restaurant and fast-food dishes generated from USDA FoodData Central SR Legacy by
 * scripts/build-restaurant-foods.mjs. Do not edit by hand; run the "Build restaurant
 * foods" GitHub workflow instead.
 *
 * USDA data is a work of the US government and public domain. SR Legacy's last release
 * was April 2018, so rows describe dishes as measured then, not a chain's current menu.
 * Nutrients are per 100 g; null means USDA did not report it, never zero.
 *
 * Not generated yet: the list is empty until the workflow runs.
 */
import type { RestaurantFoodRow } from './restaurantFoodTypes';

export const RESTAURANT_FOODS: readonly RestaurantFoodRow[] = [
];

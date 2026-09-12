import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';
import { metricServing, metricServingFromText } from './labelServing';

const keys = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'saturated_fat_g'] as const;
export type LoggingNutrients = Record<typeof keys[number], number | null>;
const known = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Logging-only units. Never mutate the provider snapshot or Product Quality input. */
export function foodLoggingNutrition(product: HealthiProductSnapshot) {
  const serving = { ...product, calories: product.calories_per_serving };
  const metric = metricServing(product.serving_quantity_g, 'g')
    ?? metricServing(product.serving_quantity, product.serving_unit)
    ?? metricServingFromText(product.serving_size);
  const perHundred = metric?.unit === 'g' ? product.nutriments_per_100g : metric?.unit === 'mL' ? product.nutriments_per_100ml : null;
  const canDerive = !!metric && keys.some(key => known(perHundred?.[key]));
  const reportedServing = keys.some(key => known(serving[key]));
  const basis = reportedServing || canDerive ? 'serving'
    : keys.some(key => known(product.nutriments_per_100ml?.[key])) ? 'per_100ml'
    : keys.some(key => known(product.nutriments_per_100g?.[key])) ? 'per_100g' : 'unreported';
  const source = basis === 'per_100ml' ? product.nutriments_per_100ml : basis === 'per_100g' ? product.nutriments_per_100g : serving;
  const nutrients = Object.fromEntries(keys.map(key => [key,
    basis === 'serving' && !known(serving[key]) && canDerive
      ? known(perHundred?.[key]) ? perHundred![key]! * metric!.quantity / 100 : null
      : known(source?.[key]) ? source![key] : null
  ])) as LoggingNutrients;
  return {
    basis,
    nutrients,
    label: basis === 'per_100ml' ? '100 mL' : basis === 'per_100g' ? '100 g' : product.serving_size || (metric ? `${metric.quantity} ${metric.unit}` : '1 serving (size not reported)'),
    quantityG: basis === 'per_100g' ? 100 : basis === 'per_100ml' ? null : metric?.unit === 'g' ? metric.quantity : null,
    amountUnit: basis === 'per_100g' ? 'g' : basis === 'per_100ml' ? 'mL' : 'servings',
    amountPerPortion: basis === 'per_100g' || basis === 'per_100ml' ? 100 : 1
  } as const;
}

/** Readiness for the food diary, never a Product Quality score. */
export function foodLoggingCompleteness(product: HealthiProductSnapshot): number {
  const { nutrients, basis } = foodLoggingNutrition(product);
  if (nutrients.calories === null) return 0;
  const macros = [nutrients.protein_g, nutrients.carbs_g, nutrients.fat_g];
  return macros.every(known) ? basis === 'serving' ? 3 : 2 : 1;
}

export function partitionFoodSearchResults(products: HealthiProductSnapshot[]) {
  return { ready: products.filter(p => foodLoggingCompleteness(p) >= 2),
    incomplete: products.filter(p => foodLoggingCompleteness(p) < 2) };
}

export function withFoodPortion(product: HealthiProductSnapshot, portion: NonNullable<HealthiProductSnapshot['food_portions']>[number]): HealthiProductSnapshot {
  // USDA catalog portions refer to this exact FDC record. Do not alter saved
  // serving-based foods or product-scanner evidence from other sources.
  if (product.provider !== 'usda_food_data_central' || !product.food_portions?.some(p => p.label === portion.label && p.quantity === portion.quantity && p.unit === portion.unit)) return product;
  const next = { ...product, serving_size: portion.label, serving_quantity: portion.quantity, serving_unit: portion.unit, serving_quantity_g: portion.unit === 'g' ? portion.quantity : null, calories_per_serving: null };
  for (const key of keys) if (key !== 'calories') next[key] = null;
  return next;
}

/** Reference units are not a suggested portion, so require an explicit amount. */
export function initialFoodLoggingAmount(product: HealthiProductSnapshot): string {
  const { basis } = foodLoggingNutrition(product);
  return basis === 'per_100g' || basis === 'per_100ml' ? '' : '1';
}

export function foodSearchPortionDetail(product: HealthiProductSnapshot): string {
  const nutrition = foodLoggingNutrition(product);
  const reference = nutrition.basis === 'per_100g' || nutrition.basis === 'per_100ml';
  return [product.brand, product.quantity, product.provider === 'usda_food_data_central' && product.food_data_type !== 'Branded' ? 'USDA reference food' : null,
    reference ? 'Serving size not listed' : nutrition.basis === 'unreported' && !product.serving_size ? 'Serving size not listed' : nutrition.label,
    nutrition.nutrients.calories === null ? 'Calories not reported'
      : `${Math.round(nutrition.nutrients.calories)} kcal per ${reference ? nutrition.label : 'serving'}`
  ].filter(Boolean).join(' · ');
}

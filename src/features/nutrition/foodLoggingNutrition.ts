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
    basis === 'serving' && !reportedServing && canDerive
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

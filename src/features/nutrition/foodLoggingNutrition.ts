import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';

const keys = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'saturated_fat_g'] as const;
export type LoggingNutrients = Record<typeof keys[number], number | null>;
const known = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const round = (value: number) => Math.round(value * 10) / 10;

/** "1 bar" plus a known 45 g reads better than either alone; text that already states grams is left be. */
function servingLabel(servingSize: string | null | undefined, grams: number | null): string | null {
  const text = servingSize?.trim() || null;
  if (!text) return grams === null ? null : `${round(grams)} g`;
  if (grams === null || /[\d.]\s*(g|ml|oz|lb|kg|l)\b/i.test(text)) return text;
  return `${text} (${round(grams)} g)`;
}

/**
 * Logging-only units. Never mutate the provider snapshot or Product Quality input.
 *
 * A portion is one serving of the item whenever the item's serving is known — either
 * reported per-serving by the provider, or derived from per-100 g using a validated
 * serving mass. Per-100 g is the last resort for products that report nothing about their
 * serving, and it says so rather than calling 100 g a portion.
 */
export function foodLoggingNutrition(product: HealthiProductSnapshot) {
  const serving = { ...product, calories: product.calories_per_serving };
  const per100g = product.nutriments_per_100g;
  const per100ml = product.nutriments_per_100ml;
  // Grams only: serving_quantity_g is set solely for servings the provider validated as mass,
  // so per-100 mL products never get scaled by it.
  const servingGrams = known(product.serving_quantity_g) && product.serving_quantity_g > 0
    ? product.serving_quantity_g
    : null;
  const hasPer100g = keys.some((key) => known(per100g?.[key]));

  const basis = keys.some((key) => known(serving[key])) ? 'serving'
    : keys.some((key) => known(per100ml?.[key])) ? 'per_100ml'
      : hasPer100g && servingGrams !== null ? 'derived_serving'
        : hasPer100g ? 'per_100g'
          : 'unreported';

  const source = basis === 'per_100ml' ? per100ml : basis === 'per_100g' || basis === 'derived_serving' ? per100g : serving;
  const factor = basis === 'derived_serving' && servingGrams !== null ? servingGrams / 100 : 1;
  const nutrients = Object.fromEntries(keys.map((key) => [
    key,
    known(source?.[key]) ? round(source![key]! * factor) : null
  ])) as LoggingNutrients;

  const isServing = basis === 'serving' || basis === 'derived_serving';
  return {
    basis,
    nutrients,
    isServing,
    label: basis === 'per_100ml' ? '100 mL'
      : basis === 'per_100g' ? '100 g'
        : servingLabel(product.serving_size, servingGrams) ?? '1 serving (size not reported)',
    /** Reads as "378 kcal per 100 g" — never calls an arbitrary 100 g a portion. */
    portionLabel: basis === 'per_100ml' ? 'per 100 mL' : basis === 'per_100g' ? 'per 100 g' : 'per serving',
    quantityG: basis === 'per_100g' ? 100 : basis === 'per_100ml' ? null : product.serving_quantity_g,
    amountUnit: basis === 'per_100g' ? 'g' : basis === 'per_100ml' ? 'mL' : 'servings',
    amountPerPortion: basis === 'per_100g' || basis === 'per_100ml' ? 100 : 1
  } as const;
}

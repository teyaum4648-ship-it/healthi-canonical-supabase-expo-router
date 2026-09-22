import { addMicronutrients, type MicronutrientAmounts } from '../../engines/nutrition';
import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';

/**
 * Turning a provider's per-100 g panel into what was actually eaten.
 *
 * Both logging paths need this and they must agree, because a product scanned straight
 * into the diary and the same product added through the meal builder have to produce the
 * same numbers or the day's totals depend on which button someone pressed.
 *
 * The conversion needs the mass of a serving, and where that is not known and validated
 * it returns nothing. The macros have a documented per-100 g fallback that says so on
 * screen; a vitamin figure has nowhere equivalent to say it, so an unknown portion means
 * an absent panel rather than 100 g quietly treated as a serving. Absent reads as "not
 * reported", which is true. A panel scaled by a guessed portion would read as a
 * measurement, which would not be.
 */
export function micronutrientsForPortion(
  snapshot: HealthiProductSnapshot,
  servings: number
): MicronutrientAmounts | null {
  const panel = snapshot.nutriments_per_100g?.micronutrients;
  if (!panel) return null;
  if (!Number.isFinite(servings) || servings <= 0) return null;

  const servingGrams = snapshot.serving_quantity_g;
  if (typeof servingGrams !== 'number' || !Number.isFinite(servingGrams) || servingGrams <= 0) return null;

  const factor = (servingGrams / 100) * servings;
  const scaled: MicronutrientAmounts = {};
  for (const [id, amount] of Object.entries(panel)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) continue;
    scaled[id] = Math.round(amount * factor * 1000) / 1000;
  }
  return Object.keys(scaled).length > 0 ? scaled : null;
}

/** The panel for a whole meal, summed across the items that reported one. */
export function micronutrientsForItems(
  items: Array<{ snapshot: HealthiProductSnapshot; servings: number }>
): MicronutrientAmounts | null {
  let totals: MicronutrientAmounts = {};
  let any = false;

  for (const item of items) {
    const portion = micronutrientsForPortion(item.snapshot, item.servings);
    if (!portion) continue;
    totals = addMicronutrients(totals, portion);
    any = true;
  }

  return any ? totals : null;
}

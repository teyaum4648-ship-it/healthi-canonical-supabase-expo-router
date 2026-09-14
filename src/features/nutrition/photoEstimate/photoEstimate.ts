import type { DataConfidence } from '../../../types/common';
import type { HealthiProductSnapshot } from '../productLookup/productLookupTypes';
import {
  PHOTO_ESTIMATE_NUTRIENT_KEYS,
  type PhotoEstimate,
  type PhotoEstimateItem,
  type PhotoEstimateNutrients,
  type PhotoEstimatePortionUnit,
  type PhotoEstimateRange,
  type PhotoEstimateResult
} from './photoEstimateTypes';

/**
 * Photo estimates, end to end, with no network in this file.
 *
 * Four rules the rest of the feature depends on:
 *
 * 1. A photo is evidence of what is on the plate, never of what is on a label. An
 *    estimate therefore claims no ingredients, no allergens and no product identity —
 *    those come only from a barcode or a search hit.
 * 2. Portion is reported separately from identification, because that is where the
 *    error is, and a calorie figure is always accompanied by the band it implies.
 * 3. Model output is untrusted input. Every field is validated and clamped; a bad
 *    payload becomes a named refusal, never a partial plate that reads as a total.
 * 4. Nothing is logged without a person confirming it.
 */

/** Portion uncertainty, as a fraction either side of the point estimate. */
const RANGE_WIDTH: Record<DataConfidence, number> = { high: 0.15, medium: 0.25, low: 0.4 };

const CONFIDENCE_RANK: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };
const CONFIDENCE_BY_RANK: DataConfidence[] = ['low', 'medium', 'high'];

/** A plate with more items than this is almost certainly a misread rather than a meal. */
const MAX_ITEMS = 20;
/** Guards against a runaway figure becoming a 900,000 kcal diary entry. */
const MAX_NUTRIENT_VALUE = 100_000;
const MAX_PORTION_AMOUNT = 100_000;

/** Synthetic key for a food that has no barcode, so estimates never collide with real products. */
export const PHOTO_ESTIMATE_BARCODE_PREFIX = 'photo-estimate:';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const round = (value: number) => Math.round(value * 10) / 10;

function clampNutrient(value: unknown): number | null {
  if (!isFiniteNumber(value) || value < 0) return null;
  return round(Math.min(value, MAX_NUTRIENT_VALUE));
}

function readConfidence(value: unknown): DataConfidence {
  // An unrecognized or missing confidence is treated as the weakest, never the strongest.
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function readUnit(value: unknown): PhotoEstimatePortionUnit {
  if (value === 'g' || value === 'ml' || value === 'count') return value;
  return 'g';
}

function readText(value: unknown, limit = 120): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, limit) : null;
}

export function lowerConfidence(a: DataConfidence, b: DataConfidence): DataConfidence {
  return CONFIDENCE_BY_RANK[Math.min(CONFIDENCE_RANK[a], CONFIDENCE_RANK[b])];
}

/** The weaker of identification and portion: an item is only as good as its shakiest half. */
export function itemConfidence(item: PhotoEstimateItem): DataConfidence {
  return lowerConfidence(item.identification_confidence, item.portion_confidence);
}

function emptyNutrients(): PhotoEstimateNutrients {
  return Object.fromEntries(PHOTO_ESTIMATE_NUTRIENT_KEYS.map((key) => [key, null])) as PhotoEstimateNutrients;
}

function readNutrients(value: unknown): PhotoEstimateNutrients {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    PHOTO_ESTIMATE_NUTRIENT_KEYS.map((key) => [key, clampNutrient(source[key])])
  ) as PhotoEstimateNutrients;
}

/**
 * Calories summed across items, with each item's band set by its own portion confidence.
 * Summing per item rather than applying one global width keeps a confidently measured
 * item from being widened by an uncertain one sitting next to it.
 */
export function calorieRange(items: PhotoEstimateItem[]): PhotoEstimateRange | null {
  const reported = items.filter((item) => item.nutrients.calories !== null);
  if (reported.length === 0) return null;
  let low = 0;
  let high = 0;
  for (const item of reported) {
    const calories = item.nutrients.calories!;
    const width = RANGE_WIDTH[item.portion_confidence];
    low += calories * (1 - width);
    high += calories * (1 + width);
  }
  return { low: Math.max(0, Math.round(low)), high: Math.round(high) };
}

export function totalCalories(items: PhotoEstimateItem[]): number | null {
  const reported = items.filter((item) => item.nutrients.calories !== null);
  if (reported.length === 0) return null;
  return Math.round(reported.reduce((sum, item) => sum + item.nutrients.calories!, 0));
}

/** An estimate is only as trustworthy as its weakest item. */
export function estimateConfidence(items: PhotoEstimateItem[]): DataConfidence {
  if (items.length === 0) return 'low';
  return items.map(itemConfidence).reduce(lowerConfidence, 'high');
}

function buildEstimate(items: PhotoEstimateItem[], model: string | null, estimatedAt: string): PhotoEstimate {
  return {
    items,
    calories: totalCalories(items),
    calorie_range: calorieRange(items),
    confidence: estimateConfidence(items),
    requires_review: true,
    model,
    estimated_at: estimatedAt
  };
}

/**
 * Validates a model payload into an estimate.
 *
 * Shaped as `{ items: [...] }`. Items missing a usable name are dropped rather than
 * logged under a placeholder; if that leaves nothing, the result is an explicit
 * `no_food_found` refusal so the caller never shows an empty plate as a zero total.
 */
export function parsePhotoEstimate(
  payload: unknown,
  options: { model?: string | null; now?: string } = {}
): PhotoEstimateResult {
  const estimatedAt = options.now ?? new Date().toISOString();
  const model = readText(options.model, 80);

  if (!payload || typeof payload !== 'object') {
    return { ok: false, refusal: { reason: 'malformed_response', detail: 'The estimate came back in a shape Healthi could not read.' } };
  }

  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.items)) {
    return { ok: false, refusal: { reason: 'malformed_response', detail: 'The estimate came back without a list of foods.' } };
  }

  const items: PhotoEstimateItem[] = [];
  for (const [index, raw] of root.items.slice(0, MAX_ITEMS).entries()) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const name = readText(entry.name, 80);
    if (!name) continue;

    const amount = isFiniteNumber(entry.amount) && entry.amount > 0
      ? Math.min(entry.amount, MAX_PORTION_AMOUNT)
      : null;
    if (amount === null) continue;

    items.push({
      id: `${PHOTO_ESTIMATE_BARCODE_PREFIX}${estimatedAt}:${index}`,
      name,
      detail: readText(entry.detail),
      portion: {
        amount: round(amount),
        unit: readUnit(entry.unit),
        described_as: readText(entry.described_as, 80),
        corrected: false
      },
      nutrients: readNutrients(entry.nutrients),
      identification_confidence: readConfidence(entry.identification_confidence),
      portion_confidence: readConfidence(entry.portion_confidence)
    });
  }

  if (items.length === 0) {
    return {
      ok: false,
      refusal: { reason: 'no_food_found', detail: 'Healthi could not make out a food in that photo. Try another angle, or search for it instead.' }
    };
  }

  return { ok: true, estimate: buildEstimate(items, model, estimatedAt) };
}

/**
 * Applies a person's own portion figure.
 *
 * Nutrients scale linearly with the amount, which is right for a homogeneous food and
 * is the only defensible move without re-reading the photo. Correcting the amount makes
 * the portion known, so portion confidence becomes high — identification is untouched,
 * because saying "200 g" does not settle whether the model named the food correctly.
 */
export function correctPortion(estimate: PhotoEstimate, itemId: string, amount: number): PhotoEstimate {
  if (!isFiniteNumber(amount) || amount <= 0) return estimate;
  const next = estimate.items.map((item) => {
    if (item.id !== itemId) return item;
    const factor = item.portion.amount > 0 ? Math.min(amount, MAX_PORTION_AMOUNT) / item.portion.amount : 1;
    return {
      ...item,
      portion: { ...item.portion, amount: round(Math.min(amount, MAX_PORTION_AMOUNT)), corrected: true },
      nutrients: Object.fromEntries(
        PHOTO_ESTIMATE_NUTRIENT_KEYS.map((key) => [
          key,
          item.nutrients[key] === null ? null : clampNutrient(item.nutrients[key]! * factor)
        ])
      ) as PhotoEstimateNutrients,
      portion_confidence: 'high' as DataConfidence
    };
  });
  return { ...estimate, ...recomputed(next), items: next };
}

export function removeEstimateItem(estimate: PhotoEstimate, itemId: string): PhotoEstimate {
  const next = estimate.items.filter((item) => item.id !== itemId);
  return { ...estimate, ...recomputed(next), items: next };
}

function recomputed(items: PhotoEstimateItem[]) {
  return {
    calories: totalCalories(items),
    calorie_range: calorieRange(items),
    confidence: estimateConfidence(items)
  };
}

/**
 * Presents an estimated item as a product snapshot so photo items flow through the same
 * meal builder, totals and persistence as a scanned or searched food.
 *
 * Deliberately absent: ingredients, allergens, brand and provider identity. A photo shows
 * food, not a label, and inventing any of those would let an estimate be graded as though
 * it carried label evidence.
 */
export function photoEstimateItemToSnapshot(item: PhotoEstimateItem): HealthiProductSnapshot {
  const grams = item.portion.unit === 'g' ? item.portion.amount : null;
  return {
    barcode: item.id,
    provider: 'photo_estimate',
    name: item.name,
    brand: null,
    serving_size: portionLabel(item),
    serving_quantity_g: grams,
    calories_per_serving: item.nutrients.calories,
    protein_g: item.nutrients.protein_g,
    carbs_g: item.nutrients.carbs_g,
    fat_g: item.nutrients.fat_g,
    fiber_g: item.nutrients.fiber_g,
    sugar_g: item.nutrients.sugar_g,
    sodium_mg: item.nutrients.sodium_mg,
    saturated_fat_g: item.nutrients.saturated_fat_g,
    ingredients_text: null,
    quality_flags: [],
    confidence: itemConfidence(item),
    reason_codes: item.portion.corrected
      ? ['photo_estimated_food_log', 'user_corrected_food_log']
      : ['photo_estimated_food_log']
  };
}

/** "180 g", "2 servings", or the model's own phrasing when it had one. */
export function portionLabel(item: PhotoEstimateItem): string {
  const { amount, unit, described_as } = item.portion;
  const measure = unit === 'count'
    ? `${round(amount)}${round(amount) === 1 ? ' serving' : ' servings'}`
    : `${round(amount)} ${unit === 'ml' ? 'mL' : 'g'}`;
  return described_as && !item.portion.corrected ? `${measure} · ${described_as}` : measure;
}

/** Reads as "410–680 kcal". Shown instead of a single figure whenever a range exists. */
export function formatCalorieRange(range: PhotoEstimateRange | null): string | null {
  return range ? `${range.low}–${range.high} kcal` : null;
}

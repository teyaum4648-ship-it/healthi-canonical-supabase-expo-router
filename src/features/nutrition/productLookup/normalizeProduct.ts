import type {
  DataConfidence,
  FoodQualityFlag,
  NutritionReasonCode
} from '../../../engines/nutrition';
import type { HealthiProductSnapshot } from './productLookupTypes';

export type OpenFoodFactsProduct = {
  code?: unknown;
  product_name?: unknown;
  generic_name?: unknown;
  brands?: unknown;
  serving_size?: unknown;
  serving_quantity?: unknown;
  ingredients_text?: unknown;
  labels_tags?: unknown;
  categories_tags?: unknown;
  packaging_tags?: unknown;
  nova_group?: unknown;
  additives_n?: unknown;
  nutriments?: unknown;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'string' || !item.trim()) return [];
    return [item.trim().replace(/^[a-z]{2}:/i, '').replace(/-/g, ' ')];
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function servingGrams(product: OpenFoodFactsProduct): number | null {
  const direct = finiteNumber(product.serving_quantity);
  if (direct !== null && direct > 0) return direct;

  const servingSize = cleanString(product.serving_size);
  const match = servingSize?.match(/([\d.]+)\s*g\b/i);
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nutrientPerServing(
  nutriments: Record<string, unknown>,
  key: string,
  grams: number | null
): number | null {
  const direct = finiteNumber(nutriments[`${key}_serving`]);
  if (direct !== null) return round(direct);

  const per100 = finiteNumber(nutriments[`${key}_100g`]);
  if (per100 === null) return null;
  return round(per100 * ((grams ?? 100) / 100));
}

function energyPerServing(nutriments: Record<string, unknown>, grams: number | null): number | null {
  return nutrientPerServing(nutriments, 'energy-kcal', grams)
    ?? nutrientPerServing(nutriments, 'energy_kcal', grams);
}

function sodiumPerServingMg(nutriments: Record<string, unknown>, grams: number | null): number | null {
  const directMilligrams = finiteNumber(nutriments.sodium_mg_serving);
  if (directMilligrams !== null) return round(directMilligrams);

  const milligramsPer100 = finiteNumber(nutriments.sodium_mg_100g);
  if (milligramsPer100 !== null) return round(milligramsPer100 * ((grams ?? 100) / 100));

  const directGrams = finiteNumber(nutriments.sodium_serving);
  if (directGrams !== null) return round(directGrams * 1000);

  const gramsPer100 = finiteNumber(nutriments.sodium_100g);
  return gramsPer100 === null ? null : round(gramsPer100 * ((grams ?? 100) / 100) * 1000);
}

function sodiumPer100gMg(nutriments: Record<string, unknown>): number | null {
  const milligrams = finiteNumber(nutriments.sodium_mg_100g);
  if (milligrams !== null) return round(milligrams);
  const grams = finiteNumber(nutriments.sodium_100g);
  return grams === null ? null : round(grams * 1000);
}

function pushUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

function productSignals(input: {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  novaGroup: number | null;
  additivesCount: number | null;
}): { flags: FoodQualityFlag[]; reasons: NutritionReasonCode[] } {
  const flags: FoodQualityFlag[] = [];
  const reasons: NutritionReasonCode[] = [];

  if ((input.novaGroup ?? 0) >= 4 || (input.additivesCount ?? 0) >= 4) {
    pushUnique(flags, 'ultra_processed_indicator');
    pushUnique(reasons, 'processing_level_high');
  }
  if ((input.sugar ?? 0) >= 15) {
    pushUnique(flags, 'added_sugar');
    pushUnique(reasons, 'added_sugar_high');
  }
  if ((input.sodium ?? 0) >= 600) {
    pushUnique(flags, 'high_sodium');
    pushUnique(reasons, 'sodium_high');
  }
  if ((input.calories ?? 0) >= 250 && (input.protein ?? 0) < 10) {
    pushUnique(flags, 'protein_low');
    pushUnique(reasons, 'protein_low');
  } else if ((input.protein ?? 0) >= 15) {
    pushUnique(reasons, 'protein_supportive');
  }
  if ((input.carbs ?? 0) >= 25 && (input.fiber ?? 0) < 3) {
    pushUnique(flags, 'low_fiber');
    pushUnique(reasons, 'fiber_low');
  } else if ((input.fiber ?? 0) >= 5) {
    pushUnique(reasons, 'fiber_supportive');
  }
  if ((input.protein ?? 0) >= 15 && (input.fiber ?? 0) >= 5 && flags.length === 0) {
    pushUnique(flags, 'balanced_meal');
    pushUnique(reasons, 'balanced_meal');
  }
  if (input.novaGroup !== null && input.novaGroup <= 2 && flags.length === 0) {
    pushUnique(flags, 'whole_food_emphasis');
    pushUnique(reasons, 'whole_food_emphasis');
  }

  return { flags, reasons };
}

function productConfidence(coreCount: number, hasServing: boolean, hasIngredients: boolean): DataConfidence {
  if (coreCount >= 5 && hasServing && hasIngredients) return 'high';
  if (coreCount >= 3) return 'medium';
  return 'low';
}

export function normalizeOpenFoodFactsProduct(
  barcode: string,
  product: OpenFoodFactsProduct
): HealthiProductSnapshot | null {
  const name = cleanString(product.product_name) ?? cleanString(product.generic_name);
  if (!name) return null;

  const providedServingGrams = servingGrams(product);
  const grams = providedServingGrams ?? 100;
  const nutriments = asRecord(product.nutriments);
  const calories = energyPerServing(nutriments, grams);
  const protein = nutrientPerServing(nutriments, 'proteins', grams);
  const carbs = nutrientPerServing(nutriments, 'carbohydrates', grams);
  const fat = nutrientPerServing(nutriments, 'fat', grams);
  const saturatedFat = nutrientPerServing(nutriments, 'saturated-fat', grams);
  const fiber = nutrientPerServing(nutriments, 'fiber', grams);
  const sugar = nutrientPerServing(nutriments, 'sugars', grams);
  const sodium = sodiumPerServingMg(nutriments, grams);
  const coreCount = [calories, protein, carbs, fat, fiber, sugar, sodium].filter((value) => value !== null).length;
  const ingredients = cleanString(product.ingredients_text);
  const signals = productSignals({
    calories,
    protein,
    carbs,
    fiber,
    sugar,
    sodium,
    novaGroup: finiteNumber(product.nova_group),
    additivesCount: finiteNumber(product.additives_n)
  });
  const reasonCodes: NutritionReasonCode[] = ['product_label_data', ...signals.reasons];

  if (coreCount < 4) {
    pushUnique(reasonCodes, 'partial_nutrition_data');
    pushUnique(reasonCodes, 'nutrition_calibrating');
  }

  return {
    barcode,
    provider: 'open_food_facts',
    provider_product_id: cleanString(product.code) ?? barcode,
    name,
    brand: cleanString(product.brands)?.split(',')[0]?.trim() ?? null,
    serving_size: cleanString(product.serving_size) ?? '100 g reference',
    serving_quantity_g: grams,
    calories_per_serving: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    saturated_fat_g: saturatedFat,
    fiber_g: fiber,
    sugar_g: sugar,
    sodium_mg: sodium,
    ingredients_text: ingredients,
    labels: cleanTagList(product.labels_tags),
    categories_tags: cleanTagList(product.categories_tags),
    packaging_tags: cleanTagList(product.packaging_tags),
    nutriments_per_100g: {
      calories: round(finiteNumber(nutriments['energy-kcal_100g']) ?? finiteNumber(nutriments.energy_kcal_100g)),
      sugar_g: round(finiteNumber(nutriments.sugars_100g)),
      protein_g: round(finiteNumber(nutriments.proteins_100g)),
      fiber_g: round(finiteNumber(nutriments.fiber_100g)),
      sodium_mg: sodiumPer100gMg(nutriments),
      saturated_fat_g: round(finiteNumber(nutriments['saturated-fat_100g']))
    },
    quality_flags: signals.flags,
    confidence: productConfidence(coreCount, providedServingGrams !== null, ingredients !== null),
    reason_codes: reasonCodes
  };
}

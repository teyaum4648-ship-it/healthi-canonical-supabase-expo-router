import type {
  DataConfidence,
  FoodQualityFlag,
  NutritionReasonCode
} from '../../../engines/nutrition';
import type { HealthiProductSnapshot } from './productLookupTypes';
import { resolveIngredientEvidence } from './ingredientEvidenceResolver';
import { canonicalBarcodeIdentity } from './barcodeUtils';
import { productThumbnail } from './productImage';
import type {
  NutrientEvidenceLedger,
  NutrientIdentifier,
  NutrientMetricUnit,
  NutrientObservation,
  ProductEvidenceField,
  ProductFieldProvenance
} from './productDataProvider';
import {
  buildNutrientEvidenceLedger,
  derivePerServingObservation,
  nutrientEvidenceConfidence,
  nutrientObservation,
  selectedNutrition
} from './nutrientEvidence';
import {
  VALIDATED_NUTRIENT_FIELDS,
  validateNutritionData,
  type ProviderResolutionTrace
} from './nutritionValidation';

export type OpenFoodFactsProduct = {
  [key: string]: unknown;
  code?: unknown;
  product_name?: unknown;
  generic_name?: unknown;
  brands?: unknown;
  serving_size?: unknown;
  serving_quantity?: unknown;
  ingredients_text?: unknown;
  ingredients_text_en?: unknown;
  ingredients?: unknown;
  ingredients_n?: unknown;
  lang?: unknown;
  languages_codes?: unknown;
  countries_tags?: unknown;
  quantity?: unknown;
  abbreviated_product_name?: unknown;
  last_modified_t?: unknown;
  last_modified_datetime?: unknown;
  completeness?: unknown;
  data_quality_tags?: unknown;
  labels_tags?: unknown;
  categories_tags?: unknown;
  packaging_tags?: unknown;
  nova_group?: unknown;
  additives_n?: unknown;
  nutriments?: unknown;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

function servingDetails(product: OpenFoodFactsProduct): {
  quantity: number | null;
  unit: string | null;
  equivalent: string | null;
} {
  const servingSize = cleanString(product.serving_size);
  const metricMatches = [...(servingSize?.matchAll(/([\d.]+)\s*(ml|g)\b/ig) ?? [])];
  const metric = metricMatches.at(-1) ?? null;
  const metricQuantity = finiteNumber(metric?.[1]);
  const metricUnit = metric?.[2]?.toLowerCase() ?? null;
  const direct = finiteNumber(product.serving_quantity);
  return {
    quantity: metricQuantity ?? (metricUnit ? direct : null),
    unit: metricUnit,
    equivalent: servingSize
  };
}

function signedNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function metricPackageQuantity(value: unknown): { quantity: number; unit: NutrientMetricUnit } | null {
  const quantityText = cleanString(value);
  const matches = [...(quantityText?.matchAll(/([\d.]+)\s*(fl\s*oz|oz|lb|kg|l|ml|g)\b/ig) ?? [])];
  const match = matches.at(-1);
  const rawQuantity = signedNumber(match?.[1]);
  const unit = match?.[2]?.toLowerCase().replace(/\s+/g, '');
  if (rawQuantity === null || rawQuantity <= 0 || !unit) return null;
  if (unit === 'g' || unit === 'ml') return { quantity: rawQuantity, unit };
  if (unit === 'kg') return { quantity: rawQuantity * 1_000, unit: 'g' };
  if (unit === 'lb') return { quantity: rawQuantity * 453.59237, unit: 'g' };
  if (unit === 'oz') return { quantity: rawQuantity * 28.349523125, unit: 'g' };
  if (unit === 'l') return { quantity: rawQuantity * 1_000, unit: 'ml' };
  if (unit === 'floz') return { quantity: rawQuantity * 29.5735295625, unit: 'ml' };
  return null;
}

const OFF_NUTRIENT_SPECS: Array<{
  nutrient: NutrientIdentifier;
  rawKeys: string[];
  unit: NutrientObservation['unit'];
  multiplier: number;
}> = [
  { nutrient: 'calories', rawKeys: ['energy-kcal', 'energy_kcal'], unit: 'kcal', multiplier: 1 },
  { nutrient: 'protein_g', rawKeys: ['proteins'], unit: 'g', multiplier: 1 },
  { nutrient: 'carbs_g', rawKeys: ['carbohydrates'], unit: 'g', multiplier: 1 },
  { nutrient: 'fat_g', rawKeys: ['fat'], unit: 'g', multiplier: 1 },
  { nutrient: 'saturated_fat_g', rawKeys: ['saturated-fat'], unit: 'g', multiplier: 1 },
  { nutrient: 'fiber_g', rawKeys: ['fiber'], unit: 'g', multiplier: 1 },
  { nutrient: 'sugar_g', rawKeys: ['sugars'], unit: 'g', multiplier: 1 },
  { nutrient: 'added_sugar_g', rawKeys: ['added-sugars'], unit: 'g', multiplier: 1 },
  { nutrient: 'sodium_mg', rawKeys: ['sodium_mg'], unit: 'mg', multiplier: 1 },
  { nutrient: 'sodium_mg', rawKeys: ['sodium'], unit: 'mg', multiplier: 1_000 },
  { nutrient: 'sodium_mg', rawKeys: ['salt'], unit: 'mg', multiplier: 400 },
  { nutrient: 'caffeine_mg', rawKeys: ['caffeine_mg'], unit: 'mg', multiplier: 1 },
  { nutrient: 'caffeine_mg', rawKeys: ['caffeine'], unit: 'mg', multiplier: 1_000 }
];

function openFoodFactsNutrientEvidence(
  product: OpenFoodFactsProduct,
  nutriments: Record<string, unknown>,
  updatedAt: string | null
): NutrientEvidenceLedger {
  const serving = servingDetails(product);
  const metricServing = serving.quantity !== null && (serving.unit === 'g' || serving.unit === 'ml')
    ? { quantity: serving.quantity, unit: serving.unit as NutrientMetricUnit }
    : null;
  const packageMetric = metricPackageQuantity(product.quantity);
  const providerRecordId = cleanString(product.code);
  const observations: NutrientObservation[] = [];
  for (const spec of OFF_NUTRIENT_SPECS) {
    for (const rawKey of spec.rawKeys) {
      for (const suffix of ['serving', '100g', '100ml', 'package'] as const) {
        const rawField = `${rawKey}_${suffix}`;
        const rawValue = signedNumber(nutriments[rawField]);
        if (rawValue === null) continue;
        const basis = suffix === 'serving'
          ? metricServing ? 'per_serving' : 'unknown'
          : suffix === '100g'
            ? 'per_100g'
            : suffix === '100ml'
              ? 'per_100ml'
              : 'per_package';
        const observation = nutrientObservation({
          nutrient: spec.nutrient,
          value: rawValue * spec.multiplier,
          unit: spec.unit,
          basis,
          servingQuantity: suffix === 'serving' ? metricServing?.quantity ?? null : null,
          servingUnit: suffix === 'serving' ? metricServing?.unit ?? null : null,
          packageQuantity: packageMetric?.quantity ?? null,
          packageUnit: packageMetric?.unit ?? null,
          provider: 'open_food_facts',
          providerRecordId,
          directlyReported: true,
          derivedFrom: [],
          conversionFormula: spec.multiplier === 1 ? null : `${rawField} × ${spec.multiplier}`,
          conversionConfidence: 'high',
          confidence: basis === 'unknown' ? 'low' : 'medium',
          sourceTimestamp: updatedAt,
          rawField,
          selectionReason: null
        });
        observations.push(observation);
        if (metricServing && (basis === 'per_100g' || basis === 'per_100ml')) {
          const derived = derivePerServingObservation(observation, metricServing.quantity, metricServing.unit);
          if (derived) observations.push(derived);
        }
      }
    }
  }
  return buildNutrientEvidenceLedger(
    observations,
    metricServing ? { servingQuantity: metricServing.quantity, servingUnit: metricServing.unit } : undefined
  );
}

function ingredientSignals(value: string | null): { tokens: string[]; additives: string[] } {
  if (!value) return { tokens: [], additives: [] };
  return {
    tokens: value.split(/[,;]/).map((item) => item.trim()).filter(Boolean),
    additives: [
      /\b(natural flavors?|artificial flavors?)\b/i.test(value) ? 'flavor_system' : null,
      /\b(xanthan gum|guar gum|carrageenan|cellulose gum|lecithin)\b/i.test(value) ? 'texture_system' : null,
      /\b(red 40|yellow 5|yellow 6|blue 1|artificial colors?)\b/i.test(value) ? 'color_system' : null,
      /\b(sucralose|aspartame|acesulfame potassium|saccharin)\b/i.test(value) ? 'synthetic_sweetener_system' : null
    ].filter((item): item is string => Boolean(item))
  };
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

function timestamp(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const seconds = finiteNumber(value);
  return seconds === null ? null : new Date(seconds * 1000).toISOString();
}

function provenance(
  product: OpenFoodFactsProduct,
  updatedAt: string | null,
  ingredientConfidence: DataConfidence,
  nutritionConfidence: DataConfidence,
  servingConfidence: DataConfidence
): Partial<Record<ProductEvidenceField, ProductFieldProvenance[]>> {
  const provider_record_id = cleanString(product.code);
  const item = (confidence: DataConfidence): ProductFieldProvenance[] => [{
    provider: 'open_food_facts', provider_record_id, source_timestamp: updatedAt, confidence
  }];
  return {
    name: item('high'), brand: item(cleanString(product.brands) ? 'high' : 'low'), variant: item(cleanString(product.abbreviated_product_name) ? 'medium' : 'low'),
    ingredients: item(ingredientConfidence), nutrition: item(nutritionConfidence), serving: item(servingConfidence),
    category: item(cleanTagList(product.categories_tags).length > 0 ? 'medium' : 'low'), product_form: item('low')
  };
}

function nutrientProvenance(ledger: NutrientEvidenceLedger): Partial<Record<ProductEvidenceField, ProductFieldProvenance[]>> {
  const output: Partial<Record<ProductEvidenceField, ProductFieldProvenance[]>> = {};
  for (const observation of ledger.observations) {
    const selected = observation.selectedFor.length > 0;
    const item: ProductFieldProvenance = {
      provider: observation.provider,
      provider_record_id: observation.providerRecordId,
      source_timestamp: observation.sourceTimestamp,
      confidence: observation.confidence,
      raw_field: observation.rawField,
      selected,
      selection_reason: selected ? observation.selectionReason ?? 'Selected by nutrient evidence policy.' : observation.rejectionReasons.join(' ') || null
    };
    output[observation.nutrient] = [...(output[observation.nutrient] ?? []), item];
  }
  return output;
}

export function normalizeOpenFoodFactsProduct(
  barcode: string,
  product: OpenFoodFactsProduct
): HealthiProductSnapshot | null {
  const name = cleanString(product.product_name) ?? cleanString(product.generic_name);
  if (!name) return null;

  const nutriments = asRecord(product.nutriments);
  const updatedAt = timestamp(product.last_modified_datetime) ?? timestamp(product.last_modified_t);
  const nutrientEvidence = openFoodFactsNutrientEvidence(product, nutriments, updatedAt);
  const servingNutrition = selectedNutrition(nutrientEvidence, 'per_serving');
  const per100gNutrition = selectedNutrition(nutrientEvidence, 'per_100g');
  const per100mlNutrition = selectedNutrition(nutrientEvidence, 'per_100ml');
  const ingredientEvidence = resolveIngredientEvidence(product);
  const ingredients = ingredientEvidence.resolved_text;
  const parsedIngredients = ingredientSignals(ingredients);
  const serving = servingDetails(product);
  const packageMetric = metricPackageQuantity(product.quantity);
  const categories = cleanTagList(product.categories_tags);
  const reportedServingQuantity = finiteNumber(product.serving_quantity);
  const nutritionValidation = validateNutritionData({
    source: 'open_food_facts',
    values: servingNutrition,
    basis: 'PER_SERVING',
    servingQuantity: serving.quantity,
    servingUnit: serving.unit,
    servingDescription: serving.equivalent,
    reportedServingQuantity,
    packageQuantity: packageMetric?.quantity ?? null,
    packageUnit: packageMetric?.unit ?? null,
    per100g: per100gNutrition,
    per100ml: per100mlNutrition,
    ingredientsText: ingredients,
    categoryAvailable: categories.length > 0,
    categories
  });
  const calories = nutritionValidation.nutrients.calories.value;
  const protein = nutritionValidation.nutrients.protein_g.value;
  const carbs = nutritionValidation.nutrients.carbs_g.value;
  const fat = nutritionValidation.nutrients.fat_g.value;
  const saturatedFat = nutritionValidation.nutrients.saturated_fat_g.value;
  const fiber = nutritionValidation.nutrients.fiber_g.value;
  const sugar = nutritionValidation.nutrients.sugar_g.value;
  const addedSugar = nutritionValidation.nutrients.added_sugar_g.value;
  const sodium = nutritionValidation.nutrients.sodium_mg.value;
  const caffeine = nutritionValidation.nutrients.caffeine_mg.value;
  const selectedServingCount = [calories, protein, carbs, fat, fiber, sugar, sodium].filter((value) => value !== null).length;
  const selectedPer100Count = Object.values(per100gNutrition).filter((value) => value !== null && value !== undefined).length;
  const coreCount = Math.max(selectedServingCount, selectedPer100Count);
  const validServing = nutritionValidation.serving.reliability === 'KNOWN'
    ? { quantity: nutritionValidation.serving.value, unit: nutritionValidation.serving.unit }
    : null;
  const validatedNutrientEvidence = buildNutrientEvidenceLedger(
    nutrientEvidence.observations.map((observation) => {
      const nutrientReliability = nutritionValidation.nutrients[observation.nutrient].reliability;
      const rejected = observation.basis === 'per_serving' && (
        nutrientReliability === 'CONFLICTED' || nutrientReliability === 'UNRELIABLE' ||
        nutritionValidation.serving.reliability === 'CONFLICTED' || nutritionValidation.serving.reliability === 'UNRELIABLE'
      );
      return rejected
        ? {
            ...observation,
            plausibilityFlags: [...new Set([...observation.plausibilityFlags, 'provider_validation_rejected'])],
            plausibilityNotes: [...new Set([
              ...observation.plausibilityNotes,
              ...nutritionValidation.nutrients[observation.nutrient].validationIssues.map((value) => value.code)
            ])]
          }
        : observation;
    }),
    validServing?.quantity !== null && validServing?.quantity !== undefined && (validServing.unit === 'g' || validServing.unit === 'ml')
      ? { servingQuantity: validServing.quantity, servingUnit: validServing.unit }
      : undefined
  );
  const providedServingGrams = validServing?.unit === 'g' ? validServing.quantity : null;
  const servingConfidence: DataConfidence = validServing ? 'high' : 'low';
  const selectedNutritionBasis = selectedServingCount > 0 ? 'per_serving' : selectedPer100Count > 0 ? 'per_100g' : 'per_100ml';
  const nutritionConfidence = nutritionValidation.validationIssues.some((item) => item.severity === 'ERROR' || item.severity === 'CRITICAL')
    ? 'low'
    : nutrientEvidenceConfidence(validatedNutrientEvidence, selectedNutritionBasis);
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

  const providerResolutionTrace: ProviderResolutionTrace[] = [
    ...VALIDATED_NUTRIENT_FIELDS.map((field) => ({
      field,
      candidates: [{ source: 'open_food_facts', value: servingNutrition[field] ?? null, reliability: nutritionValidation.nutrients[field].reliability }],
      selectedSource: nutritionValidation.nutrients[field].value === null ? null : 'open_food_facts',
      selectedValue: nutritionValidation.nutrients[field].value,
      reason: nutritionValidation.nutrients[field].validationIssues.map((item) => item.code).join(', ') ||
        (nutritionValidation.nutrients[field].value === null ? 'No reliable value is available.' : 'The normalized provider value passed validation.')
    })),
    {
      field: 'serving',
      candidates: [{ source: 'open_food_facts', value: serving.quantity, reliability: nutritionValidation.serving.reliability }],
      selectedSource: validServing ? 'open_food_facts' : null,
      selectedValue: validServing?.quantity ?? null,
      reason: nutritionValidation.serving.validationIssues.map((item) => item.code).join(', ') ||
        (validServing ? 'The metric serving passed validation.' : 'No reliable metric serving is available.')
    }
  ];

  return {
    barcode,
    canonical_barcode: canonicalBarcodeIdentity(cleanString(product.code) ?? barcode),
    image_url: productThumbnail(product),
    provider: 'open_food_facts',
    provider_product_id: cleanString(product.code) ?? barcode,
    name,
    brand: cleanString(product.brands)?.split(',')[0]?.trim() ?? null,
    serving_size: cleanString(product.serving_size),
    serving_quantity_g: providedServingGrams,
    serving_quantity: validServing?.quantity ?? null,
    serving_unit: validServing?.unit ?? null,
    serving_equivalent: serving.equivalent,
    calories_per_serving: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    saturated_fat_g: saturatedFat,
    fiber_g: fiber,
    sugar_g: sugar,
    added_sugar_g: addedSugar,
    sodium_mg: sodium,
    caffeine_mg: caffeine,
    ingredients_text: ingredients,
    ingredient_tokens: parsedIngredients.tokens,
    additive_signals: parsedIngredients.additives,
    ingredient_evidence: ingredientEvidence,
    evidence_confidence: {
      identity: 'high',
      ingredients: ingredientEvidence.confidence,
      nutrition: nutritionConfidence,
      serving: servingConfidence,
      category: categories.length > 0 ? 'medium' : 'low',
      product_form: 'low',
      provider: 'medium',
      overall: productConfidence(coreCount, Boolean(validServing), ingredients !== null)
    },
    variant: cleanString(product.abbreviated_product_name),
    quantity: cleanString(product.quantity),
    provider_updated_at: updatedAt,
    provider_completeness: finiteNumber(product.completeness),
    provider_quality_tags: cleanTagList(product.data_quality_tags),
    field_provenance: {
      ...provenance(product, updatedAt, ingredientEvidence.confidence, nutritionConfidence, servingConfidence),
      ...nutrientProvenance(validatedNutrientEvidence)
    },
    provider_conflicts: [...new Set([
      ...ingredientEvidence.conflicts,
      ...validatedNutrientEvidence.conflicts,
      ...nutritionValidation.validationIssues.map((item) => `${item.code}: ${item.message}`)
    ])],
    nutrient_evidence: validatedNutrientEvidence,
    nutrition_validation: nutritionValidation,
    validation_issues: nutritionValidation.validationIssues,
    provider_resolution_trace: providerResolutionTrace,
    labels: cleanTagList(product.labels_tags),
    categories_tags: categories,
    packaging_tags: cleanTagList(product.packaging_tags),
    nutriments_per_100g: {
      calories: per100gNutrition.calories ?? null,
      carbs_g: per100gNutrition.carbs_g ?? null,
      fat_g: per100gNutrition.fat_g ?? null,
      sugar_g: per100gNutrition.sugar_g ?? null,
      added_sugar_g: per100gNutrition.added_sugar_g ?? null,
      protein_g: per100gNutrition.protein_g ?? null,
      fiber_g: per100gNutrition.fiber_g ?? null,
      sodium_mg: per100gNutrition.sodium_mg ?? null,
      saturated_fat_g: per100gNutrition.saturated_fat_g ?? null,
      caffeine_mg: per100gNutrition.caffeine_mg ?? null
    },
    nutriments_per_100ml: {
      calories: per100mlNutrition.calories ?? null,
      carbs_g: per100mlNutrition.carbs_g ?? null,
      fat_g: per100mlNutrition.fat_g ?? null,
      sugar_g: per100mlNutrition.sugar_g ?? null,
      added_sugar_g: per100mlNutrition.added_sugar_g ?? null,
      protein_g: per100mlNutrition.protein_g ?? null,
      fiber_g: per100mlNutrition.fiber_g ?? null,
      sodium_mg: per100mlNutrition.sodium_mg ?? null,
      saturated_fat_g: per100mlNutrition.saturated_fat_g ?? null,
      caffeine_mg: per100mlNutrition.caffeine_mg ?? null
    },
    quality_flags: signals.flags,
    confidence: productConfidence(coreCount, Boolean(validServing), ingredients !== null),
    reason_codes: reasonCodes
  };
}

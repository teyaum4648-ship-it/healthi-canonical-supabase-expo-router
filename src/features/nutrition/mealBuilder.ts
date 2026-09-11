import type { FoodQualityFlag, MealLog, MealType, NutritionReasonCode } from '../../engines/nutrition';
import { calculateProductQuality } from './productLookup/productQuality';
import type { HealthiProductSnapshot, ProductQualitySnapshot } from './productLookup/productLookupTypes';
import type { MealItemSource, MealLogItemPersistenceInput } from './mealItemPersistence';
import type { UserFoodProductRow } from './productLibraryPersistence';
import type { JsonValue } from './persistence';
import { canonicalBarcodeIdentity } from './productLookup/barcodeUtils';
import { safeProductImageUrl } from './productLookup/productImage';
import { foodLoggingNutrition } from './foodLoggingNutrition';

export type MealBuilderItem = {
  id: string;
  food_product_id: string | null;
  snapshot: HealthiProductSnapshot;
  quality: ProductQualitySnapshot;
  servings: number;
  source: MealItemSource;
};

export type MealBuilderState = {
  name: string;
  meal_type: MealType;
  items: MealBuilderItem[];
};

export type MealBuilderTotals = {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
};

export type ManualProductFormState = {
  name: string;
  brand: string;
  serving_size: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
};

export type ManualProductValidation =
  | { valid: true; snapshot: HealthiProductSnapshot }
  | { valid: false; message: string };

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function scale(value: number | null | undefined, servings: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? rounded(value * servings) : null;
}

function total(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => typeof value === 'number');
  return known.length > 0 ? rounded(known.reduce((sum, value) => sum + value, 0)) : null;
}

function numericValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? rounded(parsed) : null;
}

function cloneSnapshot(snapshot: HealthiProductSnapshot): HealthiProductSnapshot {
  return {
    ...snapshot,
    ingredient_evidence: snapshot.ingredient_evidence ? JSON.parse(JSON.stringify(snapshot.ingredient_evidence)) : undefined,
    evidence_confidence: snapshot.evidence_confidence ? { ...snapshot.evidence_confidence } : undefined,
    provider_quality_tags: snapshot.provider_quality_tags ? [...snapshot.provider_quality_tags] : undefined,
    field_provenance: snapshot.field_provenance ? JSON.parse(JSON.stringify(snapshot.field_provenance)) : undefined,
    provider_conflicts: snapshot.provider_conflicts ? [...snapshot.provider_conflicts] : undefined,
    nutrient_evidence: snapshot.nutrient_evidence ? JSON.parse(JSON.stringify(snapshot.nutrient_evidence)) : undefined,
    nutrition_validation: snapshot.nutrition_validation ? JSON.parse(JSON.stringify(snapshot.nutrition_validation)) : undefined,
    validation_issues: snapshot.validation_issues ? JSON.parse(JSON.stringify(snapshot.validation_issues)) : undefined,
    provider_resolution_trace: snapshot.provider_resolution_trace ? JSON.parse(JSON.stringify(snapshot.provider_resolution_trace)) : undefined,
    product_identity_resolution: snapshot.product_identity_resolution
      ? JSON.parse(JSON.stringify(snapshot.product_identity_resolution))
      : snapshot.product_identity_resolution,
    provider_resolution: snapshot.provider_resolution ? JSON.parse(JSON.stringify(snapshot.provider_resolution)) : undefined,
    lab_evidence_reference: snapshot.lab_evidence_reference
      ? JSON.parse(JSON.stringify(snapshot.lab_evidence_reference))
      : undefined,
    labels: snapshot.labels ? [...snapshot.labels] : undefined,
    categories_tags: snapshot.categories_tags ? [...snapshot.categories_tags] : undefined,
    packaging_tags: snapshot.packaging_tags ? [...snapshot.packaging_tags] : undefined,
    nutriments_per_100g: snapshot.nutriments_per_100g ? { ...snapshot.nutriments_per_100g } : undefined,
    nutriments_per_100ml: snapshot.nutriments_per_100ml ? { ...snapshot.nutriments_per_100ml } : undefined,
    quality_flags: [...snapshot.quality_flags],
    reason_codes: [...snapshot.reason_codes]
  };
}

function cloneQuality(quality: ProductQualitySnapshot): ProductQualitySnapshot {
  return {
    ...quality,
    positives: [...quality.positives],
    considerations: [...quality.considerations],
    reason_codes: [...quality.reason_codes],
    estimated_grade_range: quality.estimated_grade_range ? [...quality.estimated_grade_range] : null,
    estimated_score_range: quality.estimated_score_range ? [...quality.estimated_score_range] : null,
    grade_certainty: quality.grade_certainty ? {
      ...quality.grade_certainty,
      gradesSpanned: [...quality.grade_certainty.gradesSpanned]
    } : null,
    missing_evidence: quality.missing_evidence ? [...quality.missing_evidence] : undefined,
    evidence_confidence: quality.evidence_confidence ? { ...quality.evidence_confidence } : undefined,
    nutrient_basis: quality.nutrient_basis ? { ...quality.nutrient_basis } : undefined,
    macro_context: quality.macro_context ? {
      summary: quality.macro_context.summary,
      highlights: [...quality.macro_context.highlights]
    } : undefined,
    factors: quality.factors?.map((factor) => ({
      ...factor,
      matched: [...factor.matched],
      evidence_refs: [...(factor.evidence_refs ?? [])]
    })),
    top_drivers: quality.top_drivers?.map((factor) => ({
      ...factor,
      matched: [...factor.matched],
      evidence_refs: [...(factor.evidence_refs ?? [])]
    })),
    better_options: quality.better_options?.map((option) => ({
      ...option,
      criteria: [...option.criteria],
      reason_codes: [...option.reason_codes]
    })),
    evidence_refs: quality.evidence_refs?.map((reference) => ({ ...reference }))
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function createEmptyMealBuilder(): MealBuilderState {
  return { name: '', meal_type: 'unknown', items: [] };
}

export function createEmptyManualProductForm(): ManualProductFormState {
  return {
    name: '',
    brand: '',
    serving_size: '',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    fiber_g: '',
    sugar_g: '',
    sodium_mg: ''
  };
}

export function normalizeMealBuilderServings(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 20) return null;
  return Math.round(parsed * 100) / 100;
}

export function addMealBuilderItem(
  builder: MealBuilderState,
  input: {
    snapshot: HealthiProductSnapshot;
    productId?: string | null;
    source: MealItemSource;
    servings?: number;
    id?: string;
  }
): MealBuilderState {
  const servings = normalizeMealBuilderServings(input.servings ?? 1) ?? 1;
  const item: MealBuilderItem = {
    id: input.id ?? `meal-item-${Date.now()}-${builder.items.length + 1}`,
    food_product_id: input.productId ?? null,
    snapshot: cloneSnapshot(input.snapshot),
    quality: calculateProductQuality(input.snapshot),
    servings,
    source: input.source
  };

  return { ...builder, items: [...builder.items, item] };
}

export function removeMealBuilderItem(builder: MealBuilderState, itemId: string): MealBuilderState {
  return { ...builder, items: builder.items.filter((item) => item.id !== itemId) };
}

export function updateMealBuilderItemServings(
  builder: MealBuilderState,
  itemId: string,
  value: number | string
): MealBuilderState {
  const servings = normalizeMealBuilderServings(value);
  if (servings === null) return builder;

  return {
    ...builder,
    items: builder.items.map((item) => item.id === itemId ? { ...item, servings } : item)
  };
}

export function calculateMealBuilderTotals(items: MealBuilderItem[]): MealBuilderTotals {
  const scaled = (key: keyof MealBuilderTotals) => total(items.map(item => scale(foodLoggingNutrition(item.snapshot).nutrients[key], item.servings)));
  return {
    calories: scaled('calories'), protein_g: scaled('protein_g'), carbs_g: scaled('carbs_g'), fat_g: scaled('fat_g'),
    fiber_g: scaled('fiber_g'), sugar_g: scaled('sugar_g'), sodium_mg: scaled('sodium_mg'), saturated_fat_g: scaled('saturated_fat_g')
  };
}

export function mealBuilderToAggregateMealLog(
  builder: MealBuilderState,
  loggedAt = new Date().toISOString(),
  demoMode = false
): MealLog {
  const totals = calculateMealBuilderTotals(builder.items);
  const qualityFlags = unique(builder.items.flatMap((item) => item.snapshot.quality_flags)) as FoodQualityFlag[];
  const reasonCodes = unique([
    'manual_food_log' as NutritionReasonCode,
    'product_label_data' as NutritionReasonCode,
    ...builder.items.flatMap((item) => item.snapshot.reason_codes),
    ...(builder.items.some((item) => item.source === 'scanner') ? ['barcode_food_logged' as NutritionReasonCode] : []),
    ...(builder.items.length === 0 || [totals.calories, totals.protein_g, totals.carbs_g, totals.fat_g].filter((value) => value !== null).length < 2
      ? ['nutrition_calibrating' as NutritionReasonCode, 'partial_nutrition_data' as NutritionReasonCode]
      : [])
  ]);

  return {
    logged_at: loggedAt,
    meal_type: builder.meal_type,
    name: builder.name.trim() || `${builder.meal_type === 'unknown' ? 'Meal' : builder.meal_type} meal`,
    source: demoMode ? 'demo' : 'manual',
    source_confidence: builder.items.some((item) => item.quality.confidence === 'low') ? 'low' : 'medium',
    calories: totals.calories,
    protein_g: totals.protein_g,
    carbs_g: totals.carbs_g,
    fat_g: totals.fat_g,
    fiber_g: totals.fiber_g,
    sugar_g: totals.sugar_g,
    sodium_mg: totals.sodium_mg,
    ingredients: builder.items.map((item) => item.snapshot.name),
    quality_flags: qualityFlags,
    user_response: null,
    corrected_by_user: false,
    confirmed_by_user: true,
    reason_codes: reasonCodes,
    created_at: loggedAt
  };
}

export function mealBuilderItemToPersistenceInput(
  item: MealBuilderItem,
  mealLogId: string | null,
  loggedAt: string,
  mealType: MealType,
  demoMode = false
): MealLogItemPersistenceInput {
  const logging = foodLoggingNutrition(item.snapshot);
  return {
    meal_log_id: mealLogId,
    food_product_id: item.food_product_id,
    logged_at: loggedAt,
    meal_type: mealType,
    name: item.snapshot.name,
    brand: item.snapshot.brand,
    servings: item.servings,
    serving_size: logging.basis.startsWith('per_100') ? logging.label : item.snapshot.serving_size,
    serving_quantity_g: logging.quantityG,
    calories: scale(logging.nutrients.calories, item.servings),
    protein_g: scale(logging.nutrients.protein_g, item.servings),
    carbs_g: scale(logging.nutrients.carbs_g, item.servings),
    fat_g: scale(logging.nutrients.fat_g, item.servings),
    fiber_g: scale(logging.nutrients.fiber_g, item.servings),
    sugar_g: scale(logging.nutrients.sugar_g, item.servings),
    sodium_mg: scale(logging.nutrients.sodium_mg, item.servings),
    saturated_fat_g: scale(logging.nutrients.saturated_fat_g, item.servings),
    barcode: item.snapshot.barcode,
    provider: item.snapshot.provider,
    provider_product_id: item.snapshot.provider_product_id,
    quality_label: item.quality.label,
    quality_score: item.quality.score,
    quality_confidence: item.quality.confidence,
    source: demoMode ? 'demo' : item.source,
    source_confidence: item.snapshot.confidence,
    reason_codes: unique(['product_label_data' as NutritionReasonCode, ...item.snapshot.reason_codes]),
    metadata: {
      builder_item_id: item.id,
      logging_nutrient_basis: logging.basis,
      image_url: safeProductImageUrl(item.snapshot.image_url),
      quality_flags: [...item.snapshot.quality_flags],
      quality_summary: item.quality.summary
    }
  };
}

export function userFoodProductRowToSnapshot(row: UserFoodProductRow): HealthiProductSnapshot {
  const envelope = row.quality_snapshot && typeof row.quality_snapshot === 'object' && !Array.isArray(row.quality_snapshot)
    ? row.quality_snapshot as Record<string, JsonValue>
    : {};
  const evidence = envelope.product_evidence && typeof envelope.product_evidence === 'object' && !Array.isArray(envelope.product_evidence)
    ? envelope.product_evidence as Record<string, JsonValue>
    : {};
  const stringList = (value: JsonValue | undefined): string[] | undefined => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
  return {
    barcode: row.barcode ?? '',
    canonical_barcode: typeof evidence.canonical_barcode === 'string' ? evidence.canonical_barcode : canonicalBarcodeIdentity(row.barcode ?? ''),
    provider: row.provider,
    provider_product_id: row.provider_product_id,
    name: row.name,
    brand: row.brand,
    variant: typeof evidence.variant === 'string' ? evidence.variant : null,
    quantity: typeof evidence.quantity === 'string' ? evidence.quantity : null,
    serving_size: row.serving_size,
    image_url: safeProductImageUrl(evidence.image_url),
    serving_quantity_g: row.serving_quantity_g,
    serving_quantity: typeof evidence.serving_quantity === 'number' ? evidence.serving_quantity : row.serving_quantity_g,
    serving_unit: typeof evidence.serving_unit === 'string' ? evidence.serving_unit : row.serving_quantity_g ? 'g' : null,
    serving_equivalent: typeof evidence.serving_equivalent === 'string' ? evidence.serving_equivalent : row.serving_size,
    calories_per_serving: row.calories_per_serving,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    saturated_fat_g: row.saturated_fat_g,
    fiber_g: row.fiber_g,
    sugar_g: row.sugar_g,
    added_sugar_g: typeof evidence.added_sugar_g === 'number' ? evidence.added_sugar_g : null,
    sodium_mg: row.sodium_mg,
    caffeine_mg: typeof evidence.caffeine_mg === 'number' ? evidence.caffeine_mg : null,
    ingredients_text: row.ingredients_text,
    ingredient_evidence: evidence.ingredient_evidence && typeof evidence.ingredient_evidence === 'object'
      ? evidence.ingredient_evidence as unknown as HealthiProductSnapshot['ingredient_evidence'] : undefined,
    ingredient_tokens: stringList(evidence.ingredient_tokens),
    additive_signals: stringList(evidence.additive_signals),
    evidence_confidence: evidence.evidence_confidence && typeof evidence.evidence_confidence === 'object'
      ? evidence.evidence_confidence as unknown as HealthiProductSnapshot['evidence_confidence'] : undefined,
    provider_updated_at: typeof evidence.provider_updated_at === 'string' ? evidence.provider_updated_at : null,
    provider_completeness: typeof evidence.provider_completeness === 'number' ? evidence.provider_completeness : null,
    provider_quality_tags: stringList(evidence.provider_quality_tags),
    field_provenance: evidence.field_provenance && typeof evidence.field_provenance === 'object'
      ? evidence.field_provenance as unknown as HealthiProductSnapshot['field_provenance'] : undefined,
    provider_conflicts: stringList(evidence.provider_conflicts),
    provider_missing_fields: stringList(evidence.provider_missing_fields),
    nutrient_evidence: evidence.nutrient_evidence && typeof evidence.nutrient_evidence === 'object'
      ? evidence.nutrient_evidence as unknown as HealthiProductSnapshot['nutrient_evidence'] : undefined,
    nutrition_validation: evidence.nutrition_validation && typeof evidence.nutrition_validation === 'object'
      ? evidence.nutrition_validation as unknown as HealthiProductSnapshot['nutrition_validation'] : undefined,
    validation_issues: Array.isArray(evidence.validation_issues)
      ? evidence.validation_issues as unknown as HealthiProductSnapshot['validation_issues'] : undefined,
    provider_resolution_trace: Array.isArray(evidence.provider_resolution_trace)
      ? evidence.provider_resolution_trace as unknown as HealthiProductSnapshot['provider_resolution_trace'] : undefined,
    product_identity_resolution: evidence.product_identity_resolution && typeof evidence.product_identity_resolution === 'object'
      ? evidence.product_identity_resolution as unknown as HealthiProductSnapshot['product_identity_resolution'] : null,
    provider_resolution: evidence.provider_resolution && typeof evidence.provider_resolution === 'object'
      ? evidence.provider_resolution as unknown as HealthiProductSnapshot['provider_resolution'] : undefined,
    lab_evidence_reference: row.lab_evidence_state && typeof row.lab_evidence_state === 'object'
      ? row.lab_evidence_state as unknown as HealthiProductSnapshot['lab_evidence_reference'] : undefined,
    labels: stringList(evidence.labels),
    categories_tags: stringList(evidence.categories_tags),
    packaging_tags: stringList(evidence.packaging_tags),
    nutriments_per_100g: evidence.nutriments_per_100g && typeof evidence.nutriments_per_100g === 'object'
      ? evidence.nutriments_per_100g as HealthiProductSnapshot['nutriments_per_100g'] : undefined,
    nutriments_per_100ml: evidence.nutriments_per_100ml && typeof evidence.nutriments_per_100ml === 'object'
      ? evidence.nutriments_per_100ml as HealthiProductSnapshot['nutriments_per_100ml'] : undefined,
    quality_flags: [...row.quality_flags],
    confidence: row.source_confidence,
    reason_codes: [...row.quality_reason_codes]
  };
}

export function validateManualProductForm(form: ManualProductFormState): ManualProductValidation {
  if (!form.name.trim()) return { valid: false, message: 'Add a food name before saving it.' };

  const numericFields = [
    form.calories,
    form.protein_g,
    form.carbs_g,
    form.fat_g,
    form.fiber_g,
    form.sugar_g,
    form.sodium_mg
  ];
  if (numericFields.some((value) => value.trim() && numericValue(value) === null)) {
    return { valid: false, message: 'Use zero or a positive number for nutrition facts.' };
  }

  const snapshot: HealthiProductSnapshot = {
    barcode: '',
    provider: 'manual',
    provider_product_id: null,
    name: form.name.trim(),
    brand: form.brand.trim() || null,
    serving_size: form.serving_size.trim() || null,
    serving_quantity_g: null,
    calories_per_serving: numericValue(form.calories),
    protein_g: numericValue(form.protein_g),
    carbs_g: numericValue(form.carbs_g),
    fat_g: numericValue(form.fat_g),
    saturated_fat_g: null,
    fiber_g: numericValue(form.fiber_g),
    sugar_g: numericValue(form.sugar_g),
    sodium_mg: numericValue(form.sodium_mg),
    ingredients_text: null,
    quality_flags: [],
    confidence: 'medium',
    reason_codes: ['manual_food_log']
  };
  return { valid: true, snapshot };
}

export function manualProductFormToSnapshot(form: ManualProductFormState): HealthiProductSnapshot | null {
  const result = validateManualProductForm(form);
  return result.valid ? result.snapshot : null;
}

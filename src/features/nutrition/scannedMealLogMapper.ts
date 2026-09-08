import type { MealType, NutritionReasonCode } from '../../engines/nutrition';
import type { MealLogPersistenceInput } from './persistence';
import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';

export type ScannedMealLogParams = {
  snapshot: HealthiProductSnapshot;
  servingQuantity: number;
  loggedAt: string;
  mealType?: MealType;
  mealNameOverride?: string;
  id?: string;
  userId?: string;
};

function scale(value: number | null | undefined, quantity: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * quantity * 10) / 10;
}

function uniqueReasons(reasons: NutritionReasonCode[]): NutritionReasonCode[] {
  return [...new Set(reasons)];
}

export function normalizeServingQuantity(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 20) return null;
  return Math.round(parsed * 100) / 100;
}

export function scannedProductToMealLog(params: ScannedMealLogParams): MealLogPersistenceInput {
  const quantity = normalizeServingQuantity(params.servingQuantity) ?? 1;
  const sparse = [
    params.snapshot.calories_per_serving,
    params.snapshot.protein_g,
    params.snapshot.carbs_g,
    params.snapshot.fat_g
  ].filter((value) => typeof value === 'number').length < 2;
  const reasonCodes: NutritionReasonCode[] = [
    'barcode_food_logged',
    'product_label_data',
    ...params.snapshot.reason_codes
  ];

  if (sparse) reasonCodes.push('nutrition_calibrating', 'partial_nutrition_data');

  return {
    id: params.id,
    user_id: params.userId,
    logged_at: params.loggedAt,
    meal_type: params.mealType ?? 'unknown',
    name: params.mealNameOverride?.trim() || params.snapshot.name,
    source: 'barcode_pending',
    source_confidence: params.snapshot.confidence,
    calories: scale(params.snapshot.calories_per_serving, quantity),
    protein_g: scale(params.snapshot.protein_g, quantity),
    carbs_g: scale(params.snapshot.carbs_g, quantity),
    fat_g: scale(params.snapshot.fat_g, quantity),
    fiber_g: scale(params.snapshot.fiber_g, quantity),
    sugar_g: scale(params.snapshot.sugar_g, quantity),
    sodium_mg: scale(params.snapshot.sodium_mg, quantity),
    ingredients: params.snapshot.ingredients_text
      ? params.snapshot.ingredients_text.split(',').map((item) => item.trim()).filter(Boolean)
      : null,
    quality_flags: [...params.snapshot.quality_flags],
    user_response: null,
    corrected_by_user: false,
    confirmed_by_user: true,
    original_source_id: params.snapshot.barcode,
    raw_source_payload: {
      barcode: params.snapshot.barcode,
      provider: params.snapshot.provider,
      provider_product_id: params.snapshot.provider_product_id ?? null,
      serving_quantity: quantity,
      serving_size: params.snapshot.serving_size ?? null
    },
    reason_codes: uniqueReasons(reasonCodes),
    created_at: params.loggedAt
  };
}

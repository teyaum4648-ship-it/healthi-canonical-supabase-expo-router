import type { DataConfidence, FoodQualityFlag, MealDataSource, MealLog, MealType, NutritionReasonCode } from './types';

export type ScannedProductNutriments = {
  'energy-kcal_100g'?: number | null;
  energy_kcal_100g?: number | null;
  proteins_100g?: number | null;
  carbohydrates_100g?: number | null;
  fat_100g?: number | null;
  fiber_100g?: number | null;
  sugars_100g?: number | null;
  sodium_100g?: number | null;
  sodium_mg_100g?: number | null;
  salt_100g?: number | null;
};

export type ScannedProductInput = {
  product_name?: string | null;
  brands?: string | null;
  quantity?: string | null;
  nova_group?: number | null;
  additives_n?: number | null;
  ingredients_text?: string | null;
  categories_tags?: string[] | null;
  nutriments?: ScannedProductNutriments | null;
};

export type AdaptScannedProductParams = {
  product: ScannedProductInput;
  servingGrams: number;
  loggedAt: string;
  mealType?: MealType;
  source?: Extract<MealDataSource, 'barcode_pending' | 'ocr_pending' | 'food_api_pending' | 'user_corrected'>;
  id?: string;
  userId?: string;
  createdAt?: string;
};

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function roundNutrient(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}

function scalePer100(value: number | null | undefined, servingGrams: number): number | null {
  const amount = finiteNumber(value);
  if (amount === null) return null;
  return roundNutrient(amount * (servingGrams / 100));
}

function energyKcal(nutriments: ScannedProductNutriments | null | undefined): number | null {
  return finiteNumber(nutriments?.['energy-kcal_100g']) ?? finiteNumber(nutriments?.energy_kcal_100g);
}

function sodiumMgPer100(nutriments: ScannedProductNutriments | null | undefined): number | null {
  const directMg = finiteNumber(nutriments?.sodium_mg_100g);
  if (directMg !== null) return directMg;

  const sodiumGrams = finiteNumber(nutriments?.sodium_100g);
  if (sodiumGrams !== null) return sodiumGrams * 1000;

  const saltGrams = finiteNumber(nutriments?.salt_100g);
  if (saltGrams !== null) return saltGrams * 1000 / 2.5;

  return null;
}

function sourceConfidence(product: ScannedProductInput, source: MealDataSource): DataConfidence {
  const n = product.nutriments;
  const hasEnergy = energyKcal(n) !== null;
  const hasMacro = finiteNumber(n?.proteins_100g) !== null || finiteNumber(n?.carbohydrates_100g) !== null || finiteNumber(n?.fat_100g) !== null;

  if (source === 'user_corrected' && hasEnergy && hasMacro) return 'high';
  if (hasEnergy && hasMacro) return 'medium';
  return 'low';
}

function addFlag(flags: FoodQualityFlag[], flag: FoodQualityFlag) {
  if (!flags.includes(flag)) flags.push(flag);
}

function addReason(reasons: NutritionReasonCode[], reason: NutritionReasonCode) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function qualityFlagsAndReasons(product: ScannedProductInput, servingGrams: number) {
  const flags: FoodQualityFlag[] = [];
  const reasons: NutritionReasonCode[] = [];
  const n = product.nutriments;
  const calories = scalePer100(energyKcal(n), servingGrams);
  const protein = scalePer100(n?.proteins_100g, servingGrams);
  const carbs = scalePer100(n?.carbohydrates_100g, servingGrams);
  const fiber = scalePer100(n?.fiber_100g, servingGrams);
  const sugar = scalePer100(n?.sugars_100g, servingGrams);
  const sodium = scalePer100(sodiumMgPer100(n), servingGrams);
  const processingLevel = finiteNumber(product.nova_group);

  if (processingLevel !== null && processingLevel >= 4) {
    addFlag(flags, 'ultra_processed_indicator');
    addReason(reasons, 'processing_level_high');
  }

  if ((product.additives_n ?? 0) >= 4) {
    addFlag(flags, 'ultra_processed_indicator');
    addReason(reasons, 'processing_level_high');
  }

  if ((sugar ?? 0) >= 15) {
    addFlag(flags, 'added_sugar');
    addReason(reasons, 'added_sugar_high');
  }

  if ((sodium ?? 0) >= 600) {
    addFlag(flags, 'high_sodium');
    addReason(reasons, 'sodium_high');
  }

  if ((calories ?? 0) >= 250 && (protein ?? 0) < 10) {
    addFlag(flags, 'protein_low');
    addReason(reasons, 'protein_low');
  }

  if ((carbs ?? 0) >= 25 && (fiber ?? 0) < 3) {
    addFlag(flags, 'low_fiber');
    addReason(reasons, 'fiber_low');
  }

  if (processingLevel !== null && processingLevel <= 2 && flags.length === 0) {
    addFlag(flags, 'whole_food_emphasis');
    addReason(reasons, 'whole_food_emphasis');
  }

  if ((protein ?? 0) >= 15 && (fiber ?? 0) >= 5 && flags.length === 0) {
    addFlag(flags, 'balanced_meal');
    addReason(reasons, 'balanced_meal');
  }

  return { flags, reasons };
}

function productName(product: ScannedProductInput): string {
  const name = product.product_name?.trim();
  if (name) return name;

  const brand = product.brands?.split(',')[0]?.trim();
  if (brand) return `${brand} product`;

  return 'Scanned product';
}

export function adaptScannedProductToMealLog(params: AdaptScannedProductParams): MealLog {
  const servingGrams = Math.max(1, params.servingGrams);
  const source = params.source ?? 'barcode_pending';
  const nutriments = params.product.nutriments;
  const caloriesPer100 = energyKcal(nutriments);
  const sodiumPer100 = sodiumMgPer100(nutriments);
  const quality = qualityFlagsAndReasons(params.product, servingGrams);
  const confidence = sourceConfidence(params.product, source);
  const reasonCodes = [...quality.reasons];

  if (confidence === 'low') addReason(reasonCodes, 'source_low_confidence');
  if (!nutriments || caloriesPer100 === null) addReason(reasonCodes, 'partial_nutrition_data');

  return {
    id: params.id,
    user_id: params.userId,
    logged_at: params.loggedAt,
    meal_type: params.mealType ?? 'unknown',
    name: productName(params.product),
    source,
    source_confidence: confidence,
    calories: scalePer100(caloriesPer100, servingGrams),
    protein_g: scalePer100(nutriments?.proteins_100g, servingGrams),
    carbs_g: scalePer100(nutriments?.carbohydrates_100g, servingGrams),
    fat_g: scalePer100(nutriments?.fat_100g, servingGrams),
    fiber_g: scalePer100(nutriments?.fiber_100g, servingGrams),
    sugar_g: scalePer100(nutriments?.sugars_100g, servingGrams),
    sodium_mg: scalePer100(sodiumPer100, servingGrams),
    ingredients: params.product.ingredients_text
      ? params.product.ingredients_text.split(',').map((ingredient) => ingredient.trim()).filter(Boolean)
      : null,
    quality_flags: quality.flags,
    user_response: null,
    corrected_by_user: source === 'user_corrected',
    confirmed_by_user: source === 'user_corrected',
    reason_codes: reasonCodes,
    created_at: params.createdAt ?? params.loggedAt
  };
}

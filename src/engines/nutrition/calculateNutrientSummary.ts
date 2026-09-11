import { localDay } from '../../utils/localDay';
import type {
  DataConfidence,
  MealLog,
  NutrientSummary,
  NutritionReasonCode,
  NutritionTargets
} from './types';

type NutrientKey = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg';

const nutrientKeys: NutrientKey[] = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'];

function dateKey(value: string): string {
  return localDay(value);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function addReason(reasons: Set<NutritionReasonCode>, reason: NutritionReasonCode) {
  reasons.add(reason);
}

function sumKnown(meals: MealLog[], key: NutrientKey, reasons: Set<NutritionReasonCode>): number | null {
  let sum = 0;
  let known = 0;

  for (const meal of meals) {
    const value = meal[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      sum += Math.max(0, value);
      known += 1;
    }
  }

  if (known === 0) {
    return null;
  }

  if (known < meals.length) {
    addReason(reasons, 'partial_nutrition_data');
  }

  return round(sum);
}

function progress(current: number | null, target: number | null | undefined): number | null {
  if (current === null || !target || target <= 0) {
    return null;
  }

  return round((current / target) * 100);
}

function confidenceFromMeals(meals: MealLog[], targets?: NutritionTargets | null): DataConfidence {
  if (meals.length === 0) {
    return 'low';
  }

  const lowSource = meals.some((meal) => meal.source_confidence === 'low' || meal.source === 'estimated_default');
  const knownNutrientCount = meals.reduce((total, meal) => {
    return total + nutrientKeys.filter((key) => typeof meal[key] === 'number').length;
  }, 0);

  if (lowSource || knownNutrientCount < meals.length * 2 || targets?.confidence === 'low') {
    return 'low';
  }

  const allHigh = meals.every((meal) => meal.source_confidence === 'high' || meal.corrected_by_user);

  if (allHigh && targets?.confidence === 'high' && knownNutrientCount >= meals.length * 5) {
    return 'high';
  }

  return 'medium';
}

export function calculateNutrientSummary(params: {
  date: string;
  meals: MealLog[];
  targets?: NutritionTargets | null;
}): NutrientSummary {
  const date = dateKey(params.date);
  const meals = params.meals.filter((meal) => dateKey(meal.logged_at) === date);
  const reasonCodes = new Set<NutritionReasonCode>();

  if (meals.length === 0) {
    addReason(reasonCodes, 'food_data_missing');
    addReason(reasonCodes, 'nutrition_calibrating');
  }

  for (const meal of meals) {
    if (meal.source === 'demo') addReason(reasonCodes, 'demo_food_data');
    if (meal.source === 'manual') addReason(reasonCodes, 'manual_food_log');
    if (meal.source === 'user_corrected' || meal.corrected_by_user) addReason(reasonCodes, 'user_corrected_food_log');
    if (meal.source_confidence === 'low') addReason(reasonCodes, 'source_low_confidence');
  }

  const calories = sumKnown(meals, 'calories', reasonCodes);
  const proteinG = sumKnown(meals, 'protein_g', reasonCodes);
  const carbsG = sumKnown(meals, 'carbs_g', reasonCodes);
  const fatG = sumKnown(meals, 'fat_g', reasonCodes);
  const fiberG = sumKnown(meals, 'fiber_g', reasonCodes);
  const sugarG = sumKnown(meals, 'sugar_g', reasonCodes);
  const sodiumMg = sumKnown(meals, 'sodium_mg', reasonCodes);

  if (meals.length > 0 && nutrientKeys.every((key) => meals.every((meal) => meal[key] === null || meal[key] === undefined))) {
    addReason(reasonCodes, 'food_data_missing');
    addReason(reasonCodes, 'nutrition_calibrating');
  }

  const targetProgress = {
    calories: progress(calories, params.targets?.calories_target),
    protein: progress(proteinG, params.targets?.protein_g_target),
    carbs: progress(carbsG, params.targets?.carbs_g_target),
    fat: progress(fatG, params.targets?.fat_g_target),
    fiber: progress(fiberG, params.targets?.fiber_g_target),
    sodium: progress(sodiumMg, params.targets?.sodium_mg_limit)
  };

  if (targetProgress.protein !== null) {
    if (targetProgress.protein < 70) addReason(reasonCodes, 'protein_low');
    if (targetProgress.protein >= 90) addReason(reasonCodes, 'protein_supportive');
  } else if (proteinG === null && meals.length > 0) {
    addReason(reasonCodes, 'partial_nutrition_data');
  }

  if (targetProgress.fiber !== null) {
    if (targetProgress.fiber < 50) addReason(reasonCodes, 'fiber_low');
    if (targetProgress.fiber >= 80) addReason(reasonCodes, 'fiber_supportive');
  }

  if (targetProgress.calories !== null && targetProgress.calories < 70) {
    addReason(reasonCodes, 'under_fueled');
  }

  if (targetProgress.calories !== null && targetProgress.calories > 125) {
    addReason(reasonCodes, 'over_fueled');
  }

  if (targetProgress.sodium !== null && targetProgress.sodium > 100) {
    addReason(reasonCodes, 'sodium_high');
  }

  return {
    date,
    meal_count: meals.length,
    calories,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
    fiber_g: fiberG,
    sugar_g: sugarG,
    sodium_mg: sodiumMg,
    targets: params.targets ?? null,
    target_progress: targetProgress,
    confidence: confidenceFromMeals(meals, params.targets),
    reason_codes: [...reasonCodes]
  };
}

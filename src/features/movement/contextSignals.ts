import type { CircadianBriefing } from '../../engines/circadian';
import {
  calculateFoodQuality,
  calculateFoodResponse,
  calculateNutrientSummary,
  generateNutritionReadinessSignal,
  type MealLog,
  type NutritionTargets
} from '../../engines/nutrition';
import type { MealLogRow } from '../nutrition/persistence';

/**
 * Shared derivations that let the Move signal be shaped by sleep and diet as well
 * as training. Kept pure so the movement tab only has to load the data.
 */

export type MoveSleepSignal = 'supportive' | 'limited' | 'unknown';
export type MoveNutritionSignal = 'supportive' | 'watch' | 'unknown';

// Baseline targets when a user-specific nutrition target is unavailable (mirrors the Diet tab).
export const defaultMoveNutritionTargets: NutritionTargets = {
  calories_target: 2300,
  protein_g_target: 160,
  carbs_g_target: 240,
  fat_g_target: 80,
  fiber_g_target: 30,
  sodium_mg_limit: 2300,
  confidence: 'low',
  basis: ['default']
};

export function mealLogRowToMealLog(row: MealLogRow): MealLog {
  return {
    id: row.id,
    user_id: row.user_id,
    logged_at: row.logged_at,
    meal_type: row.meal_type,
    name: row.name,
    source: row.source,
    source_confidence: row.source_confidence,
    calories: row.calories,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    fiber_g: row.fiber_g,
    sugar_g: row.sugar_g,
    sodium_mg: row.sodium_mg,
    micronutrients: row.micronutrients ?? null,
    ingredients: row.ingredients,
    quality_flags: row.quality_flags,
    user_response: row.user_response,
    corrected_by_user: row.corrected_by_user,
    confirmed_by_user: row.confirmed_by_user,
    reason_codes: row.reason_codes,
    created_at: row.created_at
  };
}

/** Sleep influence on today's movement readiness, from the circadian briefing. */
export function deriveSleepMoveSignal(briefing: CircadianBriefing): { signal: MoveSleepSignal; summary: string } {
  if (!briefing.wake_time || briefing.confidence === 'low') {
    return { signal: 'unknown', summary: 'Sleep is still calibrating for today.' };
  }

  const avgDebt = briefing.sleep_debt_7_day.nightly_average_debt_minutes;
  if (avgDebt !== null && avgDebt >= 60) {
    return { signal: 'limited', summary: 'Recent sleep debt suggests keeping today lighter.' };
  }

  if (avgDebt !== null && avgDebt <= 30) {
    return { signal: 'supportive', summary: 'Recent sleep looks supportive of a fuller session.' };
  }

  return { signal: 'unknown', summary: 'Sleep looks steady today.' };
}

/** Diet influence on today's movement readiness, from logged meals. */
export function deriveNutritionMoveSignal(
  date: string,
  meals: MealLog[],
  targets: NutritionTargets = defaultMoveNutritionTargets
): { signal: MoveNutritionSignal; summary: string } {
  const nutrientSummary = calculateNutrientSummary({ date, meals, targets });
  const foodQuality = calculateFoodQuality({ date, meals, nutrientSummary });
  const foodResponse = calculateFoodResponse({ date, meals });
  const readiness = generateNutritionReadinessSignal({ date, nutrientSummary, foodQuality, foodResponse });

  const signal: MoveNutritionSignal =
    readiness.label === 'supportive' ? 'supportive' : readiness.label === 'watch' ? 'watch' : 'unknown';
  return { signal, summary: readiness.summary };
}

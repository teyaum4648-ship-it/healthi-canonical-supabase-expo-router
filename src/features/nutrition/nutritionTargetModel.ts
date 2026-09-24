import type { NutritionTargets } from '../../engines/nutrition';
import { unsetNutritionTargets } from './nutritionGoalEngine';
import type { NutritionTargetRow } from './persistence';

/**
 * A saved target row as the engines want it.
 *
 * A row whose basis is entirely 'default' carries the app's own placeholder rather than
 * anything the person set, so it reads as no target at all: a generic number would be
 * scored against as if it were theirs.
 */
export function targetRowToTarget(row: NutritionTargetRow | null): NutritionTargets {
  if (!row || row.basis.every((basis) => basis === 'default')) return unsetNutritionTargets;
  return {
    calories_target: row.calories_target,
    protein_g_target: row.protein_g_target,
    carbs_g_target: row.carbs_g_target,
    fat_g_target: row.fat_g_target,
    fiber_g_target: row.fiber_g_target,
    sodium_mg_limit: row.sodium_mg_limit,
    confidence: row.confidence,
    basis: row.basis
  };
}

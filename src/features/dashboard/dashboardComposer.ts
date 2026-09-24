import type { CircadianBriefing, DataConfidence, SleepSession, TimeWindow } from '../../engines/circadian';
import {
  calculateFoodQuality,
  calculateFoodResponse,
  calculateNutrientSummary,
  generateNutritionReadinessSignal,
  type MealLog,
  type NutritionReasonCode,
  type NutritionTargets
} from '../../engines/nutrition';

import { calculateNourishmentScore } from '../../engines/nutrition/calculateNourishmentScore';
export type DashboardNutritionSummary = {
  meal_count: number;
  calorie_label: string;
  protein_label: string;
  food_quality_label: string;
  food_response_label: string;
  readiness_support_label: string;
  confidence: DataConfidence;
  source_label: 'logged' | 'demo' | 'calibrating';
  next_action: string;
  reason_codes: string[];
  readiness_adjustment: number;
  /** The nourishment pillar, 0-100, or null when there is nothing to read. */
  nourishment_score: number | null;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return 'Calibrating';
  const sign = minutes < 0 ? '-' : '';
  const absolute = Math.abs(minutes);
  return `${sign}${Math.floor(absolute / 60)}h ${absolute % 60}m`;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return 'Calibrating';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Calibrating';
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatWindow(window: TimeWindow | undefined): string {
  if (!window) return 'Calibrating';
  return `${formatTime(window.start_at)} - ${formatTime(window.end_at)}`;
}

function phaseLabel(label: string | null | undefined): string {
  const labels: Record<string, string> = {
    wake_grogginess: 'Wake ramp',
    rising: 'Rising',
    morning_peak: 'Morning peak',
    afternoon_dip: 'Recovery dip',
    second_peak: 'Second peak',
    wind_down: 'Wind-down',
    sleep_window: 'Sleep window',
    unknown: 'Calibrating'
  };
  return labels[label ?? 'unknown'] ?? 'Calibrating';
}

function confidenceFromSignals(hasCircadian: boolean, hasSleep: boolean, sourceConfidence?: DataConfidence): DataConfidence {
  if (!hasCircadian || !hasSleep) return 'low';
  if (sourceConfidence === 'high') return 'high';
  return 'medium';
}

function formatNutritionAmount(value: number | null | undefined, suffix = ''): string {
  if (typeof value !== 'number') return 'Calibrating';
  return `${Math.round(value)}${suffix}`;
}

function formatNutritionTarget(value: number | null | undefined, suffix = ''): string | null {
  if (typeof value !== 'number' || value <= 0) return null;
  return `${Math.round(value)}${suffix}`;
}

function sentenceLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueReasons(reasons: Array<string | NutritionReasonCode>): string[] {
  return [...new Set(reasons)];
}

export function composeDashboardNutritionSummary(params: {
  date: string;
  meals?: MealLog[];
  targets?: NutritionTargets | null;
  demoMode?: boolean;
}): DashboardNutritionSummary {
  const meals = params.meals ?? [];
  const nutrientSummary = calculateNutrientSummary({
    date: params.date,
    meals,
    targets: params.targets ?? null
  });
  const foodQuality = calculateFoodQuality({
    date: params.date,
    meals,
    nutrientSummary
  });
  const foodResponse = calculateFoodResponse({
    date: params.date,
    meals
  });
  const nourishment = calculateNourishmentScore({
    date: params.date,
    nutrientSummary,
    foodQuality,
    foodResponse,
    targets: params.targets
  });
  const readinessSignal = generateNutritionReadinessSignal({
    date: params.date,
    nutrientSummary,
    foodQuality,
    foodResponse
  });
  const hasMeals = nutrientSummary.meal_count > 0;
  const calorieTarget = formatNutritionTarget(params.targets?.calories_target);
  const proteinTarget = formatNutritionTarget(params.targets?.protein_g_target, 'g');
  const calorieCurrent = formatNutritionAmount(nutrientSummary.calories);
  const proteinCurrent = formatNutritionAmount(nutrientSummary.protein_g, 'g');

  if (!hasMeals) {
    return {
      meal_count: 0,
      calorie_label: 'Calibrating',
      protein_label: 'Calibrating',
      food_quality_label: 'Calibrating',
      food_response_label: 'Calibrating',
      readiness_support_label: 'Fueling is still calibrating.',
      confidence: 'low',
      source_label: params.demoMode ? 'demo' : 'calibrating',
      next_action: 'Log a meal to improve today’s fueling signal.',
      reason_codes: uniqueReasons([
        ...nutrientSummary.reason_codes,
        ...foodQuality.reason_codes,
        ...foodResponse.reason_codes,
        ...readinessSignal.reason_codes
      ]),
      readiness_adjustment: 0,
      nourishment_score: null
    };
  }

  return {
    meal_count: nutrientSummary.meal_count,
    calorie_label: calorieTarget ? `${calorieCurrent} / ${calorieTarget}` : calorieCurrent,
    protein_label: proteinTarget ? `${proteinCurrent} / ${proteinTarget}` : proteinCurrent,
    food_quality_label: sentenceLabel(foodQuality.label),
    food_response_label: sentenceLabel(foodResponse.label),
    readiness_support_label: readinessSignal.summary,
    confidence: readinessSignal.confidence,
    source_label: params.demoMode || meals.some((meal) => meal.source === 'demo') ? 'demo' : 'logged',
    next_action:
      foodResponse.label === 'unknown'
        ? 'Rate how you felt after eating.'
        : readinessSignal.label === 'watch'
          ? 'Keep the next meal simple and steady.'
          : 'Based on logged meals.',
    reason_codes: uniqueReasons([
      ...nutrientSummary.reason_codes,
      ...foodQuality.reason_codes,
      ...foodResponse.reason_codes,
      ...readinessSignal.reason_codes
    ]),
    readiness_adjustment: hasMeals ? readinessSignal.score_adjustment : 0,
    nourishment_score: nourishment.score
  };
}

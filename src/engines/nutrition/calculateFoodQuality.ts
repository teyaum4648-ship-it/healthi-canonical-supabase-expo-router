import { localDay } from '../../utils/localDay';
import type {
  FoodQualityFlag,
  FoodQualitySummary,
  MealLog,
  NutrientSummary,
  NutritionReasonCode
} from './types';

const supportiveFlags: FoodQualityFlag[] = ['whole_food_emphasis', 'balanced_meal', 'timing_supportive'];
const watchFlags: FoodQualityFlag[] = [
  'added_sugar',
  'high_sodium',
  'low_fiber',
  'protein_low',
  'ultra_processed_indicator',
  'late_heavy_meal'
];

function dateKey(value: string): string {
  return localDay(value);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addReason(reasons: Set<NutritionReasonCode>, reason: NutritionReasonCode) {
  reasons.add(reason);
}

function labelForScore(score: number, watchCount: number): FoodQualitySummary['label'] {
  if (watchCount >= 2 || score < 55) return 'watch';
  if (score >= 78) return 'supportive';
  return 'steady';
}

export function calculateFoodQuality(params: {
  date: string;
  meals: MealLog[];
  nutrientSummary?: NutrientSummary | null;
}): FoodQualitySummary {
  const date = dateKey(params.date);
  const meals = params.meals.filter((meal) => dateKey(meal.logged_at) === date);
  const flags = new Set<FoodQualityFlag>();
  const reasonCodes = new Set<NutritionReasonCode>();

  if (meals.length === 0) {
    addReason(reasonCodes, 'food_data_missing');
    addReason(reasonCodes, 'nutrition_calibrating');
    return {
      date,
      score: null,
      label: 'unknown',
      flags: [],
      confidence: 'low',
      reason_codes: [...reasonCodes]
    };
  }

  for (const meal of meals) {
    for (const flag of meal.quality_flags) {
      flags.add(flag);
    }

    if (meal.source_confidence === 'low') {
      addReason(reasonCodes, 'source_low_confidence');
    }
  }

  let score = 55;
  let watchCount = 0;

  for (const flag of flags) {
    if (supportiveFlags.includes(flag)) {
      score += flag === 'timing_supportive' ? 6 : 9;
    }

    if (watchFlags.includes(flag)) {
      score -= flag === 'ultra_processed_indicator' ? 11 : 8;
      watchCount += 1;
    }
  }

  if (flags.has('whole_food_emphasis')) addReason(reasonCodes, 'whole_food_emphasis');
  if (flags.has('balanced_meal')) addReason(reasonCodes, 'balanced_meal');
  if (flags.has('timing_supportive')) addReason(reasonCodes, 'meal_timing_supportive');
  if (flags.has('added_sugar')) addReason(reasonCodes, 'added_sugar_high');
  if (flags.has('high_sodium')) addReason(reasonCodes, 'sodium_high');
  if (flags.has('low_fiber')) addReason(reasonCodes, 'fiber_low');
  if (flags.has('protein_low')) addReason(reasonCodes, 'protein_low');
  if (flags.has('ultra_processed_indicator')) addReason(reasonCodes, 'processing_level_high');
  if (flags.has('late_heavy_meal')) addReason(reasonCodes, 'meal_timing_late');

  const summaryReasons = params.nutrientSummary?.reason_codes ?? [];

  if (summaryReasons.includes('protein_supportive')) {
    score += 8;
    addReason(reasonCodes, 'protein_supportive');
  }

  if (summaryReasons.includes('fiber_supportive')) {
    score += 7;
    addReason(reasonCodes, 'fiber_supportive');
  }

  if (summaryReasons.includes('protein_low')) {
    score -= 6;
    addReason(reasonCodes, 'protein_low');
    watchCount += 1;
  }

  if (summaryReasons.includes('fiber_low')) {
    score -= 6;
    addReason(reasonCodes, 'fiber_low');
    watchCount += 1;
  }

  if (summaryReasons.includes('sodium_high')) {
    score -= 6;
    addReason(reasonCodes, 'sodium_high');
    watchCount += 1;
  }

  if (summaryReasons.includes('food_data_missing') || summaryReasons.includes('partial_nutrition_data')) {
    addReason(reasonCodes, 'partial_nutrition_data');
  }

  const finalScore = clampScore(score);
  const label = labelForScore(finalScore, watchCount);

  if (label === 'supportive') {
    addReason(reasonCodes, 'food_quality_supportive');
  }

  const confidence =
    params.nutrientSummary?.confidence === 'low' ||
    meals.some((meal) => meal.source_confidence === 'low') ||
    reasonCodes.has('partial_nutrition_data')
      ? 'low'
      : 'medium';

  return {
    date,
    score: finalScore,
    label,
    flags: [...flags],
    confidence,
    reason_codes: [...reasonCodes]
  };
}

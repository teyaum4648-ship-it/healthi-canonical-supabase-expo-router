import type {
  DataConfidence,
  FoodQualitySummary,
  FoodResponseSummary,
  NutrientSummary,
  NutritionReadinessSignal,
  NutritionReasonCode
} from './types';

function addReason(reasons: Set<NutritionReasonCode>, reason: NutritionReasonCode) {
  reasons.add(reason);
}

function clampAdjustment(value: number): number {
  return Math.max(-8, Math.min(5, Math.round(value)));
}

function lowestConfidence(values: DataConfidence[]): DataConfidence {
  if (values.includes('low')) return 'low';
  if (values.includes('medium')) return 'medium';
  return 'high';
}

function summaryFor(label: NutritionReadinessSignal['label'], reasons: Set<NutritionReasonCode>): string {
  if (reasons.has('food_data_missing') || reasons.has('nutrition_calibrating')) {
    return 'Fueling is still calibrating based on logged meals.';
  }

  if (reasons.has('protein_low')) {
    return 'Protein is behind target, so fueling readiness is lower.';
  }

  if (reasons.has('digestion_discomfort_reported') || reasons.has('energy_dip_reported')) {
    return 'Food response suggests a steadier next meal may help today.';
  }

  if (label === 'supportive') {
    return "Logged meals are supporting today's readiness.";
  }

  if (label === 'watch') {
    return 'Nutrition signals suggest keeping the next meal simple and steady.';
  }

  return 'Food response looks steady today.';
}

export function generateNutritionReadinessSignal(params: {
  date: string;
  nutrientSummary: NutrientSummary;
  foodQuality: FoodQualitySummary;
  foodResponse: FoodResponseSummary;
}): NutritionReadinessSignal {
  const date = params.date.slice(0, 10);
  const reasonCodes = new Set<NutritionReasonCode>();
  let adjustment = 0;

  for (const reason of params.nutrientSummary.reason_codes) addReason(reasonCodes, reason);
  for (const reason of params.foodQuality.reason_codes) addReason(reasonCodes, reason);
  for (const reason of params.foodResponse.reason_codes) addReason(reasonCodes, reason);

  if (params.nutrientSummary.meal_count === 0) {
    addReason(reasonCodes, 'food_data_missing');
    addReason(reasonCodes, 'nutrition_calibrating');
  }

  if (reasonCodes.has('protein_supportive')) adjustment += 2;
  if (reasonCodes.has('fiber_supportive')) adjustment += 1;
  if (params.foodQuality.label === 'supportive') adjustment += 1;
  if (params.foodResponse.label === 'steady') adjustment += 1;

  if (reasonCodes.has('protein_low')) adjustment -= 2;
  if (reasonCodes.has('fiber_low')) adjustment -= 1;
  if (reasonCodes.has('under_fueled')) adjustment -= 2;
  if (reasonCodes.has('sodium_high')) adjustment -= 1;
  if (reasonCodes.has('digestion_discomfort_reported')) adjustment -= 2;
  if (reasonCodes.has('energy_dip_reported')) adjustment -= 2;
  if (reasonCodes.has('appetite_unstable_reported')) adjustment -= 1;
  if (reasonCodes.has('meal_timing_late')) adjustment -= 1;

  if (reasonCodes.has('food_data_missing') || reasonCodes.has('nutrition_calibrating')) {
    adjustment = Math.min(adjustment, 0);
    adjustment = Math.max(adjustment, -1);
  }

  const scoreAdjustment = clampAdjustment(adjustment);
  let label: NutritionReadinessSignal['label'] = 'neutral';

  if (reasonCodes.has('food_data_missing') || reasonCodes.has('nutrition_calibrating')) {
    label = 'unknown';
  } else if (scoreAdjustment >= 3) {
    label = 'supportive';
    addReason(reasonCodes, 'nutrition_signal_supportive');
  } else if (scoreAdjustment <= -3) {
    label = 'watch';
    addReason(reasonCodes, 'nutrition_signal_watch');
  }

  const confidence = lowestConfidence([
    params.nutrientSummary.confidence,
    params.foodQuality.confidence,
    params.foodResponse.confidence
  ]);

  return {
    date,
    score_adjustment: scoreAdjustment,
    label,
    summary: summaryFor(label, reasonCodes),
    confidence,
    reason_codes: [...reasonCodes]
  };
}

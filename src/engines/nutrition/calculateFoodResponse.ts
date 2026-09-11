import type { FoodResponseSummary, MealLog, NutritionReasonCode } from './types';
import { localDay } from '../../utils/localDay';

function dateKey(value: string): string {
  return localDay(value);
}

function addReason(reasons: Set<NutritionReasonCode>, reason: NutritionReasonCode) {
  reasons.add(reason);
}

function majoritySignal(supportive: number, watch: number, neutral: number): 'supportive' | 'neutral' | 'watch' | 'unknown' {
  if (supportive + watch + neutral === 0) return 'unknown';
  if (watch > 0 && watch >= supportive) return 'watch';
  if (supportive > watch && supportive >= neutral) return 'supportive';
  return 'neutral';
}

export function calculateFoodResponse(params: {
  date: string;
  meals: MealLog[];
}): FoodResponseSummary {
  const date = dateKey(params.date);
  const meals = params.meals.filter((meal) => dateKey(meal.logged_at) === date);
  const reasonCodes = new Set<NutritionReasonCode>();

  let digestionSupportive = 0;
  let digestionNeutral = 0;
  let digestionWatch = 0;
  let energySupportive = 0;
  let energyNeutral = 0;
  let energyWatch = 0;
  let appetiteSupportive = 0;
  let appetiteNeutral = 0;
  let appetiteWatch = 0;
  let responseCount = 0;

  for (const meal of meals) {
    const response = meal.user_response;
    if (!response) continue;

    const hasResponse = Boolean(response.digestion || response.energy || response.appetite || response.cravings);
    if (hasResponse) responseCount += 1;

    if (response.digestion === 'good') digestionSupportive += 1;
    if (response.digestion === 'neutral' || response.digestion === 'not_sure') digestionNeutral += 1;
    if (response.digestion === 'heavy' || response.digestion === 'uncomfortable') {
      digestionWatch += 1;
      addReason(reasonCodes, 'digestion_discomfort_reported');
    }

    if (response.energy === 'better' || response.energy === 'steady') energySupportive += 1;
    if (response.energy === 'not_sure') energyNeutral += 1;
    if (response.energy === 'dip') {
      energyWatch += 1;
      addReason(reasonCodes, 'energy_dip_reported');
    }

    if (response.appetite === 'stable') appetiteSupportive += 1;
    if (response.appetite === 'not_sure') appetiteNeutral += 1;
    if (response.appetite === 'hungry_soon' || response.appetite === 'overfull') {
      appetiteWatch += 1;
      addReason(reasonCodes, 'appetite_unstable_reported');
    }

    if (response.cravings === 'mild' || response.cravings === 'strong') {
      addReason(reasonCodes, 'cravings_reported');
    }
  }

  if (responseCount === 0) {
    addReason(reasonCodes, 'food_response_missing');
    addReason(reasonCodes, 'nutrition_calibrating');
    return {
      date,
      label: 'unknown',
      digestion_signal: 'unknown',
      energy_signal: 'unknown',
      appetite_signal: 'unknown',
      confidence: 'low',
      reason_codes: [...reasonCodes]
    };
  }

  const digestionSignal = majoritySignal(digestionSupportive, digestionWatch, digestionNeutral);
  const energySignal = majoritySignal(energySupportive, energyWatch, energyNeutral);
  const appetiteSignal = majoritySignal(appetiteSupportive, appetiteWatch, appetiteNeutral);
  const watchSignals = [digestionSignal, energySignal, appetiteSignal].filter((signal) => signal === 'watch').length;
  const supportiveSignals = [digestionSignal, energySignal, appetiteSignal].filter((signal) => signal === 'supportive').length;
  const label: FoodResponseSummary['label'] = watchSignals >= 2 ? 'watch' : watchSignals === 1 ? 'mixed' : 'steady';

  if (label === 'steady' && supportiveSignals > 0) {
    addReason(reasonCodes, 'food_response_steady');
  }

  const confidence = responseCount < meals.length || meals.some((meal) => meal.source_confidence === 'low') ? 'low' : 'medium';

  return {
    date,
    label,
    digestion_signal: digestionSignal,
    energy_signal: energySignal,
    appetite_signal: appetiteSignal,
    confidence,
    reason_codes: [...reasonCodes]
  };
}

import type { DataConfidence, NutritionReasonCode } from '../../../engines/nutrition';
import type { HealthiProductSnapshot, ProductQualitySnapshot } from './productLookupTypes';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function lowerConfidence(confidence: DataConfidence): DataConfidence {
  if (confidence === 'high') return 'medium';
  return confidence === 'medium' ? 'low' : 'low';
}

function uniqueReasons(reasons: NutritionReasonCode[]): NutritionReasonCode[] {
  return [...new Set(reasons)];
}

export function calculateProductQuality(snapshot: HealthiProductSnapshot): ProductQualitySnapshot {
  const knownNutrients = [
    snapshot.calories_per_serving,
    snapshot.protein_g,
    snapshot.carbs_g,
    snapshot.fat_g,
    snapshot.fiber_g,
    snapshot.sugar_g,
    snapshot.sodium_mg
  ].filter((value) => typeof value === 'number').length;

  if (knownNutrients < 2) {
    return {
      score: null,
      label: 'calibrating',
      summary: 'Label data is limited, so the food quality signal is still calibrating.',
      positives: [],
      considerations: ['Add the available nutrition facts manually for a clearer signal.'],
      confidence: 'low',
      reason_codes: uniqueReasons([...snapshot.reason_codes, 'partial_nutrition_data', 'nutrition_calibrating'])
    };
  }

  let score = 60;
  const positives: string[] = [];
  const considerations: string[] = [];
  const reasons = [...snapshot.reason_codes];

  if ((snapshot.protein_g ?? 0) >= 15) {
    score += 10;
    positives.push('Protein is supportive for this serving.');
  } else if ((snapshot.calories_per_serving ?? 0) >= 200 && (snapshot.protein_g ?? 0) < 6) {
    score -= 6;
    considerations.push('Protein is modest for this serving.');
  }

  if ((snapshot.fiber_g ?? 0) >= 5) {
    score += 12;
    positives.push('Higher fiber supports a steadier fueling signal.');
  } else if ((snapshot.fiber_g ?? 0) >= 3) {
    score += 6;
    positives.push('This serving provides a useful fiber signal.');
  } else if ((snapshot.carbs_g ?? 0) >= 20) {
    score -= 5;
    considerations.push('Fiber is modest relative to the carbohydrate amount.');
  }

  if ((snapshot.sugar_g ?? 0) >= 20) {
    score -= 15;
    considerations.push('Sugar is higher for one serving.');
  } else if ((snapshot.sugar_g ?? 0) >= 10) {
    score -= 8;
    considerations.push('Sugar is worth considering alongside the rest of your day.');
  }

  if ((snapshot.sodium_mg ?? 0) >= 700) {
    score -= 14;
    considerations.push('Sodium is higher than typical for one serving.');
  } else if ((snapshot.sodium_mg ?? 0) >= 400) {
    score -= 7;
    considerations.push('Sodium is moderate for this serving.');
  }

  if ((snapshot.saturated_fat_g ?? 0) >= 7) {
    score -= 6;
    considerations.push('Saturated fat is higher for one serving.');
  }

  if (snapshot.quality_flags.includes('ultra_processed_indicator')) {
    score -= 12;
    considerations.push('The ingredient pattern suggests more processing.');
  }
  if (snapshot.quality_flags.includes('whole_food_emphasis')) score += 8;
  if (snapshot.quality_flags.includes('balanced_meal')) score += 6;

  let confidence = snapshot.confidence;
  if (!snapshot.ingredients_text) {
    confidence = lowerConfidence(confidence);
    considerations.push('Ingredient data is incomplete, so confidence is lower.');
  }

  const finalScore = clampScore(score);
  const label = finalScore >= 74 ? 'supportive' : finalScore >= 52 ? 'steady' : 'watch';
  const summary = label === 'supportive'
    ? 'Available label data suggests a supportive fueling fit.'
    : label === 'steady'
      ? 'Available label data suggests a steady fit with a few context signals.'
      : 'Available label data suggests a few signals worth balancing across the day.';

  return {
    score: finalScore,
    label,
    summary,
    positives,
    considerations,
    confidence,
    reason_codes: uniqueReasons(reasons)
  };
}

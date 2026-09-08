import type {
  FoodPatternAnswers,
  FoodPatternProfile,
  FoodPatternQuestionId,
  FoodPatternReasonCode,
  FoodPatternScoredLabel,
  FoodPatternScores
} from './foodPatternTypes';

type AnswerDefinition = {
  scores?: Partial<FoodPatternScores>;
  reasons: FoodPatternReasonCode[];
  confidence: number;
};

const QUESTION_IDS: FoodPatternQuestionId[] = [
  'protein_meal_energy',
  'carb_meal_energy',
  'hunger_frequency',
  'cravings_pattern',
  'large_meal_digestion',
  'higher_fat_meal_response',
  'breakfast_skip_response',
  'afternoon_energy',
  'late_dinner_response',
  'heavy_dinner_sleep',
  'training_fuel_need',
  'appetite_stability',
  'meal_size_preference',
  'caffeine_food_sensitivity',
  'stress_life_load_eating',
  'morning_fueling_pattern'
];

const SCORE_LABELS: FoodPatternScoredLabel[] = [
  'steady_balanced',
  'protein_forward',
  'carb_supported',
  'lighter_frequent',
  'evening_sensitive'
];

const ANSWER_DEFINITIONS: Record<FoodPatternQuestionId, Record<string, AnswerDefinition>> = {
  protein_meal_energy: {
    steady: { scores: { protein_forward: 3, steady_balanced: 1 }, reasons: ['protein_forward_signal'], confidence: 1 },
    heavy: { scores: { lighter_frequent: 2 }, reasons: ['large_meal_heaviness', 'digestion_sensitivity'], confidence: 1 },
    neutral: { scores: { steady_balanced: 1 }, reasons: ['steady_balanced_signal'], confidence: 0 },
    not_sure: { reasons: ['food_pattern_calibrating'], confidence: -1 }
  },
  carb_meal_energy: {
    steady: { scores: { carb_supported: 3, steady_balanced: 1 }, reasons: ['carb_supported_signal'], confidence: 1 },
    dip: { scores: { protein_forward: 2, lighter_frequent: 1 }, reasons: ['afternoon_energy_dip', 'appetite_instability'], confidence: 1 },
    depends: { scores: { steady_balanced: 1 }, reasons: ['food_pattern_inconsistent'], confidence: 0 },
    not_sure: { reasons: ['food_pattern_calibrating'], confidence: -1 }
  },
  hunger_frequency: {
    under_2_hours: { scores: { lighter_frequent: 3, protein_forward: 1 }, reasons: ['lighter_frequent_signal', 'appetite_instability'], confidence: 1 },
    three_to_four_hours: { scores: { steady_balanced: 3 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    five_plus_hours: { scores: { steady_balanced: 1, protein_forward: 1 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    varies: { scores: { lighter_frequent: 1 }, reasons: ['food_pattern_inconsistent'], confidence: 0 }
  },
  cravings_pattern: {
    afternoon: { scores: { lighter_frequent: 2, protein_forward: 1 }, reasons: ['afternoon_energy_dip', 'appetite_instability'], confidence: 1 },
    evening: { scores: { evening_sensitive: 2, lighter_frequent: 1 }, reasons: ['evening_sensitive_signal', 'appetite_instability'], confidence: 1 },
    after_sweets: { scores: { protein_forward: 2 }, reasons: ['appetite_instability'], confidence: 1 },
    rare: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 }
  },
  large_meal_digestion: {
    fine: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    heavy: { scores: { lighter_frequent: 3, evening_sensitive: 1 }, reasons: ['large_meal_heaviness', 'digestion_sensitivity'], confidence: 1 },
    sleepy: { scores: { lighter_frequent: 2, protein_forward: 1 }, reasons: ['large_meal_heaviness', 'afternoon_energy_dip'], confidence: 1 },
    not_sure: { reasons: ['food_pattern_calibrating'], confidence: -1 }
  },
  higher_fat_meal_response: {
    satisfied: { scores: { protein_forward: 2, steady_balanced: 1 }, reasons: ['protein_forward_signal'], confidence: 1 },
    heavy: { scores: { lighter_frequent: 2, evening_sensitive: 1 }, reasons: ['digestion_sensitivity', 'large_meal_heaviness'], confidence: 1 },
    neutral: { scores: { steady_balanced: 1 }, reasons: ['steady_balanced_signal'], confidence: 0 },
    depends_on_timing: { scores: { evening_sensitive: 3 }, reasons: ['evening_sensitive_signal', 'late_meal_sensitivity'], confidence: 1 }
  },
  breakfast_skip_response: {
    fine: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    crash: { scores: { protein_forward: 2, lighter_frequent: 2 }, reasons: ['breakfast_helpful', 'appetite_instability'], confidence: 1 },
    overeat_later: { scores: { lighter_frequent: 2, evening_sensitive: 1 }, reasons: ['breakfast_helpful', 'appetite_instability'], confidence: 1 },
    not_applicable: { scores: { steady_balanced: 1 }, reasons: ['breakfast_helpful'], confidence: 0 }
  },
  afternoon_energy: {
    steady: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    dip: { scores: { lighter_frequent: 2, protein_forward: 1 }, reasons: ['afternoon_energy_dip'], confidence: 1 },
    depends_lunch: { scores: { protein_forward: 1, carb_supported: 1, lighter_frequent: 1 }, reasons: ['food_pattern_inconsistent'], confidence: 0 },
    training_days_only: { scores: { carb_supported: 2 }, reasons: ['training_fuel_needed'], confidence: 1 }
  },
  late_dinner_response: {
    fine: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    restless: { scores: { evening_sensitive: 3 }, reasons: ['late_meal_sensitivity', 'evening_sensitive_signal'], confidence: 1 },
    heavy: { scores: { evening_sensitive: 3, lighter_frequent: 1 }, reasons: ['late_meal_sensitivity', 'large_meal_heaviness'], confidence: 1 },
    not_sure: { reasons: ['food_pattern_calibrating'], confidence: -1 }
  },
  heavy_dinner_sleep: {
    unchanged: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    worse_sleep: { scores: { evening_sensitive: 3 }, reasons: ['late_meal_sensitivity', 'evening_sensitive_signal'], confidence: 1 },
    slow_morning: { scores: { evening_sensitive: 2, lighter_frequent: 1 }, reasons: ['late_meal_sensitivity'], confidence: 1 },
    not_sure: { reasons: ['food_pattern_calibrating'], confidence: -1 }
  },
  training_fuel_need: {
    extra_carbs: { scores: { carb_supported: 3 }, reasons: ['carb_supported_signal', 'training_fuel_needed'], confidence: 1 },
    extra_protein: { scores: { protein_forward: 3 }, reasons: ['protein_forward_signal', 'training_fuel_needed'], confidence: 1 },
    normal_meals: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    not_active: { reasons: ['food_pattern_calibrating'], confidence: 0 }
  },
  appetite_stability: {
    predictable: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    swings: { scores: { lighter_frequent: 2, protein_forward: 1 }, reasons: ['appetite_instability'], confidence: 1 },
    low_then_high: { scores: { evening_sensitive: 2, lighter_frequent: 1 }, reasons: ['evening_sensitive_signal', 'appetite_instability'], confidence: 1 },
    not_sure: { reasons: ['food_pattern_calibrating'], confidence: -1 }
  },
  meal_size_preference: {
    three_balanced: { scores: { steady_balanced: 3 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    smaller_more_often: { scores: { lighter_frequent: 3 }, reasons: ['lighter_frequent_signal'], confidence: 1 },
    larger_fewer: { scores: { protein_forward: 1, steady_balanced: 1 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    changes_daily: { scores: { steady_balanced: 1 }, reasons: ['food_pattern_inconsistent'], confidence: 0 }
  },
  caffeine_food_sensitivity: {
    fine: { scores: { steady_balanced: 1 }, reasons: ['steady_balanced_signal'], confidence: 0 },
    wired_or_crash: { scores: { protein_forward: 1, lighter_frequent: 2 }, reasons: ['appetite_instability', 'breakfast_helpful'], confidence: 1 },
    need_food_first: { scores: { protein_forward: 2, lighter_frequent: 1 }, reasons: ['breakfast_helpful'], confidence: 1 },
    rare_caffeine: { reasons: ['food_pattern_calibrating'], confidence: 0 }
  },
  stress_life_load_eating: {
    steady: { scores: { steady_balanced: 2 }, reasons: ['steady_balanced_signal'], confidence: 1 },
    forget_food: { scores: { lighter_frequent: 2, protein_forward: 1 }, reasons: ['appetite_instability', 'breakfast_helpful'], confidence: 1 },
    snack_more: { scores: { lighter_frequent: 2 }, reasons: ['lighter_frequent_signal', 'appetite_instability'], confidence: 1 },
    dinner_heavier: { scores: { evening_sensitive: 2 }, reasons: ['evening_sensitive_signal', 'late_meal_sensitivity'], confidence: 1 }
  },
  morning_fueling_pattern: {
    protein_breakfast: { scores: { protein_forward: 3 }, reasons: ['protein_forward_signal', 'breakfast_helpful'], confidence: 1 },
    carb_breakfast: { scores: { carb_supported: 2, steady_balanced: 1 }, reasons: ['carb_supported_signal'], confidence: 1 },
    light_start: { scores: { lighter_frequent: 2 }, reasons: ['lighter_frequent_signal'], confidence: 1 },
    no_breakfast: { scores: { steady_balanced: 1 }, reasons: ['steady_balanced_signal'], confidence: 0 }
  }
};

function emptyScores(): FoodPatternScores {
  return {
    steady_balanced: 0,
    protein_forward: 0,
    carb_supported: 0,
    lighter_frequent: 0,
    evening_sensitive: 0
  };
}

function addReason(reasons: FoodPatternReasonCode[], reasonCounts: Map<FoodPatternReasonCode, number>, reason: FoodPatternReasonCode) {
  reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  if (!reasons.includes(reason)) reasons.push(reason);
}

function topScores(scores: FoodPatternScores) {
  return [...SCORE_LABELS]
    .map((label) => ({ label, score: scores[label] }))
    .sort((left, right) => right.score - left.score || SCORE_LABELS.indexOf(left.label) - SCORE_LABELS.indexOf(right.label));
}

function supportReasonCount(label: FoodPatternScoredLabel, reasonCounts: Map<FoodPatternReasonCode, number>): number {
  const reasonByLabel: Record<FoodPatternScoredLabel, FoodPatternReasonCode> = {
    steady_balanced: 'steady_balanced_signal',
    protein_forward: 'protein_forward_signal',
    carb_supported: 'carb_supported_signal',
    lighter_frequent: 'lighter_frequent_signal',
    evening_sensitive: 'evening_sensitive_signal'
  };

  return reasonCounts.get(reasonByLabel[label]) ?? 0;
}

function determineLabel(params: {
  scores: FoodPatternScores;
  answeredCount: number;
  skippedCount: number;
  reasonCounts: Map<FoodPatternReasonCode, number>;
}): FoodPatternProfile['pattern_label'] {
  const sorted = topScores(params.scores);
  const [top, second] = sorted;
  const topScore = top?.score ?? 0;
  const secondScore = second?.score ?? 0;
  const scoreGap = topScore - secondScore;

  if (params.answeredCount < 10 || params.skippedCount >= 5 || topScore < 6) return 'calibrating';

  if (scoreGap <= 2) {
    if (top.label === 'steady_balanced' || second.label === 'steady_balanced') return 'steady_balanced';
    if (supportReasonCount(top.label, params.reasonCounts) < 3) return 'calibrating';
  }

  return top.label;
}

function determineConfidence(params: {
  label: FoodPatternProfile['pattern_label'];
  answeredCount: number;
  skippedCount: number;
  confidencePoints: number;
  scores: FoodPatternScores;
  reasonCounts: Map<FoodPatternReasonCode, number>;
}): FoodPatternProfile['confidence'] {
  if (params.label === 'calibrating' || params.answeredCount < 10 || params.skippedCount >= 5 || params.confidencePoints < 6) {
    return 'low';
  }

  const [top, second] = topScores(params.scores);
  if (!top || !second || top.score - second.score <= 2) return 'low';
  if (supportReasonCount(params.label, params.reasonCounts) < 3) return 'low';
  return 'medium';
}

function macroTendency(label: FoodPatternProfile['pattern_label']): FoodPatternProfile['macro_tendency'] {
  if (label === 'protein_forward') return { protein: 'higher', carbs: 'moderate', fat: 'moderate' };
  if (label === 'carb_supported') return { protein: 'moderate', carbs: 'higher', fat: 'moderate' };
  return { protein: 'moderate', carbs: 'moderate', fat: 'moderate' };
}

function mealTimingTendency(
  label: FoodPatternProfile['pattern_label'],
  reasons: FoodPatternReasonCode[]
): FoodPatternProfile['meal_timing_tendency'] {
  const breakfast = reasons.includes('breakfast_helpful') || label !== 'steady_balanced' && label !== 'calibrating' ? 'helpful' : 'optional';
  const mealSpacing = label === 'lighter_frequent' ? 'shorter' : 'moderate';
  const lateMealSensitivity = label === 'evening_sensitive' || reasons.includes('late_meal_sensitivity')
    ? 'high'
    : label === 'protein_forward' || label === 'lighter_frequent'
      ? 'medium'
      : 'low';

  return {
    breakfast,
    meal_spacing: mealSpacing,
    late_meal_sensitivity: lateMealSensitivity
  };
}

function responseTendencies(reasonCounts: Map<FoodPatternReasonCode, number>): FoodPatternProfile['response_tendencies'] {
  const digestionSignals =
    (reasonCounts.get('digestion_sensitivity') ?? 0) + (reasonCounts.get('large_meal_heaviness') ?? 0);
  const energySignals = reasonCounts.get('afternoon_energy_dip') ?? 0;
  const appetiteSignals = reasonCounts.get('appetite_instability') ?? 0;

  return {
    digestion: digestionSignals >= 2 ? 'sensitive' : digestionSignals === 0 ? 'steady' : 'unknown',
    energy: energySignals >= 2 ? 'dip_prone' : energySignals === 0 ? 'steady' : 'unknown',
    appetite: appetiteSignals >= 2 ? 'hungry_soon' : appetiteSignals === 0 ? 'stable' : 'unknown'
  };
}

export function calculateFoodPatternProfile(params: {
  answers: Record<string, string | null | undefined>;
  now?: string;
}): FoodPatternProfile {
  const scores = emptyScores();
  const reasonCodes: FoodPatternReasonCode[] = [];
  const reasonCounts = new Map<FoodPatternReasonCode, number>();
  let answeredCount = 0;
  let skippedCount = 0;
  let confidencePoints = 0;

  for (const questionId of QUESTION_IDS) {
    const answer = params.answers[questionId];
    const definition = typeof answer === 'string' ? ANSWER_DEFINITIONS[questionId][answer] : undefined;

    if (!definition) {
      skippedCount += 1;
      addReason(reasonCodes, reasonCounts, 'food_pattern_calibrating');
      continue;
    }

    answeredCount += 1;
    confidencePoints += definition.confidence;
    if (definition.confidence <= 0 && definition.reasons.includes('food_pattern_calibrating')) skippedCount += 1;

    for (const [label, points] of Object.entries(definition.scores ?? {}) as Array<[FoodPatternScoredLabel, number]>) {
      scores[label] += points;
    }

    for (const reason of definition.reasons) {
      addReason(reasonCodes, reasonCounts, reason);
    }
  }

  const label = determineLabel({ scores, answeredCount, skippedCount, reasonCounts });
  const confidence = determineConfidence({ label, answeredCount, skippedCount, confidencePoints, scores, reasonCounts });

  if (label === 'calibrating') {
    addReason(reasonCodes, reasonCounts, 'food_pattern_calibrating');
  }

  const timestamp = params.now ?? new Date().toISOString();

  return {
    created_at: timestamp,
    updated_at: timestamp,
    source: 'food_pattern_test',
    confidence,
    pattern_label: label,
    scores,
    macro_tendency: macroTendency(label),
    meal_timing_tendency: mealTimingTendency(label, reasonCodes),
    response_tendencies: responseTendencies(reasonCounts),
    reason_codes: reasonCodes
  };
}

export type { FoodPatternAnswers };

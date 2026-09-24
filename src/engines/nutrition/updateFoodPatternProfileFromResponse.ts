import type { DataConfidence } from './types';
import type {
  FoodPatternMealResponseInput,
  FoodPatternMealResponseScore,
  FoodPatternProfile,
  FoodPatternReasonCode,
  FoodPatternScoredLabel
} from './foodPatternTypes';

const RESPONSE_STEP = 2;
const RESPONSE_WATCH_STEP = 1;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addReason(reasons: FoodPatternReasonCode[], reason: FoodPatternReasonCode) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function averageResponse(input: FoodPatternMealResponseInput): number {
  const energy = ((input.energy - 1) / 4) * 100;
  const digestion = ((input.digestion - 1) / 4) * 100;
  const appetite = ((input.appetite_stability - 1) / 4) * 100;
  const cravingPenalty = input.cravings ? 15 : 0;

  return clampScore(energy * 0.4 + digestion * 0.3 + appetite * 0.3 - cravingPenalty);
}

function labelForScore(score: number): FoodPatternMealResponseScore['label'] {
  if (score >= 75) return 'supportive';
  if (score <= 45) return 'watch';
  return 'neutral';
}

function confidenceForCount(count: number | undefined): FoodPatternMealResponseScore['confidence'] {
  if ((count ?? 1) >= 8) return 'high';
  if ((count ?? 1) >= 3) return 'medium';
  return 'low';
}

function reasonForStyle(style: FoodPatternScoredLabel): FoodPatternReasonCode {
  const reasonByStyle: Record<FoodPatternScoredLabel, FoodPatternReasonCode> = {
    steady_balanced: 'steady_balanced_signal',
    protein_forward: 'protein_forward_signal',
    carb_supported: 'carb_supported_signal',
    lighter_frequent: 'lighter_frequent_signal',
    evening_sensitive: 'evening_sensitive_signal'
  };

  return reasonByStyle[style];
}

function topLabel(scores: FoodPatternProfile['scores']): FoodPatternScoredLabel {
  return (Object.entries(scores) as Array<[FoodPatternScoredLabel, number]>).sort((left, right) => right[1] - left[1])[0][0];
}

function updateTendencies(
  profile: FoodPatternProfile,
  response: FoodPatternMealResponseInput
): FoodPatternProfile['response_tendencies'] {
  return {
    digestion: response.digestion <= 2 ? 'sensitive' : response.digestion >= 4 ? 'steady' : profile.response_tendencies.digestion,
    energy: response.energy <= 2 ? 'dip_prone' : response.energy >= 4 ? 'steady' : profile.response_tendencies.energy,
    appetite:
      response.appetite_stability <= 2 || response.cravings
        ? 'hungry_soon'
        : response.appetite_stability >= 4
          ? 'stable'
          : profile.response_tendencies.appetite
  };
}

export function scoreFoodPatternMealResponse(input: FoodPatternMealResponseInput): FoodPatternMealResponseScore {
  const score = averageResponse(input);
  const label = labelForScore(score);
  const reasonCodes: FoodPatternReasonCode[] = [];

  if (label === 'supportive') addReason(reasonCodes, reasonForStyle(input.meal_style));
  if (input.energy <= 2) addReason(reasonCodes, 'afternoon_energy_dip');
  if (input.digestion <= 2) addReason(reasonCodes, 'digestion_sensitivity');
  if (input.appetite_stability <= 2 || input.cravings) addReason(reasonCodes, 'appetite_instability');
  if (input.meal_style === 'evening_sensitive') addReason(reasonCodes, 'late_meal_sensitivity');

  return {
    score,
    label,
    confidence: confidenceForCount(input.response_count),
    reason_codes: reasonCodes
  };
}

/**
 * Confidence after a response, which only the winning style's own evidence can raise.
 *
 * Counting every response towards whichever style happens to lead let evidence about one
 * style vouch for another: eight check-ins about breakfasts could promote an
 * evening-sensitive label to high confidence without a single late dinner being logged.
 * At high confidence a label is allowed to move somebody's macro targets, so that was
 * borrowed authority with real consequences.
 *
 * So a response about a style other than the leader leaves confidence where it was, and a
 * label that has just changed starts again rather than inheriting what the previous label
 * had earned — one response is not grounds for being sure about a new answer.
 */
function nextConfidence(params: {
  previous: DataConfidence;
  fromResponse: DataConfidence;
  labelChanged: boolean;
  responseIsAboutLeader: boolean;
}): DataConfidence {
  if (params.labelChanged) return params.fromResponse === 'high' ? 'medium' : params.fromResponse;
  if (!params.responseIsAboutLeader) return params.previous;
  if (params.fromResponse === 'high' || params.previous === 'high') return 'high';
  return params.fromResponse === 'medium' || params.previous === 'medium' ? 'medium' : 'low';
}

export function updateFoodPatternProfileFromResponse(params: {
  profile: FoodPatternProfile;
  response: FoodPatternMealResponseInput;
  now?: string;
}): FoodPatternProfile {
  const responseScore = scoreFoodPatternMealResponse(params.response);
  const nextScores = { ...params.profile.scores };
  const reasonCodes = [...params.profile.reason_codes];

  if (responseScore.label === 'supportive') {
    nextScores[params.response.meal_style] += RESPONSE_STEP;
    addReason(reasonCodes, reasonForStyle(params.response.meal_style));
  }

  if (responseScore.label === 'watch') {
    nextScores[params.response.meal_style] = Math.max(0, nextScores[params.response.meal_style] - RESPONSE_WATCH_STEP);
    for (const reason of responseScore.reason_codes) addReason(reasonCodes, reason);
  }

  const patternLabel = topLabel(nextScores);
  const confidence = nextConfidence({
    previous: params.profile.confidence,
    fromResponse: responseScore.confidence,
    labelChanged: patternLabel !== params.profile.pattern_label,
    responseIsAboutLeader: params.response.meal_style === patternLabel
  });

  return {
    ...params.profile,
    updated_at: params.now ?? params.response.responded_at ?? new Date().toISOString(),
    source: 'adaptive_update',
    confidence,
    pattern_label: patternLabel,
    scores: nextScores,
    response_tendencies: updateTendencies(params.profile, params.response),
    reason_codes: reasonCodes
  };
}

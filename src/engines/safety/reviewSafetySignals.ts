import type { DataConfidence } from '../../types/common';
import { SAFETY_SUMMARY, baselineAllowedActions } from './safetyCopy';
import type {
  SafetyBlockedDomain,
  SafetyDisallowedAction,
  SafetyReviewInput,
  SafetyReviewResult,
  SafetyStatus
} from './safetyTypes';

const SERIOUS_FLAG_KEYS = [
  'chest_pain',
  'fainting',
  'severe_dizziness',
  'shortness_of_breath_at_rest',
  'new_neurological_symptoms',
  'severe_injury',
  'pregnancy_related_concern',
  'restrictive_eating_concern',
  'severe_low_mood_or_self_harm_signal'
] as const;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function hasSeriousFlag(input: SafetyReviewInput): boolean {
  const flags = input.userReportedFlags;
  if (!flags) return false;
  return SERIOUS_FLAG_KEYS.some((key) => flags[key] === true);
}

const strongerMovementDisallowed: SafetyDisallowedAction = {
  id: 'no_stronger_movement',
  title: 'Stronger training session',
  detail: 'Healthi is skipping a harder session today and keeping movement easy.',
  reason_codes: ['stronger_movement_withheld']
};

const progressionDisallowed: SafetyDisallowedAction = {
  id: 'no_progression',
  title: 'Adding load or intensity',
  detail: 'No pushing for more today — matching or easing is the better call.',
  reason_codes: ['progression_withheld']
};

/**
 * Deterministic safety review that runs before any stronger guidance. It only
 * routes to professional_guidance on explicit, serious user-reported flags —
 * never inferred. Everyday signals (light sleep, low hydration, under-fueled,
 * digestion off) produce caution, not escalation. Missing data lowers
 * confidence rather than counting against the user.
 */
export function reviewSafetySignals(input: SafetyReviewInput): SafetyReviewResult {
  const reasonCodes: string[] = [];
  const missingData: string[] = [];
  const blockedDomains: SafetyBlockedDomain[] = [];
  const disallowedActions: SafetyDisallowedAction[] = [];

  // ── Track available domains for confidence + missing-data honesty ──────────
  const hasReadiness = typeof input.readiness?.score === 'number' || Boolean(input.readiness?.label);
  const hasMovement =
    input.movement != null &&
    (input.movement.pain_present != null ||
      input.movement.discomfort_level != null ||
      typeof input.movement.soreness_level === 'number' ||
      Boolean(input.movement.movement_readiness_label));
  const hasNourishment =
    input.nourishment != null &&
    (input.nourishment.hydration_low != null ||
      input.nourishment.under_fueled != null ||
      input.nourishment.digestion_off != null ||
      Boolean(input.nourishment.nutrition_readiness_label));
  const hasRhythm =
    input.recoveryRhythm != null &&
    (typeof input.recoveryRhythm.sleep_debt_minutes === 'number' ||
      input.recoveryRhythm.poor_sleep_quality != null);
  const hasLifeLoad =
    input.mindLifeLoad != null &&
    (Boolean(input.mindLifeLoad.life_load_level) || typeof input.mindLifeLoad.stress_score === 'number');

  if (!hasReadiness) missingData.push('readiness');
  if (!hasMovement) missingData.push('movement');
  if (!hasNourishment) missingData.push('nourishment');
  if (!hasRhythm) missingData.push('recovery_rhythm');
  if (!hasLifeLoad) missingData.push('mind_life_load');

  const availableDomains = [hasReadiness, hasMovement, hasNourishment, hasRhythm, hasLifeLoad].filter(
    Boolean
  ).length;

  // ── 1. Explicit serious flags → professional guidance (never inferred) ─────
  if (hasSeriousFlag(input)) {
    reasonCodes.push('user_reported_serious_flag', 'flagged_for_professional_guidance');
    return {
      status: 'professional_guidance',
      confidence: 'high',
      training_allowed: false,
      progression_allowed: false,
      blocked_domains: ['training', 'movement'],
      summary: SAFETY_SUMMARY.professional_guidance,
      allowed_actions: baselineAllowedActions('rest'),
      disallowed_actions: [strongerMovementDisallowed, progressionDisallowed],
      reason_codes: unique(reasonCodes),
      missing_data: missingData
    };
  }

  // ── 2. Movement pain / discomfort ──────────────────────────────────────────
  let hardLimit = false; // limits training entirely
  let progressionBlocked = false;

  const discomfort = input.movement?.discomfort_level ?? null;
  const painPresent = input.movement?.pain_present === true;
  const soreness = typeof input.movement?.soreness_level === 'number' ? input.movement.soreness_level : null;

  if (painPresent || discomfort === 'high') {
    hardLimit = true;
    progressionBlocked = true;
    reasonCodes.push(painPresent ? 'movement_pain_reported' : 'movement_discomfort_high');
    if (!blockedDomains.includes('training')) blockedDomains.push('training');
    if (!blockedDomains.includes('movement')) blockedDomains.push('movement');
  } else if (discomfort === 'moderate' || (soreness != null && soreness >= 7)) {
    progressionBlocked = true;
    reasonCodes.push(discomfort === 'moderate' ? 'movement_discomfort_moderate' : 'soreness_high');
  }

  // ── 3. Very low readiness + high life load ─────────────────────────────────
  const readinessScore = typeof input.readiness?.score === 'number' ? input.readiness.score : null;
  const lifeLoadHigh =
    input.mindLifeLoad?.life_load_level === 'high' ||
    (typeof input.mindLifeLoad?.stress_score === 'number' && input.mindLifeLoad.stress_score >= 8);
  const veryLowReadiness =
    (readinessScore != null && readinessScore < 35) ||
    input.readiness?.label === 'restore' ||
    input.dayMode === 'restore';

  if (veryLowReadiness && lifeLoadHigh) {
    hardLimit = true;
    progressionBlocked = true;
    reasonCodes.push('low_readiness_high_life_load');
    if (!blockedDomains.includes('training')) blockedDomains.push('training');
  } else if (veryLowReadiness || lifeLoadHigh) {
    progressionBlocked = true;
    if (veryLowReadiness) reasonCodes.push('readiness_low');
    if (lifeLoadHigh) reasonCodes.push('life_load_high');
  }

  // ── 4. Everyday recovery / nourishment signals → caution only ──────────────
  let cautionPresent = false;

  if (input.recoveryRhythm?.poor_sleep_quality === true) {
    cautionPresent = true;
    progressionBlocked = true;
    reasonCodes.push('poor_sleep_quality');
  }
  const sleepDebt =
    typeof input.recoveryRhythm?.sleep_debt_minutes === 'number'
      ? input.recoveryRhythm.sleep_debt_minutes
      : null;
  if (sleepDebt != null && sleepDebt >= 120) {
    cautionPresent = true;
    progressionBlocked = true;
    reasonCodes.push('sleep_debt_high');
  }
  if (input.nourishment?.under_fueled === true) {
    cautionPresent = true;
    progressionBlocked = true;
    reasonCodes.push('under_fueled');
  }
  if (input.nourishment?.hydration_low === true) {
    cautionPresent = true;
    reasonCodes.push('hydration_low');
  }
  if (input.nourishment?.digestion_off === true) {
    cautionPresent = true;
    reasonCodes.push('digestion_off');
  }

  // ── Resolve status ─────────────────────────────────────────────────────────
  let status: SafetyStatus = 'clear';
  if (hardLimit) {
    status = 'limit_guidance';
  } else if (progressionBlocked || cautionPresent) {
    status = 'caution';
  }

  const trainingAllowed = !hardLimit;
  const progressionAllowed = trainingAllowed && !progressionBlocked;

  if (!trainingAllowed) disallowedActions.push(strongerMovementDisallowed);
  if (!progressionAllowed) disallowedActions.push(progressionDisallowed);

  // ── Confidence: missing data lowers it, never punishes ─────────────────────
  let confidence: DataConfidence;
  if (availableDomains <= 1) {
    confidence = 'low';
    reasonCodes.push('limited_data');
  } else if (availableDomains >= 4) {
    confidence = 'medium';
  } else {
    confidence = 'medium';
  }

  reasonCodes.push('safety_review_complete');

  return {
    status,
    confidence,
    training_allowed: trainingAllowed,
    progression_allowed: progressionAllowed,
    blocked_domains: unique(blockedDomains),
    summary: SAFETY_SUMMARY[status],
    allowed_actions: baselineAllowedActions(hardLimit ? 'gentle' : 'full'),
    disallowed_actions: disallowedActions,
    reason_codes: unique(reasonCodes),
    missing_data: missingData
  };
}

import type { DataConfidence } from '../../types/common';
import type {
  CloseoutAdherenceLabel,
  CloseoutNextDayAdjustment,
  CloseoutResponseLabel,
  EveningCloseoutAnswers,
  EveningCloseoutResult
} from './eveningCloseoutTypes';

/** Number of closeout questions used to scale confidence. */
const TOTAL_QUESTIONS = 6;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function answeredCount(answers: EveningCloseoutAnswers): number {
  return [
    answers.followed_plan,
    answers.body_response,
    answers.movement_discomfort,
    answers.digestion,
    answers.caffeine_after_cutoff,
    answers.outdoor_light_or_walk
  ].filter((value) => value != null).length;
}

function adherenceFor(answers: EveningCloseoutAnswers): CloseoutAdherenceLabel {
  switch (answers.followed_plan) {
    case 'yes':
      return 'followed';
    case 'partly':
      return 'partial';
    case 'no':
      return 'missed';
    default:
      return 'unknown';
  }
}

function responseFor(answers: EveningCloseoutAnswers): CloseoutResponseLabel {
  if (answers.movement_discomfort === 'pain') return 'needs_attention';
  switch (answers.body_response) {
    case 'better':
      return 'supported';
    case 'same':
      return 'neutral';
    case 'lower_energy':
    case 'more_tense':
      return 'strained';
    default:
      return 'unknown';
  }
}

/**
 * Deterministic evening closeout. Turns a short self-report into an adherence
 * and response read, plus practical next-day adjustments. Never uses shame or
 * clinical language; missing answers lower confidence rather than counting
 * against the user.
 */
export function evaluateEveningCloseout(date: string, answers: EveningCloseoutAnswers): EveningCloseoutResult {
  const day = date.slice(0, 10);
  const reasonCodes: string[] = [];
  const safetyFlags: string[] = [];
  const adjustments: CloseoutNextDayAdjustment[] = [];

  const adherence = adherenceFor(answers);
  const response = responseFor(answers);
  reasonCodes.push(`adherence_${adherence}`, `response_${response}`);

  // Pain → safety flag + next-day movement caution.
  if (answers.movement_discomfort === 'pain') {
    reasonCodes.push('movement_pain_reported');
    safetyFlags.push('movement_pain_reported');
    adjustments.push({
      id: 'closeout_movement_caution',
      title: 'Keep movement gentle tomorrow',
      detail: 'Since movement felt painful today, favor easy movement or rest tomorrow.',
      domain: 'movement_capacity',
      reason_codes: ['movement_pain_reported']
    });
  } else if (answers.movement_discomfort === 'mild_discomfort') {
    reasonCodes.push('movement_discomfort_reported');
    adjustments.push({
      id: 'closeout_movement_ease',
      title: 'Ease into movement tomorrow',
      detail: 'A little discomfort today — start easy and see how it feels.',
      domain: 'movement_capacity',
      reason_codes: ['movement_discomfort_reported']
    });
  }

  // Caffeine after cutoff → rhythm adjustment.
  if (answers.caffeine_after_cutoff === 'yes') {
    reasonCodes.push('caffeine_after_cutoff');
    adjustments.push({
      id: 'closeout_caffeine_rhythm',
      title: 'Bring caffeine earlier tomorrow',
      detail: 'Caffeine landed after the cutoff today — aiming earlier can support sleep.',
      domain: 'recovery_rhythm',
      reason_codes: ['caffeine_after_cutoff']
    });
  }

  // Digestion off → nourishment adjustment.
  if (answers.digestion === 'off') {
    reasonCodes.push('digestion_off');
    adjustments.push({
      id: 'closeout_digestion_nourishment',
      title: 'Keep meals simple tomorrow',
      detail: 'Digestion felt off today — familiar, easy-to-digest meals may sit better.',
      domain: 'nourishment',
      reason_codes: ['digestion_off']
    });
  }

  // Lower energy / more tense → recovery-leaning adjustment.
  if (answers.body_response === 'lower_energy' || answers.body_response === 'more_tense') {
    const tense = answers.body_response === 'more_tense';
    reasonCodes.push(tense ? 'tension_reported' : 'lower_energy_reported');
    adjustments.push({
      id: 'closeout_recovery_lean',
      title: 'Lean toward recovery tomorrow',
      detail: tense
        ? 'A bit more tension today — a calmer, recovery-leaning day can help.'
        : 'Energy ran lower today — keeping tomorrow steady can help it recover.',
      domain: 'recovery_rhythm',
      reason_codes: [tense ? 'tension_reported' : 'lower_energy_reported']
    });
  }

  // No outdoor light / walk → gentle light-movement nudge.
  if (answers.outdoor_light_or_walk === 'no') {
    reasonCodes.push('no_outdoor_light');
    adjustments.push({
      id: 'closeout_outdoor_light',
      title: 'Aim for a little daylight tomorrow',
      detail: 'A short walk or some morning light can support energy and rhythm.',
      domain: 'recovery_rhythm',
      reason_codes: ['no_outdoor_light']
    });
  }

  // Missed plan → neutral, encouraging reset (never shaming).
  if (adherence === 'missed') {
    reasonCodes.push('plan_missed');
    adjustments.push({
      id: 'closeout_gentle_reset',
      title: 'Fresh start tomorrow',
      detail: 'Today did not go to plan, and that is fine. Tomorrow is a clean reset.',
      domain: 'mind_life_load',
      reason_codes: ['plan_missed']
    });
  }

  const answered = answeredCount(answers);
  let confidence: DataConfidence;
  if (answered <= 2) confidence = 'low';
  else if (answered >= TOTAL_QUESTIONS - 1) confidence = 'high';
  else confidence = 'medium';
  if (answered < TOTAL_QUESTIONS) reasonCodes.push('closeout_partially_answered');

  return {
    date: day,
    adherence_label: adherence,
    response_label: response,
    next_day_adjustments: adjustments,
    reason_codes: unique(reasonCodes),
    safety_flags: unique(safetyFlags),
    confidence
  };
}

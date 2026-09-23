import { missingDomainPrompt, readinessSummary } from './readinessCopy';
import type {
  DailyReadinessAction,
  DailyReadinessDomain,
  DailyReadinessDriver,
  DailyReadinessLabel,
  DailyReadinessMode,
  DailyReadinessPrimaryFocus,
  DailyReadinessResult,
  DataConfidence,
  GenerateDailyReadinessInput
} from './readinessTypes';

type DomainScore = {
  domain: DailyReadinessDomain;
  contribution: number;
  confidence: DataConfidence;
  missing: boolean;
  reasons: string[];
};

const CONFIDENCE_VALUE: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * Where a day starts before anything is known about it.
 *
 * A domain with no data contributes nothing, so a profile with nothing logged reads
 * exactly 70 — deliberately, because missing data must lower confidence rather than the
 * score. The cost is that 70 looks like a finding when it is an absence, which is what
 * the driver ledger and its prompts exist to make visible.
 */
export const READINESS_BASELINE = 70;

/**
 * What food is allowed to do to the day.
 *
 * Until the nourishment pillar existed, nutrition reached readiness as a handful of
 * reason codes squashed into a range of five points, so a week of eating badly moved the
 * score less than one short night. That made "your meals have been low and it shows"
 * something the app could say but not something its arithmetic supported.
 *
 * The range is wider now and still deliberately narrower than recovery's, because a bad
 * day of food is a real drag and a bad night of sleep is a bigger one. NEUTRAL is the
 * pillar score that moves nothing: below it the day loses points, above it gains them,
 * and the asymmetry matches the caps — falling short costs more than excelling pays,
 * which is how bodies work.
 */
const NOURISHMENT_NEUTRAL = 70;
const NOURISHMENT_CEILING = 10;
const NOURISHMENT_FLOOR = -18;
/**
 * The pillar score at which the floor is reached, rather than zero.
 *
 * Spreading the downside across all seventy points below neutral made the slope gentler
 * than the upside — a day at 40 lost less than a perfect day gained, which is not how
 * food works and not what the constants were supposed to say. A nourishment score of 30
 * is already a poor day and scores below it are rare, so the drop is spent over the range
 * people actually occupy and anything worse sits on the floor.
 */
const NOURISHMENT_FLOOR_SCORE = 30;

/** A nourishment pillar score as points on the day, or null when there is no score. */
export function nourishmentContribution(score: number | null | undefined): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  const bounded = clamp(score, 0, 100);
  if (bounded >= NOURISHMENT_NEUTRAL) {
    return ((bounded - NOURISHMENT_NEUTRAL) / (100 - NOURISHMENT_NEUTRAL)) * NOURISHMENT_CEILING;
  }
  const shortfall = Math.min(1, (NOURISHMENT_NEUTRAL - bounded) / (NOURISHMENT_NEUTRAL - NOURISHMENT_FLOOR_SCORE));
  return shortfall * NOURISHMENT_FLOOR;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isAvailableLabel(value: string | null | undefined): boolean {
  return !['', 'unknown', 'calibrating', 'none'].includes(normalized(value));
}

function rhythmScore(input: GenerateDailyReadinessInput['rhythm']): DomainScore {
  if (!input) return { domain: 'recovery_rhythm', contribution: 0, confidence: 'low', missing: true, reasons: ['rhythm_data_missing'] };
  let contribution = 0;
  const reasons = [...(input.reason_codes ?? [])];
  const duration = input.sleep_duration_hours;
  const debt = input.sleep_debt_hours;

  if (typeof duration === 'number') {
    if (duration >= 8) contribution += 10;
    else if (duration >= 7) contribution += 6;
    else if (duration < 5) contribution -= 20;
    else if (duration < 6) contribution -= 12;
    if (duration >= 7) reasons.push('sleep_duration_supportive');
    if (duration < 6) reasons.push('sleep_duration_limited');
  }
  if (typeof debt === 'number') {
    if (debt <= 0.5) contribution += 5;
    else if (debt >= 3) contribution -= 15;
    else if (debt >= 2) contribution -= 10;
    else if (debt >= 1) contribution -= 5;
    if (debt >= 1) reasons.push('sleep_debt_present');
    else reasons.push('sleep_debt_low');
  }
  if (['morning_peak', 'second_peak', 'rising'].includes(normalized(input.energy_phase))) contribution += 2;

  const hasSignal = typeof duration === 'number' || typeof debt === 'number' || Boolean(input.energy_phase);
  return {
    domain: 'recovery_rhythm',
    contribution: clamp(contribution, -25, 15),
    confidence: input.confidence ?? 'low',
    missing: !hasSignal,
    reasons: unique(hasSignal ? reasons : [...reasons, 'rhythm_data_missing'])
  };
}

function nutritionScore(input: GenerateDailyReadinessInput['nutrition']): DomainScore {
  if (!input) return { domain: 'nourishment', contribution: 0, confidence: 'low', missing: true, reasons: ['nutrition_data_missing'] };
  const quality = normalized(input.food_quality_label);
  const response = normalized(input.food_response_label);
  const reasons = [...(input.reason_codes ?? [])];

  // The pillar reads the whole day's food; the label bonuses below are the older, thinner
  // path, kept for callers that have not been given a pillar score yet.
  const fromPillar = nourishmentContribution(input.nourishment_score);
  let contribution = fromPillar ?? clamp(input.readiness_adjustment ?? 0, -8, 8);

  if (fromPillar === null) {
    if (quality === 'supportive') contribution += 2;
    if (quality === 'watch') contribution -= 3;
    if (response === 'steady' || response === 'supportive') contribution += 1;
    if (response === 'watch' || response === 'mixed') contribution -= 2;
  }

  const hasSignal =
    (input.meal_count ?? 0) > 0 ||
    fromPillar !== null ||
    Boolean(input.readiness_adjustment) ||
    isAvailableLabel(quality) ||
    isAvailableLabel(response);
  if (!hasSignal) reasons.push('nutrition_data_missing');

  return {
    domain: 'nourishment',
    contribution: Math.round(clamp(contribution, NOURISHMENT_FLOOR, NOURISHMENT_CEILING)),
    confidence: input.confidence ?? 'low',
    missing: !hasSignal,
    reasons: unique(reasons)
  };
}

function movementScore(input: GenerateDailyReadinessInput['movement']): DomainScore {
  if (!input) return { domain: 'movement_capacity', contribution: 0, confidence: 'low', missing: true, reasons: ['movement_data_missing'] };
  const readiness = normalized(input.readiness_label);
  let contribution = 0;
  const reasons = [...(input.reason_codes ?? [])];

  if (readiness === 'ready_to_build' || readiness === 'high') contribution += 10;
  else if (readiness === 'steady_maintenance' || readiness === 'medium') contribution += 4;
  else if (readiness === 'lighter_day' || readiness === 'low') contribution -= 7;
  else if (readiness === 'recovery_support') contribution -= 12;
  if (normalized(input.training_load_label) === 'high_frequency') contribution -= 4;
  const hasSignal =
    (input.workout_count_7d ?? 0) > 0 ||
    (input.total_minutes_7d ?? 0) > 0 ||
    isAvailableLabel(readiness) ||
    isAvailableLabel(input.training_load_label);
  if (!hasSignal) reasons.push('movement_data_missing');

  return {
    domain: 'movement_capacity',
    contribution: clamp(contribution, -15, 12),
    confidence: input.confidence ?? 'low',
    missing: !hasSignal,
    reasons: unique(reasons)
  };
}

function scheduleScore(input: GenerateDailyReadinessInput['schedule']): DomainScore {
  if (!input) return { domain: 'mind_life_load', contribution: 0, confidence: 'low', missing: true, reasons: ['schedule_data_missing'] };
  const blocks = input.block_count ?? 0;
  const openWindows = input.open_window_count ?? 0;
  let contribution = 0;
  const reasons = [...(input.reason_codes ?? [])];

  if (blocks >= 8 && openWindows === 0) contribution = -10;
  else if (blocks >= 6 && openWindows <= 1) contribution = -6;
  else if (openWindows >= 3) contribution = 6;
  else if (openWindows >= 2) contribution = 3;
  else if (blocks > 0 && openWindows === 0) contribution = -3;
  const hasSignal = blocks > 0 || openWindows > 0 || Boolean(input.next_protected_block);
  if (!hasSignal) reasons.push('schedule_data_missing');
  if (contribution <= -6) reasons.push('schedule_load_high');
  if (openWindows > 0) reasons.push('open_windows_available');

  return {
    domain: 'mind_life_load',
    contribution: clamp(contribution, -10, 6),
    confidence: input.confidence ?? 'low',
    missing: !hasSignal,
    reasons: unique(reasons)
  };
}

function combinedConfidence(scores: DomainScore[]): DataConfidence {
  const available = scores.filter((score) => !score.missing);
  if (available.length < 3) return 'low';
  const average = available.reduce((sum, score) => sum + CONFIDENCE_VALUE[score.confidence], 0) / available.length;
  if (available.length === 4 && average >= 1.5) return 'high';
  return average >= 0.75 ? 'medium' : 'low';
}

function readinessLabel(score: number, missingCount: number): DailyReadinessLabel {
  if (missingCount >= 3) return 'calibrating';
  if (score >= 85) return 'primed';
  if (score >= 70) return 'steady';
  if (score >= 55) return 'conserve';
  return 'restore';
}

function readinessMode(
  input: GenerateDailyReadinessInput,
  label: DailyReadinessLabel,
  confidence: DataConfidence,
  scores: DomainScore[]
): DailyReadinessMode {
  if (input.user_context?.baseline_mode === 'professional_guidance') return 'professional_guidance';
  const rhythm = scores.find((score) => score.domain === 'recovery_rhythm')!;
  const movement = scores.find((score) => score.domain === 'movement_capacity')!;
  if (label === 'restore' || rhythm.contribution <= -15 || movement.contribution <= -12) return 'restore';
  if (label === 'primed' && confidence !== 'low' && rhythm.contribution > 0 && movement.contribution >= 0) return 'build';
  if (label === 'conserve' || scores.some((score) => score.contribution <= -5)) return 'correct';
  return 'maintain';
}

function primaryFocus(scores: DomainScore[]): DailyReadinessPrimaryFocus {
  const available = scores.filter((score) => !score.missing);
  if (available.length === 0) return 'balanced';
  const limiting = [...available].sort((left, right) => left.contribution - right.contribution)[0]!;
  if (limiting.contribution <= -3) return limiting.domain;
  const missingNutrition = scores.find((score) => score.domain === 'nourishment')?.missing;
  if (missingNutrition && scores.filter((score) => score.missing).length <= 2) return 'nourishment';
  return 'balanced';
}

function driverStatus(score: DomainScore): DailyReadinessDriver['status'] {
  if (score.missing) return 'calibrating';
  if (score.contribution >= 4) return 'supportive';
  if (score.contribution <= -4) return 'watch';
  return 'steady';
}

function driverDetail(score: DomainScore, input: GenerateDailyReadinessInput): string {
  if (score.missing) return missingDomainPrompt(score.domain);
  if (score.domain === 'recovery_rhythm') {
    const hours = input.rhythm?.sleep_duration_hours;
    return typeof hours === 'number'
      ? `${hours.toFixed(1)} hours logged · ${normalized(input.rhythm?.energy_phase).replace(/_/g, ' ') || 'phase calibrating'}`
      : 'Rhythm timing is available; sleep duration is still calibrating.';
  }
  if (score.domain === 'nourishment') {
    return `${input.nutrition?.meal_count ?? 0} meals logged · ${normalized(input.nutrition?.food_response_label).replace(/_/g, ' ') || 'response calibrating'}`;
  }
  if (score.domain === 'movement_capacity') {
    return `${input.movement?.workout_count_7d ?? 0} workouts · ${input.movement?.total_minutes_7d ?? 0} minutes in 7 days`;
  }
  return `${input.schedule?.block_count ?? 0} blocks · ${input.schedule?.open_window_count ?? 0} open windows`;
}

function drivers(scores: DomainScore[], input: GenerateDailyReadinessInput): DailyReadinessDriver[] {
  const labels: Record<DailyReadinessDomain, string> = {
    recovery_rhythm: 'Recovery + Rhythm',
    nourishment: 'Food + Fueling',
    movement_capacity: 'Movement',
    mind_life_load: 'Schedule + Life Load'
  };
  return scores.map((score) => ({
    domain: score.domain,
    label: labels[score.domain],
    status: driverStatus(score),
    detail: driverDetail(score, input),
    contribution: score.contribution,
    missing: score.missing,
    confidence: score.confidence,
    reason_codes: [...score.reasons]
  }));
}

function actions(
  input: GenerateDailyReadinessInput,
  mode: DailyReadinessMode,
  scores: DomainScore[],
  confidence: DataConfidence
): DailyReadinessAction[] {
  const output: DailyReadinessAction[] = [];
  const rhythm = scores[0]!;
  const nutrition = scores[1]!;
  const movement = scores[2]!;
  const schedule = scores[3]!;
  const add = (action: DailyReadinessAction) => {
    if (output.length < 4 && !output.some((item) => item.id === action.id)) output.push(action);
  };

  if (rhythm.contribution < 0 || mode === 'restore') {
    add({
      id: 'protect_wind_down',
      title: 'Protect your wind-down window tonight.',
      detail: input.rhythm?.wind_down_start
        ? `Begin winding down around ${input.rhythm.wind_down_start}.`
        : 'Keep the final part of the day quieter and more predictable.',
      domain: 'recovery_rhythm',
      priority: 'high',
      confidence: input.rhythm?.confidence ?? 'low',
      reason_codes: ['wind_down_priority']
    });
  } else if (input.rhythm?.deep_work_window) {
    add({
      id: 'use_energy_window',
      title: 'Use your strongest energy window for focused work.',
      detail: `Protect ${input.rhythm.deep_work_window.start} to ${input.rhythm.deep_work_window.end} for your highest-value task.`,
      domain: 'recovery_rhythm',
      priority: 'high',
      confidence: input.rhythm.confidence ?? confidence,
      reason_codes: ['deep_work_window_available']
    });
  }

  if (mode === 'restore' || movement.contribution < 0) {
    add({
      id: 'lighter_movement',
      title: 'Keep movement lighter while readiness rebuilds.',
      detail: 'Choose a comfortable walk, mobility, or a shorter easy session.',
      domain: 'movement_capacity',
      priority: mode === 'restore' ? 'high' : 'medium',
      confidence: input.movement?.confidence ?? 'low',
      reason_codes: ['lighter_movement_suggested']
    });
  } else if (!movement.missing) {
    add({
      id: 'steady_movement',
      title: mode === 'build' ? 'Use today for a focused movement session.' : 'Keep movement steady today.',
      detail: input.rhythm?.exercise_window
        ? `The suggested exercise window is ${input.rhythm.exercise_window.start} to ${input.rhythm.exercise_window.end}.`
        : 'Match the session to your available time and current energy.',
      domain: 'movement_capacity',
      priority: 'medium',
      confidence: input.movement?.confidence ?? confidence,
      reason_codes: ['movement_timing_suggested']
    });
  }

  if (nutrition.missing) {
    add({
      id: 'log_next_meal',
      title: 'Log your next meal to sharpen the fueling signal.',
      detail: 'A simple meal log helps Healthi connect nourishment with the rest of your day.',
      domain: 'nourishment',
      priority: 'medium',
      confidence: 'low',
      reason_codes: ['nutrition_data_missing']
    });
  } else if (nutrition.contribution < 0) {
    add({
      id: 'steady_next_meal',
      title: 'Keep the next meal simple and steady.',
      detail: 'Use a useful protein and fiber anchor, then adjust to appetite and schedule.',
      domain: 'nourishment',
      priority: 'medium',
      confidence: input.nutrition?.confidence ?? confidence,
      reason_codes: ['nourishment_adjustment_suggested']
    });
  }

  if (schedule.contribution < 0) {
    add({
      id: 'protect_transition',
      title: 'Protect one transition between commitments.',
      detail: 'Keep a small buffer for a walk, reset, or meal before the next protected block.',
      domain: 'mind_life_load',
      priority: 'high',
      confidence: input.schedule?.confidence ?? 'low',
      reason_codes: ['schedule_load_high']
    });
  } else if ((input.schedule?.open_window_count ?? 0) > 0) {
    add({
      id: 'use_open_window',
      title: 'Use an open window for a short walk or reset.',
      detail: 'A brief low-pressure reset can help preserve the later part of the day.',
      domain: 'mind_life_load',
      priority: 'low',
      confidence: input.schedule?.confidence ?? confidence,
      reason_codes: ['open_windows_available']
    });
  }

  if (output.length < 2) {
    add({
      id: 'keep_day_steady',
      title: 'Keep the day steady and reassess as signals arrive.',
      detail: 'Use available energy without forcing intensity or perfect timing.',
      domain: 'mind_life_load',
      priority: 'low',
      confidence,
      reason_codes: ['readiness_calibrating']
    });
  }
  if (output.length < 2) {
    add({
      id: 'support_basics',
      title: 'Support the basics today.',
      detail: 'Keep meals, movement, and wind-down timing consistent where practical.',
      domain: 'recovery_rhythm',
      priority: 'low',
      confidence,
      reason_codes: ['steady_basics_suggested']
    });
  }
  return output;
}

export function generateDailyReadiness(input: GenerateDailyReadinessInput): DailyReadinessResult {
  const scores = [
    rhythmScore(input.rhythm),
    nutritionScore(input.nutrition),
    movementScore(input.movement),
    scheduleScore(input.schedule)
  ];
  const rawScore = READINESS_BASELINE + scores.reduce((sum, domain) => sum + domain.contribution, 0);
  const score = clamp(rawScore, 0, 100);
  const missingData = scores.filter((domain) => domain.missing).map((domain) => domain.domain);
  const confidence = combinedConfidence(scores);
  const label = readinessLabel(score, missingData.length);
  const mode = readinessMode(input, label, confidence, scores);
  const focus = primaryFocus(scores);
  const reasonCodes = unique([
    ...scores.flatMap((domain) => domain.reasons),
    `readiness_${label}`,
    `readiness_mode_${mode}`,
    `primary_focus_${focus}`,
    ...(missingData.length > 0 ? ['readiness_data_incomplete'] : [])
  ]);

  return {
    date: input.date.slice(0, 10),
    score,
    baseline_score: READINESS_BASELINE,
    raw_score: rawScore,
    label,
    mode,
    confidence,
    primary_focus: focus,
    summary: readinessSummary(label),
    recommended_actions: actions(input, mode, scores, confidence),
    driver_cards: drivers(scores, input),
    reason_codes: reasonCodes,
    missing_data: missingData,
    contributions: { baseline: 70, domains: scores.map(domain => ({ ...domain, reasons: [...domain.reasons] })) }
  };
}

import type { ReasonCode } from '../../constants/reasonCodes';
import type {
  BiweeklyFocusProfile,
  DynamicScoreSheet,
  FocusDomainScore,
  FoundationDomain,
  LifestyleBias,
  NourishmentBias,
  OnboardingAnswerValue,
  OnboardingAnswers,
  PriorityBand,
  RankedScoreReason,
  RecoveryBias,
  TrainingBias
} from '../../types/onboarding';
import type { DataConfidence } from '../../types/common';

type ScoredDomain = Exclude<FoundationDomain, 'balanced'>;

type GenerateBiweeklyFocusProfileInput = {
  userId?: string;
  answers: OnboardingAnswers;
  generatedAt?: Date;
  generatedFrom?: BiweeklyFocusProfile['generated_from'];
};

type Signal = {
  pressure: number;
  reason: ReasonCode;
  label: string;
  limiter: string;
};

type DomainSignals = Record<ScoredDomain, Signal[]>;

const scoredDomains: ScoredDomain[] = [
  'recovery_rhythm',
  'nourishment',
  'movement_capacity',
  'mind_life_load'
];

const domainLabels: Record<ScoredDomain, string> = {
  recovery_rhythm: 'Recovery + Rhythm',
  nourishment: 'Nourishment',
  mind_life_load: 'Stress + Life Load',
  movement_capacity: 'Movement Capacity'
};

const scoreSheetWeights: Record<ScoredDomain, number> = {
  recovery_rhythm: 1,
  nourishment: 0.95,
  mind_life_load: 0.9,
  movement_capacity: 0.85
};

const rankedReasonOrder: Record<ScoredDomain, number> = {
  recovery_rhythm: 0,
  nourishment: 1,
  mind_life_load: 2,
  movement_capacity: 3
};

const expectedKeys: Record<ScoredDomain, Array<keyof OnboardingAnswers>> = {
  recovery_rhythm: [
    'bedtime',
    'wake_time',
    'morning_rested_score',
    'overnight_waking',
    'caffeine_dependence',
    'daily_schedule',
    'recovery_between_sessions'
  ],
  nourishment: [
    'diet_quality_score',
    'processed_food_frequency',
    'vegetable_frequency',
    'water_intake',
    'breakfast_skipping',
    'post_meal_discomfort',
    'post_meal_energy',
    'bowel_regular'
  ],
  movement_capacity: [
    'weekly_training_days',
    'training_types',
    'recovery_between_sessions',
    'non_fitness_activity'
  ],
  mind_life_load: [
    'daily_stress_score',
    'stress_sources',
    'daytime_energy_crashes',
    'caffeine_dependence',
    'daily_schedule',
    'blocking_factors'
  ]
};

function asString(value: OnboardingAnswerValue | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: OnboardingAnswerValue | undefined) {
  return typeof value === 'number' ? value : null;
}

function asStringArray(value: OnboardingAnswerValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function hasAnswer(value: OnboardingAnswerValue | undefined) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return typeof value === 'number';
}

function clampPressure(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function confidenceForCoverage(coverage: number): DataConfidence {
  return coverage >= 0.75 ? 'medium' : 'low';
}

function mergeReasonCodes(scores: Record<ScoredDomain, FocusDomainScore>) {
  const reasons = new Set<ReasonCode>(['calibrating']);

  scoredDomains.forEach((domain) => {
    scores[domain].reason_codes.forEach((reason) => reasons.add(reason));
  });

  return Array.from(reasons);
}

function coverageForDomain(answers: OnboardingAnswers, domain: ScoredDomain) {
  const keys = expectedKeys[domain];
  const answered = keys.filter((key) => hasAnswer(answers[key])).length;
  return answered / keys.length;
}

function buildDomainScore(
  answers: OnboardingAnswers,
  domain: ScoredDomain,
  signals: Signal[]
): FocusDomainScore {
  const coverage = coverageForDomain(answers, domain);
  const pressure = clampPressure(signals.reduce((total, signal) => total + signal.pressure, 18));
  const reasonCodes = new Set<ReasonCode>(['calibrating']);

  if (coverage < 0.75) {
    reasonCodes.add('missing_data_low_confidence');
  }

  signals.forEach((signal) => reasonCodes.add(signal.reason));

  return {
    focus_pressure_score: pressure,
    confidence: confidenceForCoverage(coverage),
    reason_codes: Array.from(reasonCodes),
    limiting_factors: signals.map((signal) => signal.limiter).slice(0, 4)
  };
}

function getBedHour(answers: OnboardingAnswers) {
  const bedtime = asString(answers.bedtime);

  if (!bedtime) {
    return null;
  }

  const hour = Number.parseInt(bedtime.split(':')[0] ?? '', 10);
  return Number.isNaN(hour) ? null : hour;
}

function scoreRecoverySignals(answers: OnboardingAnswers): Signal[] {
  const signals: Signal[] = [];
  const bedHour = getBedHour(answers);
  const rested = asNumber(answers.morning_rested_score);
  const overnightWaking = asString(answers.overnight_waking);
  const caffeine = asString(answers.caffeine_dependence);
  const schedule = asString(answers.daily_schedule);
  const recovery = asString(answers.recovery_between_sessions);

  if (bedHour !== null && (bedHour >= 23 || bedHour < 4)) {
    signals.push({
      pressure: bedHour < 4 ? 22 : 16,
      reason: 'circadian_shift',
      label: 'Sleep timing appears inconsistent.',
      limiter: 'Sleep timing may need a steadier rhythm.'
    });
  }

  if (rested !== null && rested <= 4) {
    signals.push({
      pressure: 20,
      reason: 'poor_sleep_quality',
      label: 'Morning recovery feels low.',
      limiter: 'Morning energy suggests sleep quality needs support.'
    });
  }

  if (overnightWaking === 'most_nights' || overnightWaking === 'occasionally') {
    signals.push({
      pressure: overnightWaking === 'most_nights' ? 22 : 10,
      reason: 'poor_sleep_quality',
      label: 'Night waking may be affecting recovery.',
      limiter: 'Night waking may be limiting recovery consistency.'
    });
  }

  if (caffeine === 'four_plus' || caffeine === 'two_to_three') {
    signals.push({
      pressure: caffeine === 'four_plus' ? 16 : 10,
      reason: 'caffeine_high',
      label: 'Caffeine reliance is part of the recovery picture.',
      limiter: 'Caffeine reliance suggests recovery rhythm should stay visible.'
    });
  }

  if (schedule === 'shift_irregular') {
    signals.push({
      pressure: 14,
      reason: 'circadian_shift',
      label: 'Schedule rhythm may need support.',
      limiter: 'Irregular scheduling can make sleep timing harder to stabilize.'
    });
  }

  if (recovery === 'always_sore_fatigued' || recovery === 'slow_recovery') {
    signals.push({
      pressure: recovery === 'always_sore_fatigued' ? 18 : 10,
      reason: 'local_soreness_high',
      label: 'Recovery spacing may need attention.',
      limiter: 'Recovery between sessions may need more spacing.'
    });
  }

  return signals;
}

function scoreNourishmentSignals(answers: OnboardingAnswers): Signal[] {
  const signals: Signal[] = [];
  const dietQuality = asNumber(answers.diet_quality_score);
  const processedFood = asString(answers.processed_food_frequency);
  const vegetables = asString(answers.vegetable_frequency);
  const water = asString(answers.water_intake);
  const breakfast = asString(answers.breakfast_skipping);
  const discomfort = asString(answers.post_meal_discomfort);
  const postMealEnergy = asString(answers.post_meal_energy);
  const bowel = asString(answers.bowel_regular);
  const sweetResponse = asString(answers.sweet_food_response);

  if (dietQuality !== null && dietQuality <= 4) {
    signals.push({
      pressure: 18,
      reason: 'under_fueled',
      label: 'Food quality may be the first useful lever.',
      limiter: 'Food quality may be the clearest first lever.'
    });
  }

  if (processedFood === 'daily' || processedFood === '3_to_4_weekly') {
    signals.push({
      pressure: processedFood === 'daily' ? 20 : 12,
      reason: 'under_fueled',
      label: 'Meal quality may need a steadier foundation.',
      limiter: 'Meal quality may need a steadier foundation.'
    });
  }

  if (vegetables === 'rarely') {
    signals.push({
      pressure: 10,
      reason: 'under_fueled',
      label: 'Vegetable consistency may need support.',
      limiter: 'Micronutrient consistency may need support.'
    });
  }

  if (water === 'less_than_1l' || water === '1_to_2l') {
    signals.push({
      pressure: water === 'less_than_1l' ? 22 : 10,
      reason: 'hydration_low',
      label: 'Hydration is a high-leverage starting point.',
      limiter: 'Hydration is likely a useful first focus.'
    });
  }

  if (breakfast === 'most_days') {
    signals.push({
      pressure: 12,
      reason: 'under_fueled',
      label: 'Meal rhythm may need more consistency.',
      limiter: 'Meal rhythm may need more consistency.'
    });
  }

  if (discomfort === 'often' || bowel === 'irregular' || bowel === 'no') {
    signals.push({
      pressure: discomfort === 'often' || bowel === 'no' ? 18 : 12,
      reason: 'digestion_off',
      label: 'Digestion signals should stay visible.',
      limiter: 'Digestion signals suggest meals should stay simple and trackable.'
    });
  }

  if (postMealEnergy === 'significant_crash' || sweetResponse === 'hard_crash') {
    signals.push({
      pressure: 16,
      reason: 'food_response_negative',
      label: 'Energy after meals may need steadier support.',
      limiter: 'Energy after meals may need steadier meal composition.'
    });
  }

  return signals;
}

function scoreMovementSignals(answers: OnboardingAnswers): Signal[] {
  const signals: Signal[] = [];
  const trainingDays = asString(answers.weekly_training_days);
  const trainingTypes = asStringArray(answers.training_types);
  const recovery = asString(answers.recovery_between_sessions);
  const dailyMovement = asString(answers.non_fitness_activity);

  if (trainingDays === '0' || trainingDays === '1_to_2') {
    signals.push({
      pressure: trainingDays === '0' ? 28 : 14,
      reason: 'movement_permission_limited',
      label: 'Movement consistency needs a baseline.',
      limiter: 'Movement consistency may need to come before intensity.'
    });
  }

  if (trainingTypes.includes('none_currently')) {
    signals.push({
      pressure: 12,
      reason: 'movement_permission_limited',
      label: 'Training should restart gradually.',
      limiter: 'Current training is limited, so movement confidence should build gradually.'
    });
  }

  if (dailyMovement === 'mostly_sedentary') {
    signals.push({
      pressure: 18,
      reason: 'movement_permission_limited',
      label: 'Daily movement is currently limited.',
      limiter: 'Daily movement is low outside workouts.'
    });
  }

  if (recovery === 'always_sore_fatigued') {
    signals.push({
      pressure: 18,
      reason: 'local_soreness_high',
      label: 'Movement quality should come before load.',
      limiter: 'Soreness or fatigue suggests quality and spacing should come first.'
    });
  }

  return signals;
}

function scoreMindSignals(answers: OnboardingAnswers): Signal[] {
  const signals: Signal[] = [];
  const stress = asNumber(answers.daily_stress_score);
  const sources = asStringArray(answers.stress_sources).filter((source) => source !== 'low_stress');
  const crashes = asString(answers.daytime_energy_crashes);
  const schedule = asString(answers.daily_schedule);
  const blockingFactors = asStringArray(answers.blocking_factors);

  if (stress !== null && stress >= 7) {
    signals.push({
      pressure: stress >= 9 ? 28 : 20,
      reason: 'stress_flags_high',
      label: 'Current stress load is carrying weight.',
      limiter: 'Daily stress load may need support before adding demand.'
    });
  }

  if (sources.length >= 2) {
    signals.push({
      pressure: 12,
      reason: 'stress_flags_high',
      label: 'Stress is coming from multiple areas.',
      limiter: 'Stress appears to come from multiple areas of life.'
    });
  }

  if (crashes === 'multiple_daily') {
    signals.push({
      pressure: 12,
      reason: 'stress_flags_high',
      label: 'Energy crashes may add daily friction.',
      limiter: 'Energy crashes may increase friction during the day.'
    });
  }

  if (schedule === 'shift_irregular') {
    signals.push({
      pressure: 10,
      reason: 'stress_flags_high',
      label: 'Schedule pressure may affect consistency.',
      limiter: 'Schedule pressure may make consistency harder.'
    });
  }

  if (blockingFactors.includes('mood_swings') || blockingFactors.includes('brain_fog')) {
    signals.push({
      pressure: 10,
      reason: 'stress_flags_high',
      label: 'Mental load should stay in view.',
      limiter: 'Mental load signals should stay in the calibration picture.'
    });
  }

  return signals;
}

function choosePrimaryFocus(scorecard: BiweeklyFocusProfile['scorecard']): FoundationDomain {
  const sorted = scoredDomains
    .map((domain) => ({
      domain,
      score: scorecard[domain].focus_pressure_score
    }))
    .sort((left, right) => right.score - left.score);
  const [top, second] = sorted;

  if (!top || top.score < 35 || (second && top.score - second.score <= 8)) {
    return 'balanced';
  }

  const closeDomains = sorted.filter((item) => top.score - item.score <= 5);
  const priority: ScoredDomain[] = [
    'movement_capacity',
    'recovery_rhythm',
    'nourishment',
    'mind_life_load'
  ];

  return (
    priority.find((domain) => closeDomains.some((item) => item.domain === domain)) ?? top.domain
  );
}

function chooseSecondaryFocus(
  scorecard: BiweeklyFocusProfile['scorecard'],
  primaryFocus: FoundationDomain
) {
  if (primaryFocus === 'balanced') {
    return undefined;
  }

  const second = scoredDomains
    .filter((domain) => domain !== primaryFocus)
    .map((domain) => ({
      domain,
      score: scorecard[domain].focus_pressure_score
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (!second || second.score < 35) {
    return undefined;
  }

  const primaryScore = scorecard[primaryFocus].focus_pressure_score;
  return primaryScore - second.score <= 12 ? second.domain : undefined;
}

function selectTrainingBias(
  focus: FoundationDomain,
  scorecard: BiweeklyFocusProfile['scorecard']
): TrainingBias {
  if (focus === 'recovery_rhythm') {
    return scorecard.recovery_rhythm.focus_pressure_score >= 70
      ? 'reduce_intensity'
      : 'increase_recovery_spacing';
  }

  if (focus === 'nourishment') {
    return scorecard.nourishment.focus_pressure_score >= 70 ? 'reduce_intensity' : 'consistency_first';
  }

  if (focus === 'movement_capacity') {
    return 'movement_quality_first';
  }

  if (focus === 'mind_life_load') {
    return 'stress_adapted_training';
  }

  return 'normal_progression';
}

function selectLifestyleBias(focus: FoundationDomain): LifestyleBias {
  const map: Record<FoundationDomain, LifestyleBias> = {
    recovery_rhythm: 'circadian_consistency',
    nourishment: 'hydration_and_meal_rhythm',
    movement_capacity: 'movement_restoration',
    mind_life_load: 'stress_decompression',
    balanced: 'balanced'
  };

  return map[focus];
}

function selectNourishmentBias(
  focus: FoundationDomain,
  score: FocusDomainScore
): NourishmentBias {
  if (focus !== 'nourishment') {
    return 'balanced';
  }

  if (score.reason_codes.includes('hydration_low')) {
    return 'hydration_first';
  }

  if (score.reason_codes.includes('digestion_off')) {
    return 'digestion_support';
  }

  if (score.reason_codes.includes('food_response_negative')) {
    return 'meal_rhythm_first';
  }

  if (score.reason_codes.includes('under_fueled')) {
    return 'protein_energy_adequacy';
  }

  return 'balanced';
}

function selectRecoveryBias(focus: FoundationDomain, score: FocusDomainScore): RecoveryBias {
  if (focus !== 'recovery_rhythm') {
    return 'balanced';
  }

  if (score.reason_codes.includes('caffeine_high')) {
    return 'caffeine_cutoff';
  }

  if (score.reason_codes.includes('circadian_shift')) {
    return 'morning_light';
  }

  if (score.reason_codes.includes('poor_sleep_quality')) {
    return 'wind_down';
  }

  return 'sleep_timing';
}

function overallConfidence(scorecard: BiweeklyFocusProfile['scorecard']): DataConfidence {
  return scoredDomains.every((domain) => scorecard[domain].confidence === 'medium')
    ? 'medium'
    : 'low';
}

function topLimiters(scorecard: BiweeklyFocusProfile['scorecard']) {
  return scoredDomains
    .flatMap((domain) =>
      scorecard[domain].limiting_factors.map((limiter) => ({
        limiter,
        score: scorecard[domain].focus_pressure_score
      }))
    )
    .sort((left, right) => right.score - left.score)
    .map((item) => item.limiter)
    .filter((limiter, index, all) => all.indexOf(limiter) === index)
    .slice(0, 3);
}

function priorityForScore(score: number): PriorityBand {
  if (score >= 67) {
    return 'high';
  }

  if (score >= 34) {
    return 'moderate';
  }

  return 'low';
}

function colorTokenForPriority(priority: PriorityBand): 'green' | 'yellow' | 'red' {
  if (priority === 'high') {
    return 'red';
  }

  if (priority === 'moderate') {
    return 'yellow';
  }

  return 'green';
}

function buildRankedReasons(signalsByDomain: DomainSignals): RankedScoreReason[] {
  return scoredDomains
    .flatMap((domain) =>
      signalsByDomain[domain].map((signal) => ({
        domain,
        label: signal.label,
        explanation: signal.limiter,
        impact_score: clampPressure(signal.pressure * scoreSheetWeights[domain]),
        reason_code: signal.reason
      }))
    )
    .sort((left, right) => {
      const impactDiff = right.impact_score - left.impact_score;

      if (Math.abs(impactDiff) > 5) {
        return impactDiff;
      }

      return rankedReasonOrder[left.domain] - rankedReasonOrder[right.domain];
    });
}

function buildScoreSheetSummary(primaryFocus: FoundationDomain) {
  if (primaryFocus === 'balanced') {
    return 'No single domain strongly dominated your score sheet, so Healthi will keep your first 2 weeks balanced while calibration continues.';
  }

  return `Your answers suggest ${domainLabels[primaryFocus]} is carrying the most weight right now. Healthi will use this score sheet to bias your next 2-week focus.`;
}

function buildDynamicScoreSheet(
  scorecard: BiweeklyFocusProfile['scorecard'],
  primaryFocus: FoundationDomain,
  signalsByDomain: DomainSignals
): DynamicScoreSheet {
  const rankedReasons = buildRankedReasons(signalsByDomain);
  const domain_scores = {
    recovery_rhythm: buildScoreSheetDomain('recovery_rhythm', scorecard, rankedReasons),
    nourishment: buildScoreSheetDomain('nourishment', scorecard, rankedReasons),
    mind_life_load: buildScoreSheetDomain('mind_life_load', scorecard, rankedReasons),
    movement_capacity: buildScoreSheetDomain('movement_capacity', scorecard, rankedReasons)
  };
  const weightedAverage =
    scoredDomains.reduce(
      (total, domain) => total + scorecard[domain].focus_pressure_score * scoreSheetWeights[domain],
      0
    ) / scoredDomains.reduce((total, domain) => total + scoreSheetWeights[domain], 0);
  const maxScore = Math.max(...scoredDomains.map((domain) => scorecard[domain].focus_pressure_score));
  const overallScore = clampPressure(maxScore * 0.65 + weightedAverage * 0.35);

  return {
    overall_priority: priorityForScore(overallScore),
    overall_score: overallScore,
    domain_scores,
    ranked_reasons: rankedReasons.slice(0, 6),
    summary: buildScoreSheetSummary(primaryFocus)
  };
}

function buildScoreSheetDomain(
  domain: ScoredDomain,
  scorecard: BiweeklyFocusProfile['scorecard'],
  rankedReasons: RankedScoreReason[]
) {
  const score = scorecard[domain].focus_pressure_score;
  const priority = priorityForScore(score);

  return {
    label: domainLabels[domain],
    score,
    priority,
    color_token: colorTokenForPriority(priority),
    weight: scoreSheetWeights[domain],
    reasons: rankedReasons.filter((reason) => reason.domain === domain).slice(0, 3)
  };
}

export function generateBiweeklyFocusProfile({
  userId,
  answers,
  generatedAt = new Date(),
  generatedFrom = 'onboarding'
}: GenerateBiweeklyFocusProfileInput): BiweeklyFocusProfile {
  const signalsByDomain = {
    recovery_rhythm: scoreRecoverySignals(answers),
    nourishment: scoreNourishmentSignals(answers),
    movement_capacity: scoreMovementSignals(answers),
    mind_life_load: scoreMindSignals(answers)
  };
  const scorecard = {
    recovery_rhythm: buildDomainScore(answers, 'recovery_rhythm', signalsByDomain.recovery_rhythm),
    nourishment: buildDomainScore(answers, 'nourishment', signalsByDomain.nourishment),
    movement_capacity: buildDomainScore(answers, 'movement_capacity', signalsByDomain.movement_capacity),
    mind_life_load: buildDomainScore(answers, 'mind_life_load', signalsByDomain.mind_life_load)
  };
  const primaryFocus = choosePrimaryFocus(scorecard);
  const secondaryFocus = chooseSecondaryFocus(scorecard, primaryFocus);
  const generatedAtIso = generatedAt.toISOString();
  const reassessmentDate = toDateString(addDays(generatedAt, 14));
  const dynamicScoreSheet = buildDynamicScoreSheet(scorecard, primaryFocus, signalsByDomain);

  return {
    user_id: userId,
    cycle_start_date: toDateString(generatedAt),
    cycle_end_date: reassessmentDate,
    primary_focus: primaryFocus,
    secondary_focus: secondaryFocus,
    scorecard,
    confidence: overallConfidence(scorecard),
    reason_codes: mergeReasonCodes(scorecard),
    top_limiting_factors: topLimiters(scorecard),
    training_bias: selectTrainingBias(primaryFocus, scorecard),
    lifestyle_bias: selectLifestyleBias(primaryFocus),
    nourishment_bias: selectNourishmentBias(primaryFocus, scorecard.nourishment),
    recovery_bias: selectRecoveryBias(primaryFocus, scorecard.recovery_rhythm),
    generated_from: generatedFrom,
    calibration_status: generatedFrom === 'onboarding' ? 'calibrating' : 'active',
    reassessment_due_at: reassessmentDate,
    generated_at: generatedAtIso,
    dynamic_score_sheet: dynamicScoreSheet
  };
}

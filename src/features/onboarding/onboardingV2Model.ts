import type { BaselineMode } from '../../engines/baseline';
import type { OnboardingAnswerValue, OnboardingAnswers } from '../../types/onboarding';
import { onboardingV2DomainLabels, onboardingV2FocusLabels } from './onboardingV2Copy';
import type {
  GenerateOnboardingV2Input,
  OnboardingV2BaselineSetup,
  OnboardingV2CalibrationHint,
  OnboardingV2Domain,
  OnboardingV2PrimaryFocus,
  OnboardingV2Result
} from './onboardingV2Types';

const domains: OnboardingV2Domain[] = [
  'recovery_rhythm',
  'nourishment',
  'movement_capacity',
  'mind_life_load'
];

const expectedAnswers: Record<OnboardingV2Domain, Array<keyof OnboardingAnswers>> = {
  recovery_rhythm: ['bedtime', 'wake_time', 'morning_rested_score', 'overnight_waking'],
  nourishment: ['meal_cadence', 'diet_quality_score', 'water_intake', 'post_meal_energy'],
  movement_capacity: ['weekly_training_days', 'training_types', 'recovery_between_sessions', 'non_fitness_activity'],
  mind_life_load: ['daily_stress_score', 'daily_schedule', 'blocking_factors']
};

function stringAnswer(answers: OnboardingAnswers, key: keyof OnboardingAnswers): string | null {
  const value = answers[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberAnswer(answers: OnboardingAnswers, key: keyof OnboardingAnswers): number | null {
  const value = answers[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function valuesAnswer(answers: OnboardingAnswers, key: keyof OnboardingAnswers): string[] {
  const value = answers[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function hasAnswer(value: OnboardingAnswerValue | undefined): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return Boolean(value.trim());
  return typeof value === 'number';
}

function clampPriority(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function priorityForDomain(answers: OnboardingAnswers, domain: OnboardingV2Domain): number {
  const goal = stringAnswer(answers, 'primary_goal');
  const rested = numberAnswer(answers, 'morning_rested_score');
  const stress = numberAnswer(answers, 'daily_stress_score');
  const nourishmentScore = numberAnswer(answers, 'diet_quality_score');
  const trainingDays = stringAnswer(answers, 'weekly_training_days');
  const recovery = stringAnswer(answers, 'recovery_between_sessions');
  const schedule = stringAnswer(answers, 'daily_schedule');
  const score = (() => {
    if (domain === 'recovery_rhythm') {
      return (goal === 'sleep_optimization' ? 35 : 0)
        + (rested !== null && rested <= 4 ? 30 : 0)
        + (stringAnswer(answers, 'overnight_waking') === 'most_nights' ? 25 : stringAnswer(answers, 'overnight_waking') === 'occasionally' ? 12 : 0)
        + (!stringAnswer(answers, 'bedtime') || !stringAnswer(answers, 'wake_time') ? 10 : 0)
        + (schedule === 'shift_irregular' ? 12 : 0);
    }
    if (domain === 'nourishment') {
      return (goal === 'nourishment_habits' ? 35 : 0)
        + (nourishmentScore !== null && nourishmentScore <= 4 ? 34 : 0)
        + (stringAnswer(answers, 'water_intake') === 'less_than_1l' ? 18 : 0)
        + (stringAnswer(answers, 'post_meal_energy') === 'significant_crash' ? 18 : 0)
        + (stringAnswer(answers, 'meal_cadence') ? 0 : 10);
    }
    if (domain === 'movement_capacity') {
      return (goal === 'build_consistency' || goal === 'athletic_performance' ? 30 : 0)
        + (trainingDays === '0' ? 32 : trainingDays === '1_to_2' ? 14 : 0)
        + (valuesAnswer(answers, 'training_types').includes('none_currently') ? 15 : 0)
        + (recovery === 'always_sore_fatigued' ? 18 : recovery === 'slow_recovery' ? 8 : 0)
        + (stringAnswer(answers, 'non_fitness_activity') === 'mostly_sedentary' ? 15 : 0);
    }
    return (goal === 'balance_schedule' ? 35 : 0)
      + (stress !== null && stress >= 8 ? 30 : stress !== null && stress >= 7 ? 18 : 0)
      + (schedule === 'shift_irregular' ? 18 : 0)
      + (valuesAnswer(answers, 'blocking_factors').length >= 3 ? 12 : 0);
  })();
  return clampPriority(score);
}

function missingForDomain(answers: OnboardingAnswers, domain: OnboardingV2Domain): string[] {
  return expectedAnswers[domain].filter((key) => !hasAnswer(answers[key])).map(String);
}

function focusForGoal(goal: string | null): OnboardingV2PrimaryFocus {
  if (goal === 'sleep_optimization') return 'recovery_rhythm';
  if (goal === 'nourishment_habits') return 'nourishment';
  if (goal === 'build_consistency' || goal === 'athletic_performance') return 'movement_capacity';
  if (goal === 'balance_schedule') return 'mind_life_load';
  return 'balanced';
}

function chooseFocus(answers: OnboardingAnswers, priorities: Record<OnboardingV2Domain, number>): OnboardingV2PrimaryFocus {
  const goalFocus = focusForGoal(stringAnswer(answers, 'primary_goal'));
  const ranked = [...domains].sort((left, right) => priorities[right] - priorities[left]);
  const top = ranked[0] ?? 'recovery_rhythm';
  const goalPriority = goalFocus === 'balanced' ? 0 : priorities[goalFocus];
  if (goalFocus !== 'balanced' && goalPriority + 12 >= priorities[top]) return goalFocus;
  if (priorities[top] < 20) return 'balanced';
  return top;
}

function modeForAnswers(
  answers: OnboardingAnswers,
  focus: OnboardingV2PrimaryFocus,
  priorities: Record<OnboardingV2Domain, number>,
  existingMode?: BaselineMode | null
): BaselineMode {
  if (existingMode === 'professional_guidance') return existingMode;

  const rested = numberAnswer(answers, 'morning_rested_score');
  const stress = numberAnswer(answers, 'daily_stress_score');
  const trainingDays = stringAnswer(answers, 'weekly_training_days');
  const overnightWaking = stringAnswer(answers, 'overnight_waking');
  const goal = stringAnswer(answers, 'primary_goal');
  const highestPriority = Math.max(...domains.map((domain) => priorities[domain]));
  const lowCapacityHighLoad = (trainingDays === '0' || valuesAnswer(answers, 'training_types').includes('none_currently')) && (stress ?? 0) >= 8;
  const lowRhythmCapacity = (rested ?? 10) <= 3 && (overnightWaking === 'most_nights' || (stress ?? 0) >= 8);

  if (lowCapacityHighLoad || lowRhythmCapacity) return 'restore';
  if ((goal === 'build_consistency' || goal === 'athletic_performance') && highestPriority < 42) return 'build';
  if (goal === 'patterns_over_time' || highestPriority < 20) return 'maintain';
  if (focus === 'balanced' && highestPriority < 35) return 'maintain';
  return 'correct';
}

function detailForDomain(domain: OnboardingV2Domain, priority: number, missing: string[]): string {
  if (missing.length) return `A few more ${onboardingV2DomainLabels[domain].toLowerCase()} details will sharpen this starting point.`;
  if (domain === 'recovery_rhythm') return priority >= 45 ? 'Start with a more repeatable sleep window and a calmer wind-down.' : 'Your rhythm has a useful starting shape. Keep logging sleep windows to refine it.';
  if (domain === 'nourishment') return priority >= 45 ? 'Keep meal rhythm and food response visible while your first pattern forms.' : 'Your nourishment answers give Healthi an early foundation to build from.';
  if (domain === 'movement_capacity') return priority >= 45 ? 'Favor repeatable movement and recovery spacing before adding more demand.' : 'Your current movement context gives Healthi a useful place to start.';
  return priority >= 45 ? 'Protect the parts of the day that make a steady plan easier to follow.' : 'Your schedule context will become more useful as you add real blocks to your day.';
}

function hintsForAnswers(answers: OnboardingAnswers, priorities: Record<OnboardingV2Domain, number>): OnboardingV2CalibrationHint[] {
  return domains.map((domain) => {
    const missing = missingForDomain(answers, domain);
    return {
      domain,
      label: onboardingV2DomainLabels[domain],
      detail: detailForDomain(domain, priorities[domain], missing),
      priority: priorities[domain],
      reason_codes: [
        `${domain}_baseline`,
        ...(missing.length ? [`${domain}_details_missing`] : []),
        ...(priorities[domain] >= 45 ? [`${domain}_focus_requested`] : [])
      ]
    };
  });
}

function nextStepsForResult(
  focus: OnboardingV2PrimaryFocus,
  hints: OnboardingV2CalibrationHint[],
  missingData: string[]
): OnboardingV2Result['next_steps'] {
  const focusDomain = focus === 'balanced' ? hints[0]?.domain ?? 'recovery_rhythm' : focus;
  const actions: Record<OnboardingV2Domain, OnboardingV2Result['next_steps'][number]> = {
    recovery_rhythm: { id: 'log_sleep', title: 'Add your next sleep window', detail: 'This gives your recovery rhythm a more personal starting point.', priority: 'high', reason_codes: ['recovery_rhythm_next_step'] },
    nourishment: { id: 'log_meal', title: 'Log one familiar meal', detail: 'This starts turning nourishment answers into a food response pattern.', priority: 'high', reason_codes: ['nourishment_next_step'] },
    movement_capacity: { id: 'log_movement', title: 'Log your next movement session', detail: 'This helps Healthi learn your training time and recovery context.', priority: 'high', reason_codes: ['movement_capacity_next_step'] },
    mind_life_load: { id: 'add_schedule', title: 'Add a few schedule blocks', detail: 'This helps Healthi find useful openings in your day.', priority: 'high', reason_codes: ['mind_life_load_next_step'] }
  };
  const second = hints.find((hint) => hint.domain !== focusDomain && hint.priority >= 35)?.domain;
  const steps = [actions[focusDomain]];
  if (second) steps.push({ ...actions[second], priority: 'medium' });
  if (missingData.length) {
    steps.push({ id: 'keep_calibrating', title: 'Keep the first week simple', detail: 'You can update these details later as Healthi learns from available data.', priority: 'low', reason_codes: ['baseline_details_missing'] });
  }
  return steps;
}

function confidenceForAnswers(answers: OnboardingAnswers, missingData: string[]): 'low' | 'medium' {
  const answered = Object.values(answers).filter(hasAnswer).length;
  return answered >= 11 && missingData.length <= 3 ? 'medium' : 'low';
}

function isBaselineMode(value: unknown): value is BaselineMode {
  return value === 'build' || value === 'maintain' || value === 'correct' || value === 'restore' || value === 'professional_guidance';
}

function isPrimaryFocus(value: unknown): value is OnboardingV2PrimaryFocus {
  return value === 'recovery_rhythm' || value === 'nourishment' || value === 'movement_capacity' || value === 'mind_life_load' || value === 'balanced';
}

export function generateOnboardingV2Result(input: GenerateOnboardingV2Input): OnboardingV2Result {
  const priorities = Object.fromEntries(domains.map((domain) => [domain, priorityForDomain(input.answers, domain)])) as Record<OnboardingV2Domain, number>;
  const missingData = domains.flatMap((domain) => missingForDomain(input.answers, domain));
  const focus = chooseFocus(input.answers, priorities);
  const baselineMode = modeForAnswers(input.answers, focus, priorities, input.existing_baseline_mode);
  const confidence = confidenceForAnswers(input.answers, missingData);
  const hints = hintsForAnswers(input.answers, priorities).sort((left, right) => right.priority - left.priority);
  const completed = Boolean(stringAnswer(input.answers, 'primary_goal')) && Object.values(input.answers).filter(hasAnswer).length >= 8;
  const topHint = hints[0];
  const focusLabel = onboardingV2FocusLabels[focus].toLowerCase();
  const summary = completed
    ? `Your first baseline centers on ${focusLabel}. Healthi will keep the next steps practical while your logged data adds context.`
    : 'Your baseline is still forming. Add a few core details to make the first steps more personal.';

  return {
    version: 2,
    completed,
    baseline_mode: baselineMode,
    primary_focus: focus,
    confidence,
    summary,
    calibration_hints: hints,
    next_steps: nextStepsForResult(focus, hints, missingData),
    reason_codes: [
      'onboarding_v2',
      `baseline_mode_${baselineMode}`,
      `primary_focus_${focus}`,
      ...(topHint ? topHint.reason_codes : []),
      ...(missingData.length ? ['baseline_details_missing'] : [])
    ],
    missing_data: missingData
  };
}

export function onboardingV2SetupFromResult(result: OnboardingV2Result): OnboardingV2BaselineSetup {
  return {
    version: 2,
    baseline_mode: result.baseline_mode,
    primary_focus: result.primary_focus,
    confidence: result.confidence,
    reason_codes: [...result.reason_codes],
    missing_data: [...result.missing_data]
  };
}

export function readOnboardingV2Setup(value: unknown): OnboardingV2BaselineSetup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const setup = record.setup_v2;
  if (!setup || typeof setup !== 'object' || Array.isArray(setup)) return null;
  const candidate = setup as Record<string, unknown>;
  if (candidate.version !== 2 || !isBaselineMode(candidate.baseline_mode) || !isPrimaryFocus(candidate.primary_focus)) return null;
  const confidence = candidate.confidence;
  if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') return null;
  return {
    version: 2,
    baseline_mode: candidate.baseline_mode,
    primary_focus: candidate.primary_focus,
    confidence,
    reason_codes: Array.isArray(candidate.reason_codes) ? candidate.reason_codes.filter((item): item is string => typeof item === 'string') : [],
    missing_data: Array.isArray(candidate.missing_data) ? candidate.missing_data.filter((item): item is string => typeof item === 'string') : []
  };
}

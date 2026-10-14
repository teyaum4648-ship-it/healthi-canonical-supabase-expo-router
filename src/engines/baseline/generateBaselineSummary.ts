import { baselineDomainLabels, baselineModeLabels, humanize } from './baselineCopy';
import type {
  BaselineCalibrationDomain,
  BaselineDomain,
  BaselineProfileCard,
  BaselineSummary,
  GenerateBaselineSummaryInput
} from './baselineTypes';

const domains: BaselineDomain[] = [
  'recovery_rhythm',
  'nourishment',
  'movement_capacity',
  'mind_life_load',
  'readiness'
];

function coverageStatus(days: number): BaselineCalibrationDomain['status'] {
  if (days >= 7) return 'ready';
  if (days >= 3) return 'partial';
  return 'calibrating';
}

function calibrationDomain(domain: BaselineDomain, days: number): BaselineCalibrationDomain {
  const status = coverageStatus(days);
  const detail = status === 'ready'
    ? `${days} logged days are shaping this signal.`
    : status === 'partial'
      ? `${days} logged days are forming an early pattern.`
      : 'More logged days will add useful context.';
  return { domain, label: baselineDomainLabels[domain], status, detail };
}

function baseProfileCards(input: GenerateBaselineSummaryInput): BaselineProfileCard[] {
  const profile = input.profile;
  const baseline = input.onboarding?.baseline_profile;
  const signals = input.currentSignals;
  const cards: BaselineProfileCard[] = [];
  const goal = profile?.goal ?? baseline?.primary_goal;

  if (goal) {
    cards.push({ id: 'goal', title: 'Primary goal', value: humanize(goal), detail: 'Saved from your baseline setup.', confidence: 'medium', reason_codes: ['baseline_goal_available'] });
  }
  if (profile?.baseline_mode) {
    cards.push({ id: 'mode', title: 'daywoven mode', value: baselineModeLabels[profile.baseline_mode], detail: 'Your current planning mode.', confidence: 'low', reason_codes: ['baseline_mode_available'] });
  }
  if (signals?.primary_focus) {
    cards.push({ id: 'focus', title: 'Current focus', value: humanize(signals.primary_focus), detail: 'Based on your available signals.', confidence: 'low', reason_codes: ['current_focus_available'] });
  }
  if (signals?.food_pattern_label) {
    cards.push({ id: 'food_pattern', title: 'Food pattern', value: humanize(signals.food_pattern_label), detail: 'Based on your saved food pattern.', confidence: 'medium', reason_codes: ['food_pattern_available'] });
  }
  if (signals?.movement_readiness_label) {
    cards.push({ id: 'movement', title: 'Movement signal', value: humanize(signals.movement_readiness_label), detail: 'Based on your latest movement entry.', confidence: 'low', reason_codes: ['movement_signal_available'] });
  }
  if (signals?.rhythm_confidence) {
    cards.push({ id: 'rhythm', title: 'Rhythm context', value: `${signals.rhythm_confidence[0].toUpperCase()}${signals.rhythm_confidence.slice(1)} confidence`, detail: 'Based on your available sleep context.', confidence: signals.rhythm_confidence, reason_codes: ['rhythm_context_available'] });
  }
  return cards;
}

function preferences(input: GenerateBaselineSummaryInput): BaselineSummary['preferences'] {
  const baseline = input.onboarding?.baseline_profile;
  if (!baseline) {
    return [{ id: 'preferences', title: 'Preferences', detail: 'Preferences will appear as you personalize daywoven.' }];
  }
  const values: BaselineSummary['preferences'] = [];
  if (baseline.preferred_bedtime || baseline.preferred_waketime) {
    values.push({ id: 'sleep_window', title: 'Sleep window', detail: `${baseline.preferred_bedtime ?? 'Bedtime'} to ${baseline.preferred_waketime ?? 'wake time'}.` });
  }
  if (baseline.hydration_target_ml) {
    values.push({ id: 'hydration', title: 'Hydration target', detail: `${baseline.hydration_target_ml} mL daily baseline.` });
  }
  if (baseline.training_capacity?.experience) {
    values.push({ id: 'training', title: 'Training context', detail: humanize(baseline.training_capacity.experience) });
  }
  if (baseline.food_constraints?.length) {
    values.push({ id: 'food_constraints', title: 'Food preferences', detail: `${baseline.food_constraints.length} saved preference${baseline.food_constraints.length === 1 ? '' : 's'}.` });
  }
  return values.length ? values : [{ id: 'preferences', title: 'Preferences', detail: 'Preferences will appear as you personalize daywoven.' }];
}

function nextSteps(
  hasSetup: boolean,
  calibration: BaselineCalibrationDomain[]
): BaselineSummary['next_steps'] {
  if (!hasSetup) {
    return [{ id: 'complete_setup', title: 'Complete your baseline setup', detail: 'Your first answers give daywoven a useful starting point.', priority: 'high', reason_codes: ['baseline_setup_missing'] }];
  }
  const actions: BaselineSummary['next_steps'] = [];
  for (const domain of calibration.filter((item) => item.status === 'calibrating')) {
    const action = {
      recovery_rhythm: { id: 'log_sleep', title: 'Add one sleep entry', detail: 'This improves your recovery rhythm context.' },
      nourishment: { id: 'log_meal', title: 'Log one meal', detail: 'This sharpens your nourishment signal.' },
      movement_capacity: { id: 'log_workout', title: 'Log your next workout', detail: 'This improves movement capacity trends.' },
      mind_life_load: { id: 'add_schedule', title: 'Add schedule blocks', detail: 'This helps personalize your day plan.' },
      readiness: { id: 'use_healthi', title: 'Keep logging your day', detail: 'Readiness becomes clearer as available signals build.' }
    }[domain.domain];
    actions.push({ ...action, priority: actions.length === 0 ? 'high' : 'medium', reason_codes: [`${domain.domain}_coverage_missing`] });
  }
  return actions.slice(0, 4).length
    ? actions.slice(0, 4)
    : [{ id: 'keep_steady', title: 'Keep your pattern steady', detail: 'Your baseline and logged data are building useful context.', priority: 'low', reason_codes: ['baseline_ready'] }];
}

export function generateBaselineSummary(input: GenerateBaselineSummaryInput): BaselineSummary {
  const profile = input.profile;
  const onboarding = input.onboarding;
  const hasSetup = Boolean(profile && onboarding?.completed);
  const calibration = domains.map((domain) => calibrationDomain(domain, input.dataCoverage?.[`${domain}_days` as keyof typeof input.dataCoverage] ?? 0));
  const informedDomains = calibration.filter((item) => item.status !== 'calibrating').length;
  const status: BaselineSummary['status'] = !hasSetup ? 'needs_setup' : informedDomains >= 2 ? 'ready' : 'calibrating';
  const confidence = status === 'ready' && calibration.filter((item) => item.status === 'ready').length >= 2
    ? 'high'
    : hasSetup && informedDomains > 0
      ? 'medium'
      : 'low';
  const missing = calibration.filter((item) => item.status === 'calibrating').map((item) => item.domain);
  const profileCards = baseProfileCards(input);
  const sourceLabel = input.source_label ?? (hasSetup ? 'logged' : 'calibrating');

  const headline = status === 'needs_setup'
    ? 'Your baseline is ready to begin.'
    : status === 'ready'
      ? 'Your daywoven baseline is taking shape.'
      : 'Your baseline is still calibrating.';
  const detail = status === 'needs_setup'
    ? 'Complete a few baseline details so daywoven can organize your starting point.'
    : status === 'ready'
      ? 'Your baseline and logged data are creating a more personal view of your day.'
      : 'Log a few more moments across your day to reveal clearer patterns.';

  return {
    status,
    confidence,
    source_label: sourceLabel,
    headline,
    detail,
    profile_cards: profileCards,
    calibration: {
      completion_label: onboarding?.completed ? 'Baseline setup complete' : 'Baseline setup needed',
      detail: onboarding?.completed ? 'Coverage grows as you log the parts of your day that matter.' : 'A short setup gives daywoven a useful starting point.',
      domains: calibration
    },
    preferences: preferences(input),
    next_steps: nextSteps(hasSetup, calibration),
    reason_codes: [
      ...(onboarding?.reason_codes ?? []),
      hasSetup ? 'baseline_setup_available' : 'baseline_setup_missing',
      ...calibration.filter((item) => item.status === 'calibrating').map((item) => `${item.domain}_calibrating`)
    ],
    missing_data: missing
  };
}

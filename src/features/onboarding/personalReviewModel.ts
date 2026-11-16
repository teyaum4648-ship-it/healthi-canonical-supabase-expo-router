import type {
  BiweeklyFocusProfile,
  FoundationDomain,
  OnboardingAnswerValue,
  OnboardingAnswers,
  OnboardingQuestion,
  PriorityBand
} from '../../types/onboarding';
import { formatClockText } from '../../utils/clockFormat';
import { onboardingQuestions } from './onboardingQuestions';
import { normalizeTimeAnswer } from './onboardingSteps';

/**
 * The Personal Review after onboarding, as plain content. Everything here is either one of
 * the person's own answers, read back with the questionnaire's own labels, or an output the
 * focus engine already produced (focus, priorities, reasons, biases, reassessment date).
 * Nothing is inferred beyond those, and nothing is a diagnosis.
 */

export type ScoredDomain = Exclude<FoundationDomain, 'balanced'>;

export const FOUNDATION_ORDER: ScoredDomain[] = ['recovery_rhythm', 'nourishment', 'mind_life_load', 'movement_capacity'];

export const FOUNDATION_NAMES: Record<ScoredDomain, string> = {
  recovery_rhythm: 'Recovery & Rhythm',
  nourishment: 'Nourishment',
  mind_life_load: 'Stress & Life Load',
  movement_capacity: 'Movement'
};

export function focusName(focus: FoundationDomain): string {
  return focus === 'balanced' ? 'A balanced start' : FOUNDATION_NAMES[focus];
}

/**
 * The score sheet's number is an attention signal: higher means worth more attention now,
 * not worse health. The words say that, so the number can stay as context.
 */
export const ATTENTION: Record<PriorityBand, { word: string; level: 1 | 2 | 3 }> = {
  high: { word: 'Most attention now', level: 3 },
  moderate: { word: 'Some attention', level: 2 },
  low: { word: 'Steady for now', level: 1 }
};

export const trainingBiasLabels: Record<BiweeklyFocusProfile['training_bias'], string> = {
  normal_progression: 'Build consistency with normal progression.',
  reduce_intensity: 'Keep intensity conservative while the first focus stabilizes.',
  increase_recovery_spacing: 'Add more recovery spacing between harder efforts.',
  movement_quality_first: 'Prioritize movement quality before adding load.',
  consistency_first: 'Favor repeatable sessions over aggressive progression.',
  stress_adapted_training: 'Use training that fits current stress and schedule load.'
};

export const lifestyleBiasLabels: Record<BiweeklyFocusProfile['lifestyle_bias'], string> = {
  circadian_consistency: 'Anchor sleep and wake timing where possible.',
  hydration_and_meal_rhythm: 'Make hydration and meal rhythm easier to repeat.',
  stress_decompression: 'Protect small daily decompression windows.',
  movement_restoration: 'Add low-friction movement restoration through the day.',
  balanced: 'Keep lifestyle guidance simple while calibration continues.'
};

export const nourishmentBiasLabels: Record<BiweeklyFocusProfile['nourishment_bias'], string> = {
  hydration_first: 'Start with hydration consistency.',
  meal_rhythm_first: 'Make meal timing steadier.',
  digestion_support: 'Keep meals simple and track response patterns.',
  protein_energy_adequacy: 'Support protein and energy adequacy.',
  food_constraints_awareness: 'Keep food constraints visible.',
  balanced: 'Keep food and hydration guidance balanced.'
};

export const recoveryBiasLabels: Record<BiweeklyFocusProfile['recovery_bias'], string> = {
  sleep_timing: 'Start with a steadier sleep window.',
  wind_down: 'Support an easier wind-down routine.',
  morning_light: 'Use morning light to anchor rhythm.',
  caffeine_cutoff: 'Make caffeine timing more intentional.',
  recovery_spacing: 'Space recovery before harder efforts.',
  balanced: 'Keep recovery guidance balanced.'
};

/** The answers that speak to each foundation, with a short label for reading them back. */
const ANSWERS_FOR: Record<ScoredDomain, { key: OnboardingQuestion['key']; label: string }[]> = {
  recovery_rhythm: [
    { key: 'morning_rested_score', label: 'Waking up rested' },
    { key: 'overnight_waking', label: 'Waking in the night' },
    { key: 'bedtime', label: 'Usual bedtime' },
    { key: 'wake_time', label: 'Usual wake time' }
  ],
  nourishment: [
    { key: 'water_intake', label: 'Water most days' },
    { key: 'post_meal_energy', label: 'Energy after meals' },
    { key: 'meal_cadence', label: 'How you eat' },
    { key: 'diet_quality_score', label: 'Eating pattern' }
  ],
  mind_life_load: [
    { key: 'daily_stress_score', label: 'Daily stress' },
    { key: 'daily_schedule', label: 'Your days' }
  ],
  movement_capacity: [
    { key: 'weekly_training_days', label: 'Training days a week' },
    { key: 'recovery_between_sessions', label: 'Between sessions' },
    { key: 'non_fitness_activity', label: 'The rest of the day' }
  ]
};

const QUESTIONS = new Map(onboardingQuestions.map((question) => [question.key, question]));

/** One answer as the person chose it, in the questionnaire's own words. Null when unanswered. */
export function answerText(key: OnboardingQuestion['key'], value: OnboardingAnswerValue | undefined): string | null {
  const question = QUESTIONS.get(key);
  if (!question || value === undefined || value === null || value === '') return null;
  if (question.type === 'time') {
    const time = normalizeTimeAnswer(value);
    return time ? formatClockText(time) : null;
  }
  if (question.type === 'scale') {
    const bucket = question.scaleLabels?.find((item) => item.value === value);
    return bucket ? bucket.label : typeof value === 'number' ? `${value} of ${question.max ?? 10}` : null;
  }
  if (Array.isArray(value)) {
    const labels = value.map((item) => question.options?.find((option) => option.value === item)?.label).filter((label): label is string => Boolean(label));
    return labels.length ? labels.join(', ') : null;
  }
  if (typeof value === 'string') {
    return question.options?.find((option) => option.value === value)?.label ?? (question.type === 'text' ? value.trim() || null : null);
  }
  return null;
}

export type ReviewAnswerRow = { label: string; value: string };

export type PersonalReview = {
  focus: { id: FoundationDomain; name: string; summary: string; priority: string; secondary: string | null; confidence: string };
  /** Why this focus: the person's own answers that the focus rests on. */
  why: { goal: string | null; flagged: string | null; rows: ReviewAnswerRow[] };
  /** The engine's own top reasons, in its order. */
  stoodOut: { domain: string; label: string; explanation: string }[];
  foundations: {
    id: ScoredDomain;
    name: string;
    score: number;
    priority: PriorityBand;
    attention: string;
    level: 1 | 2 | 3;
    lead: string;
    isFocus: boolean;
  }[];
  firstFourteenDays: { when: string; title: string; lines: string[] }[];
};

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function reassessmentDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '';
}

/** The domains the "why" section reads answers from: the focus, or for a balanced start the engine's top reasons. */
function whyDomains(profile: BiweeklyFocusProfile): ScoredDomain[] {
  if (profile.primary_focus !== 'balanced') {
    return [profile.primary_focus, ...(profile.secondary_focus && profile.secondary_focus !== 'balanced' && profile.secondary_focus !== profile.primary_focus ? [profile.secondary_focus] : [])];
  }
  const fromReasons = profile.dynamic_score_sheet.ranked_reasons.map((reason) => reason.domain);
  const unique = [...new Set(fromReasons)].slice(0, 2);
  return unique.length ? unique : ['recovery_rhythm'];
}

export function buildPersonalReview(profile: BiweeklyFocusProfile, answers: OnboardingAnswers): PersonalReview {
  const sheet = profile.dynamic_score_sheet;
  const domains = whyDomains(profile);
  const rows: ReviewAnswerRow[] = [];
  for (const domain of domains) {
    for (const item of ANSWERS_FOR[domain]) {
      const value = answerText(item.key, answers[item.key]);
      if (value && rows.length < 5) rows.push({ label: item.label, value });
    }
  }

  const goal = answerText('primary_goal', answers.primary_goal);
  const flaggedValue = answers.blocking_factors;
  const flagged = Array.isArray(flaggedValue) && flaggedValue.includes('no_clear_issue') ? null : answerText('blocking_factors', flaggedValue);

  return {
    focus: {
      id: profile.primary_focus,
      name: focusName(profile.primary_focus),
      summary: sheet.summary,
      priority: `${capitalised(sheet.overall_priority)} priority`,
      secondary: profile.secondary_focus && profile.secondary_focus !== 'balanced' && profile.secondary_focus !== profile.primary_focus
        ? FOUNDATION_NAMES[profile.secondary_focus]
        : null,
      confidence: `${capitalised(profile.confidence)} confidence`
    },
    why: { goal, flagged, rows },
    stoodOut: sheet.ranked_reasons.slice(0, 3).map((reason) => ({ domain: FOUNDATION_NAMES[reason.domain], label: reason.label, explanation: reason.explanation })),
    foundations: FOUNDATION_ORDER.map((id) => {
      const domain = sheet.domain_scores[id];
      return {
        id,
        name: FOUNDATION_NAMES[id],
        score: Math.round(domain.score),
        priority: domain.priority,
        attention: ATTENTION[domain.priority].word,
        level: ATTENTION[domain.priority].level,
        lead: domain.reasons[0]?.label ?? 'Still forming from your first answers.',
        isFocus: profile.primary_focus === id
      };
    }),
    firstFourteenDays: [
      {
        when: 'Days 1–7',
        title: 'Calibrate',
        lines: ['Log sleep, meals and movement as they happen. Your real patterns replace these first answers, and confidence rises as the days fill in.']
      },
      {
        when: 'Through day 14',
        title: 'Your focus, day to day',
        lines: [
          recoveryBiasLabels[profile.recovery_bias],
          nourishmentBiasLabels[profile.nourishment_bias],
          trainingBiasLabels[profile.training_bias],
          lifestyleBiasLabels[profile.lifestyle_bias]
        ]
      },
      {
        when: `Day 14${reassessmentDate(profile.reassessment_due_at) ? ` · ${reassessmentDate(profile.reassessment_due_at)}` : ''}`,
        title: 'Check in again',
        lines: ['A short reassessment of what changed. Your focus can move with it.']
      }
    ]
  };
}

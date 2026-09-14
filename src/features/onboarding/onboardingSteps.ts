import type { OnboardingAnswerValue, OnboardingQuestion } from '../../types/onboarding';
import { onboardingQuestions } from './onboardingQuestions';

/**
 * Onboarding as three steps rather than seventeen screens.
 *
 * The questions themselves are kept, because sixteen of them feed the scoring in
 * onboardingV2Model and dropping them would quietly degrade the first plan. What
 * changes is the pacing: related questions are answered together on one scrollable
 * step instead of behind seventeen separate taps.
 *
 * The split is by what the answers are used for, not by question type:
 *
 *  1. Focus — the goal, which is worth up to 35 points in every domain and is the
 *     single most influential answer in the model.
 *  2. Sleep and daily load — the recovery and life-load signals.
 *  3. Food and movement — the remaining domain detail, mostly optional so the flow
 *     can be finished quickly and sharpened later.
 *
 * Steps 1 and 2 alone supply eight answers, which is the threshold
 * generateOnboardingV2Result needs to mark a baseline complete. That is deliberate:
 * someone who skips the optional detail still gets a usable baseline rather than a
 * half-finished one.
 */

export type OnboardingStepId = 'focus' | 'rhythm' | 'fuel';

export type OnboardingStep = {
  id: OnboardingStepId;
  /** Shown as the step's heading. */
  title: string;
  /** One line on why the step is being asked. */
  intro: string;
  questions: OnboardingQuestion[];
};

function question(key: OnboardingQuestion['key'], overrides: Partial<OnboardingQuestion> = {}): OnboardingQuestion {
  const found = onboardingQuestions.find((item) => item.key === key);
  if (!found) throw new Error(`Unknown onboarding question: ${key}`);
  return { ...found, ...overrides };
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'focus',
    title: 'What matters most',
    intro: 'This sets the shape of your first plan. One answer carries more weight than anything else here.',
    questions: [
      question('primary_goal'),
      question('blocking_factors')
    ]
  },
  {
    id: 'rhythm',
    title: 'Sleep and daily load',
    intro: 'Your sleep window anchors every timing suggestion Healthi makes, so these are worth answering properly.',
    questions: [
      question('bedtime'),
      question('wake_time'),
      question('morning_rested_score'),
      question('overnight_waking'),
      question('daily_stress_score'),
      question('daily_schedule')
    ]
  },
  {
    id: 'fuel',
    title: 'Food and movement',
    intro: 'Two quick ones, then optional detail you can skip and add later from your profile.',
    questions: [
      question('weekly_training_days'),
      question('diet_quality_score'),
      // Optional from here: each sharpens a domain score, none is needed for a usable
      // baseline, and the app keeps learning these from what actually gets logged.
      question('training_types', { optional: true }),
      question('recovery_between_sessions', { optional: true }),
      question('non_fitness_activity', { optional: true }),
      question('meal_cadence', { optional: true }),
      question('water_intake', { optional: true }),
      question('post_meal_energy', { optional: true })
    ]
  }
];

/** Flat order, for persistence and for anything that walks every question. */
export const onboardingStepQuestions: OnboardingQuestion[] = onboardingSteps.flatMap((step) => step.questions);

/** Questions that must be answered before a step will advance. */
export function requiredQuestions(step: OnboardingStep): OnboardingQuestion[] {
  return step.questions.filter((item) => !item.optional);
}

/**
 * Accepts the ways people actually write a time and returns 24-hour `HH:MM`.
 *
 * The questions ask for 24-hour input, but "10:30 pm", "7am" and "2230" are all
 * common and all unambiguous, so they are understood rather than rejected. Anything
 * genuinely ambiguous returns null and the field stays in an unanswered state.
 */
export function normalizeTimeAnswer(value: OnboardingAnswerValue | undefined): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!text) return null;

  const match = /^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/.exec(text);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  const meridiem = match[3];

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;

  if (meridiem === 'am') {
    if (hours < 1 || hours > 12) return null;
    if (hours === 12) hours = 0;
  } else if (meridiem === 'pm') {
    if (hours < 1 || hours > 12) return null;
    if (hours !== 12) hours += 12;
  } else if (hours > 23) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

import type { DataConfidence } from '../../types/common';

/**
 * Where someone's body clock sits, asked rather than measured.
 *
 * Measurement is better and takes two weeks. A person who has just installed the app has
 * no nights logged, so the schedule it suggests on day one is either a guess dressed as a
 * plan or a blank. This asks six questions instead, and hands back a starting position
 * that measurement then overrides night by night.
 *
 * The anchor is mid-sleep on free days — the midpoint between falling asleep and waking
 * when nothing sets an alarm. It is the most useful single thing to know about a body
 * clock, and it is the same quantity estimateCircadianPhase tracks from logged nights, so
 * the answer plugs straight in as a prior rather than needing translation.
 *
 * The questions, the wording and the bands are Healthi's own. Published morningness
 * questionnaires are someone else's instrument, and the popular animal-named chronotype
 * schemes are somebody's brand; neither is reproduced here.
 */

export type ChronotypeId =
  | 'early_clock'
  | 'early_leaning'
  | 'middle_clock'
  | 'late_leaning'
  | 'late_clock';

export type ChronotypeQuestion = {
  id: string;
  prompt: string;
  /** Why this is being asked, shown so the quiz does not feel arbitrary. */
  note?: string;
  /**
   * Each answer carries an offset in minutes from a middle clock: negative is earlier.
   * `weight` says how much this question is trusted relative to the others.
   */
  weight: number;
  options: Array<{ value: string; label: string; offsetMinutes: number }>;
};

const FREE_DAY_OPTIONS = [
  { value: 'very_early', label: 'Before 6:30am', offsetMinutes: -120 },
  { value: 'early', label: '6:30 – 7:30am', offsetMinutes: -60 },
  { value: 'middle', label: '7:30 – 9:00am', offsetMinutes: 0 },
  { value: 'late', label: '9:00 – 10:30am', offsetMinutes: 60 },
  { value: 'very_late', label: 'After 10:30am', offsetMinutes: 120 }
];

export const CHRONOTYPE_QUESTIONS: readonly ChronotypeQuestion[] = [
  {
    id: 'free_day_wake',
    prompt: 'On a day with nothing to get up for, when do you wake on your own?',
    note: 'No alarm, nowhere to be. This one tells us the most.',
    weight: 3,
    options: FREE_DAY_OPTIONS
  },
  {
    id: 'free_day_sleep',
    prompt: 'On those same days, when do you actually fall asleep?',
    weight: 2,
    options: [
      { value: 'very_early', label: 'Before 10pm', offsetMinutes: -120 },
      { value: 'early', label: '10 – 11pm', offsetMinutes: -60 },
      { value: 'middle', label: '11pm – 12:30am', offsetMinutes: 0 },
      { value: 'late', label: '12:30 – 2am', offsetMinutes: 60 },
      { value: 'very_late', label: 'After 2am', offsetMinutes: 120 }
    ]
  },
  {
    id: 'morning_alertness',
    prompt: 'How long after waking before you feel properly awake?',
    note: 'Everyone is groggy for a while. The question is how long.',
    weight: 1.5,
    options: [
      { value: 'immediate', label: 'Almost straight away', offsetMinutes: -75 },
      { value: 'short', label: 'Half an hour or so', offsetMinutes: -30 },
      { value: 'medium', label: 'An hour or two', offsetMinutes: 20 },
      { value: 'long', label: 'Most of the morning', offsetMinutes: 75 }
    ]
  },
  {
    id: 'sharpest',
    prompt: 'When is your head at its clearest?',
    weight: 1.5,
    options: [
      { value: 'early_morning', label: 'Early morning', offsetMinutes: -90 },
      { value: 'mid_morning', label: 'Mid morning', offsetMinutes: -30 },
      { value: 'afternoon', label: 'Afternoon', offsetMinutes: 30 },
      { value: 'evening', label: 'Evening or later', offsetMinutes: 100 }
    ]
  },
  {
    id: 'training_preference',
    prompt: 'If you could train whenever you liked, when would it feel best?',
    weight: 1,
    options: [
      { value: 'early_morning', label: 'Early morning', offsetMinutes: -75 },
      { value: 'midday', label: 'Around midday', offsetMinutes: -15 },
      { value: 'late_afternoon', label: 'Late afternoon', offsetMinutes: 20 },
      { value: 'evening', label: 'Evening', offsetMinutes: 80 }
    ]
  },
  {
    id: 'evening_sleepiness',
    prompt: 'Left alone with no screens or plans, when does sleepiness arrive?',
    weight: 2,
    options: [
      { value: 'very_early', label: 'Before 9:30pm', offsetMinutes: -105 },
      { value: 'early', label: '9:30 – 10:30pm', offsetMinutes: -45 },
      { value: 'middle', label: '10:30pm – midnight', offsetMinutes: 0 },
      { value: 'late', label: 'Midnight – 1:30am', offsetMinutes: 55 },
      { value: 'very_late', label: 'Later than that', offsetMinutes: 110 }
    ]
  }
];

/** Mid-sleep for a middle clock: 03:30, the midpoint of roughly 11:30pm to 7:30am. */
export const MIDDLE_CLOCK_MID_SLEEP_MINUTES = 3 * 60 + 30;

export type ChronotypeResult = {
  chronotype: ChronotypeId;
  label: string;
  /** What this means for the person, in their terms. */
  summary: string;
  /** Preferred mid-sleep, minutes past midnight. The prior for the phase estimate. */
  preferredMidSleepMinutes: number;
  /** Offset from a middle clock; negative is earlier. */
  offsetMinutes: number;
  answeredCount: number;
  confidence: DataConfidence;
  reason_codes: string[];
};

const BANDS: Array<{ id: ChronotypeId; upTo: number; label: string; summary: string }> = [
  {
    id: 'early_clock',
    upTo: -75,
    label: 'Early clock',
    summary: 'Your body wants to start and finish the day early. Mornings are yours; late evenings will cost you more than they cost most people.'
  },
  {
    id: 'early_leaning',
    upTo: -25,
    label: 'Slightly early clock',
    summary: 'You lean early. Mornings work well once you are up, and late nights are recoverable but not free.'
  },
  {
    id: 'middle_clock',
    upTo: 25,
    label: 'Middle clock',
    summary: 'Your clock sits near the middle, which means most ordinary schedules fit you without much argument.'
  },
  {
    id: 'late_leaning',
    upTo: 75,
    label: 'Slightly late clock',
    summary: 'You lean late. Early starts are workable but you will feel them, and your best hours arrive after lunch.'
  },
  {
    id: 'late_clock',
    upTo: Number.POSITIVE_INFINITY,
    label: 'Late clock',
    summary: 'Your body wants a later day than most schedules allow. That is a clock, not a habit — the useful question is how much of the gap you can close and how much you plan around.'
  }
];

/** Weighted mean of the answers given; unanswered questions are dropped, not assumed. */
export function scoreChronotype(answers: Record<string, string>): ChronotypeResult {
  let weighted = 0;
  let weight = 0;
  let answeredCount = 0;

  for (const question of CHRONOTYPE_QUESTIONS) {
    const chosen = question.options.find((option) => option.value === answers[question.id]);
    if (!chosen) continue;
    weighted += chosen.offsetMinutes * question.weight;
    weight += question.weight;
    answeredCount += 1;
  }

  const offsetMinutes = weight === 0 ? 0 : Math.round(weighted / weight);
  const band = BANDS.find((candidate) => offsetMinutes <= candidate.upTo) ?? BANDS[BANDS.length - 1];

  /*
   * A quiz is a starting position and says so. Even a complete one is medium at best:
   * what someone believes about their mornings and what their clock actually does are
   * different things, and two weeks of logged nights will settle it either way.
   */
  const confidence: DataConfidence = answeredCount === 0
    ? 'low'
    : answeredCount >= CHRONOTYPE_QUESTIONS.length - 1
      ? 'medium'
      : 'low';

  return {
    chronotype: band.id,
    label: band.label,
    summary: band.summary,
    preferredMidSleepMinutes: (MIDDLE_CLOCK_MID_SLEEP_MINUTES + offsetMinutes + 1440) % 1440,
    offsetMinutes,
    answeredCount,
    confidence,
    reason_codes: [
      `chronotype_${band.id}`,
      'chronotype_self_reported',
      ...(answeredCount < CHRONOTYPE_QUESTIONS.length ? ['chronotype_partially_answered'] : []),
      ...(answeredCount === 0 ? ['chronotype_not_answered'] : [])
    ]
  };
}

export type DaySlot = {
  id: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  /** Why this sits here, so a person can disagree with the reason and not just the time. */
  why: string;
};

const wrap = (minutes: number) => ((minutes % 1440) + 1440) % 1440;

/**
 * Suggested times are rounded to the quarter hour.
 *
 * A weighted mean of six answers lands wherever it lands, and the unrounded result read
 * "Sleep 11:56pm · Last coffee 3:56pm · Wake 7:56am" — arithmetic showing its working
 * rather than advice somebody would follow. The quarter hour is also the step the nudge
 * buttons move in, so a schedule stays on clean times however much it is adjusted.
 */
const SLOT_GRANULARITY_MINUTES = 15;
const toSlotTime = (minutes: number) =>
  wrap(Math.round(minutes / SLOT_GRANULARITY_MINUTES) * SLOT_GRANULARITY_MINUTES);

/**
 * A day built around the clock the quiz found.
 *
 * Offered, not imposed: the caller shows this for acceptance, and a person who knows their
 * own afternoons better than a questionnaire does can move a slot. Timings follow the
 * ordinary shape of a day — grogginess clears an hour or two after waking, attention is
 * best before the early-afternoon lull, body temperature and power peak in the late
 * afternoon, and the couple of hours before sleep are when winding down does something.
 */
export function suggestDayArchitecture(params: {
  preferredMidSleepMinutes: number;
  sleepNeedMinutes?: number;
}): DaySlot[] {
  const need = params.sleepNeedMinutes ?? 8 * 60;
  const mid = params.preferredMidSleepMinutes;
  const wake = toSlotTime(mid + need / 2);
  const sleep = toSlotTime(mid - need / 2);

  return [
    {
      id: 'wake',
      label: 'Wake',
      startMinutes: wake,
      endMinutes: toSlotTime(wake + 30),
      why: 'The midpoint of the sleep your answers point to, with your sleep need either side of it.'
    },
    {
      id: 'morning_light',
      label: 'Get outside',
      startMinutes: wake,
      endMinutes: toSlotTime(wake + 90),
      why: 'Light early in your day is the strongest thing you have for holding the clock where you want it.'
    },
    {
      id: 'deep_work',
      label: 'Hardest thinking',
      startMinutes: toSlotTime(wake + 120),
      endMinutes: toSlotTime(wake + 300),
      why: 'Grogginess has cleared by now and the early-afternoon lull has not arrived.'
    },
    {
      id: 'afternoon_dip',
      label: 'Lighter work',
      startMinutes: toSlotTime(wake + 420),
      endMinutes: toSlotTime(wake + 540),
      why: 'Most people flatten out here. Easier to plan around it than to fight it.'
    },
    {
      id: 'training',
      label: 'Best window to train',
      startMinutes: toSlotTime(wake + 540),
      endMinutes: toSlotTime(wake + 720),
      why: 'Strength and power tend to sit highest in the late afternoon of your own day.'
    },
    {
      id: 'caffeine_cutoff',
      label: 'Last coffee',
      startMinutes: toSlotTime(sleep - 480),
      endMinutes: toSlotTime(sleep - 480),
      why: 'Caffeine is still working on you many hours after it stops feeling like it is.'
    },
    {
      id: 'wind_down',
      label: 'Wind down',
      startMinutes: toSlotTime(sleep - 60),
      endMinutes: sleep,
      why: 'Sleep arrives more easily after a slope than after a cliff.'
    },
    {
      id: 'sleep',
      label: 'Sleep',
      startMinutes: sleep,
      endMinutes: wake,
      why: 'Your sleep need, placed around the midpoint your answers point to.'
    }
  ];
}

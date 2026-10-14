import { composeFoundationScore } from '../foundations/composeFoundationScore';
import type { FoundationContributor, FoundationScore } from '../foundations/foundationTypes';

/**
 * Mind + Life Load: how much the day is asking of someone, against what they have to meet
 * it with, and whether they have reset at all.
 *
 * Built from signals the app already holds rather than from a mood rating: last night's
 * sleep against need, how full today's plan is, the morning check-in's "is today
 * demanding" and "how is your energy", a pulse reading against that person's own usual
 * range, and whether a reset has happened yet. Every one is something the app can be
 * wrong about and the person can check.
 *
 * Missing signals lower confidence, never the score: a term nobody reported is dropped
 * and the rest renormalised, the same as every other pillar. Resets only ever count in
 * someone's favour — a day without one logged is a day the app did not see one, not a
 * failure — so the term is either fully supportive or absent.
 *
 * General wellness guidance only. Nothing here reads stress hormones, mood disorders or
 * any clinical state, and the copy says "load" because that is all it measures.
 */

export type MindPulseBand = 'typical' | 'above' | 'well_above' | 'below' | 'well_below';

export type MindScoreInput = {
  date: string;
  /** Last night, against the person's sleep need. Null when no night was logged. */
  sleep?: { minutes: number | null; needMinutes: number | null } | null;
  /** Blocks in today's plan. Null when there is no plan to read, which is not an empty day. */
  scheduleBlocks?: number | null;
  /** Today's check-in answers. */
  checkin?: { demand: 'usual' | 'demanding' | 'unknown'; energy: 'steady' | 'tired' | 'unknown' } | null;
  /** Today's latest resting pulse against the person's usual range. */
  pulseBand?: MindPulseBand | null;
  /** What was done today on the Mood tab. */
  resets?: { breathingSeconds: number; tensionReleases: number; morningLightMinutes: number; habitsDone: number } | null;
  /** The latest "How's your head?" answer today, 1 (overloaded) to 5 (clear). */
  head?: { rating: 1 | 2 | 3 | 4 | 5 } | null;
};

export type MindSuggestion = {
  id: 'morning_light' | 'settle_before_block' | 'settle_and_recheck' | 'steady_lift' | 'wind_down' | 'keep_one_reset';
  title: string;
  detail: string;
  /** The breathing technique the suggestion opens, when it is a breathing one. */
  techniqueId: string | null;
  reason_codes: string[];
};

export type MindScore = FoundationScore & { suggestion: MindSuggestion };

/*
 * The person's own answer about their head carries as much as their plan does. Energy is
 * lighter than the rest because Movement reads it too.
 */
const WEIGHTS = { sleep: 0.3, schedule: 0.15, demand: 0.15, head: 0.15, energy: 0.05, pulse: 0.1, resets: 0.1 } as const;
const HEAD_WORDS = { 1: 'overloaded', 2: 'tense', 3: 'okay', 4: 'steady', 5: 'clear' } as const;
const DEFAULT_NEED_MINUTES = 480;

const hours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

function sleepTerm(sleep: MindScoreInput['sleep']): FoundationContributor {
  const minutes = sleep?.minutes ?? null;
  const need = sleep?.needMinutes ?? DEFAULT_NEED_MINUTES;
  // Full credit at need, none three hours short of it: the range that matters for a day.
  const value = minutes === null ? null : (minutes - (need - 180)) / 180;
  return {
    id: 'sleep', label: 'Sleep', weight: WEIGHTS.sleep, value,
    detail: minutes === null ? 'No sleep logged for last night.' : `${hours(minutes)} of your ${hours(need)} need.`
  };
}

function scheduleTerm(blocks: number | null | undefined): FoundationContributor {
  const known = typeof blocks === 'number' && blocks > 0;
  const value = !known ? null : blocks >= 8 ? 0.25 : blocks >= 6 ? 0.45 : blocks >= 4 ? 0.7 : 0.9;
  return {
    id: 'schedule', label: 'Today’s plan', weight: WEIGHTS.schedule, value,
    detail: !known ? 'No plan for today yet.' : `${blocks} ${blocks === 1 ? 'block' : 'blocks'} planned today.`
  };
}

function demandTerm(checkin: MindScoreInput['checkin']): FoundationContributor {
  const demand = checkin?.demand ?? 'unknown';
  return {
    id: 'demand', label: 'Today’s demand', weight: WEIGHTS.demand,
    value: demand === 'demanding' ? 0.35 : demand === 'usual' ? 0.85 : null,
    detail: demand === 'demanding' ? 'You described today as demanding.' : demand === 'usual' ? 'You described today as usual.' : 'Not answered today.'
  };
}

function headTerm(head: MindScoreInput['head']): FoundationContributor {
  const rating = head?.rating ?? null;
  return {
    id: 'head', label: 'How your head is', weight: WEIGHTS.head,
    value: rating === null ? null : (rating - 1) / 4,
    detail: rating === null ? 'No check-in yet today.' : `You said your head is ${HEAD_WORDS[rating]}.`
  };
}

function energyTerm(checkin: MindScoreInput['checkin']): FoundationContributor {
  const energy = checkin?.energy ?? 'unknown';
  return {
    id: 'energy', label: 'Energy', weight: WEIGHTS.energy,
    value: energy === 'tired' ? 0.4 : energy === 'steady' ? 0.85 : null,
    detail: energy === 'tired' ? 'You reported feeling tired.' : energy === 'steady' ? 'You reported steady energy.' : 'Not answered today.'
  };
}

function pulseTerm(band: MindPulseBand | null | undefined): FoundationContributor {
  const value = !band ? null : band === 'well_above' ? 0.3 : band === 'above' ? 0.55 : 0.9;
  const detail = !band ? 'No resting pulse today.'
    : band === 'well_above' ? 'Resting pulse well above your usual.'
      : band === 'above' ? 'Resting pulse a little above your usual.'
        : 'Resting pulse in or below your usual range.';
  return { id: 'pulse', label: 'Resting pulse', weight: WEIGHTS.pulse, value, detail };
}

function resetTerm(resets: MindScoreInput['resets']): FoundationContributor {
  const done = [
    (resets?.breathingSeconds ?? 0) >= 60 ? `${Math.round((resets?.breathingSeconds ?? 0) / 60)} min breathing` : null,
    (resets?.morningLightMinutes ?? 0) > 0 ? `${resets?.morningLightMinutes} min morning light` : null,
    (resets?.tensionReleases ?? 0) > 0 ? 'a tension release' : null,
    (resets?.habitsDone ?? 0) > 0 ? `${resets?.habitsDone} ${resets?.habitsDone === 1 ? 'habit' : 'habits'}` : null
  ].filter((item): item is string => item !== null);
  return {
    id: 'resets', label: 'Resets', weight: WEIGHTS.resets,
    value: done.length ? 1 : null,
    detail: done.length ? `Done today: ${done.join(', ')}.` : 'No reset logged yet today.'
  };
}

/** One thing to do, chosen by what weighs most and the time of day. */
export function suggestMindReset(limiters: FoundationContributor[], localHour: number, morningLightMinutes = 0): MindSuggestion {
  const top = limiters[0]?.id;
  if (top === 'sleep' && localHour < 12 && morningLightMinutes < 10) {
    return { id: 'morning_light', title: 'Ten minutes outside this morning', detail: 'After a short night, morning light helps set the day’s rhythm. Log it under Daylight.', techniqueId: null, reason_codes: ['limited_by_sleep', 'morning_window'] };
  }
  if (top === 'sleep' && localHour >= 18) {
    return { id: 'wind_down', title: 'An earlier wind-down tonight', detail: 'Last night ran short. A few minutes of slow breathing can ease the step into sleep.', techniqueId: 'wind_down', reason_codes: ['limited_by_sleep', 'evening_window'] };
  }
  if (top === 'head') {
    return { id: 'settle_and_recheck', title: 'Two minutes of Settle, then check in again', detail: 'In for four, out for eight. Say how your head is before and after, and see what it does for you.', techniqueId: 'settle', reason_codes: ['limited_by_head'] };
  }
  if (top === 'schedule' || top === 'demand') {
    return { id: 'settle_before_block', title: 'Two minutes of Settle before your next block', detail: 'A full day goes better with a short pause between things. In for four, out for eight.', techniqueId: 'settle', reason_codes: [`limited_by_${top}`] };
  }
  if (top === 'pulse') {
    return { id: 'settle_and_recheck', title: 'Settle, then check your pulse again', detail: 'A few minutes of slow breathing, then a fresh reading. One reading on its own says little.', techniqueId: 'settle', reason_codes: ['limited_by_pulse'] };
  }
  if (top === 'energy' || top === 'sleep') {
    return { id: 'steady_lift', title: 'A steady minute to lift your energy', detail: 'Even breathing, in and out for the same count, without pushing.', techniqueId: 'steady', reason_codes: [`limited_by_${top}`] };
  }
  return { id: 'keep_one_reset', title: 'Keep one reset in the day', detail: 'A minute of Settle is enough to keep the habit easy to reach for.', techniqueId: 'settle', reason_codes: ['no_limiter'] };
}

export function calculateMindScore(input: MindScoreInput, localHour = 12): MindScore {
  const score = composeFoundationScore({
    domain: 'mind_life_load',
    date: input.date,
    contributors: [
      sleepTerm(input.sleep),
      scheduleTerm(input.scheduleBlocks),
      demandTerm(input.checkin),
      headTerm(input.head),
      energyTerm(input.checkin),
      pulseTerm(input.pulseBand),
      resetTerm(input.resets)
    ],
    summarise: (value, limiters) => {
      if (value === null) return 'Not enough to read yet. Log last night’s sleep, add today’s plan, or say how your head is.';
      const heaviest = limiters[0]?.label.toLowerCase();
      if (value >= 75 || !heaviest) return 'Today’s load looks manageable.';
      return value >= 55 ? `A moderate load today. ${limiters[0].label} is the heaviest part.` : `A heavy load today. ${limiters[0].label} is weighing most.`;
    }
  });
  return { ...score, suggestion: suggestMindReset(score.limiters, localHour, input.resets?.morningLightMinutes ?? 0) };
}

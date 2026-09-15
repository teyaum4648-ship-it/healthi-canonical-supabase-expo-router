/**
 * Paced breathing, as a rhythm rather than a feature.
 *
 * The app already had one of these: a circle on the Sleep wind-down tab that expanded
 * over four seconds, held, and contracted over five. It was hard-coded, which was fine
 * while it did one job at one time of day.
 *
 * It turns out to be the wrong shape for two reasons. A long exhale settles you and a
 * matched one steadies you, and those are different requests — so the ratio has to be an
 * argument. And every zone exercise in Chek's book is specified the same way, *natural
 * slow breathing pace, 2–20 minutes*, which means a breathing exercise is a zone
 * exercise with no movement attached and the same component can pace both.
 *
 * Hence a table. Each rhythm exists for a stated reason, because a ratio with no reason
 * behind it is just a number someone picked.
 */

export type BreathPhase = 'inhale' | 'hold' | 'exhale';

export type BreathRhythm = {
  id: string;
  name: string;
  /** Why this one rather than another. Shown, not just commented. */
  purpose: string;
  inhaleMs: number;
  holdMs: number;
  exhaleMs: number;
};

export const BREATH_RHYTHMS: BreathRhythm[] = [
  {
    id: 'settle',
    name: 'Settle',
    purpose: 'Exhale twice as long as the inhale. The longest lever you have on a racing morning.',
    inhaleMs: 4000,
    holdMs: 0,
    exhaleMs: 8000
  },
  {
    id: 'wind_down',
    name: 'Wind down',
    purpose: 'The pace already used before sleep: in, a pause at the top, then a slower way out.',
    inhaleMs: 4000,
    holdMs: 3500,
    exhaleMs: 5000
  },
  {
    id: 'steady',
    name: 'Steady',
    purpose: 'Equal in and out. For holding a line rather than coming down off something.',
    inhaleMs: 4000,
    holdMs: 4000,
    exhaleMs: 4000
  },
  {
    id: 'zone',
    name: 'Zone pace',
    purpose: 'Slow and unforced — the tempo the zone exercises are written at, for moving along with.',
    inhaleMs: 5000,
    holdMs: 0,
    exhaleMs: 5000
  }
];

export function rhythmById(id: string): BreathRhythm {
  return BREATH_RHYTHMS.find((rhythm) => rhythm.id === id) ?? BREATH_RHYTHMS[0];
}

/** One full cycle, in milliseconds. */
export function cycleMs(rhythm: BreathRhythm): number {
  return rhythm.inhaleMs + rhythm.holdMs + rhythm.exhaleMs;
}

/** How many whole cycles fit in a number of minutes, which is how a session is sized. */
export function cyclesInMinutes(rhythm: BreathRhythm, minutes: number): number {
  return Math.max(1, Math.floor((minutes * 60_000) / cycleMs(rhythm)));
}

/**
 * The durations offered. The zone exercises in the book run 2–20 minutes, and nothing
 * shorter than a minute is worth starting, so the choices bracket that rather than
 * inventing a house length.
 */
export const PRACTICE_MINUTES = [1, 2, 5, 10] as const;

export type PracticeSession = {
  id: string;
  /** YYYY-MM-DD, the day it belongs to. */
  date: string;
  rhythmId: string;
  /** What was actually completed, which is not always what was chosen. */
  seconds: number;
  finishedAt: string;
};

export type PracticeDay = {
  sessions: PracticeSession[];
  totalSeconds: number;
  /** Null when nothing has been done today, so the screen can say that instead of "0". */
  lastRhythm: BreathRhythm | null;
};

export function summarisePracticeDay(sessions: PracticeSession[], date: string): PracticeDay {
  const today = sessions
    .filter((session) => session.date === date)
    .sort((left, right) => left.finishedAt.localeCompare(right.finishedAt));
  return {
    sessions: today,
    totalSeconds: today.reduce((sum, session) => sum + session.seconds, 0),
    lastRhythm: today.length > 0 ? rhythmById(today[today.length - 1].rhythmId) : null
  };
}

/** "4 minutes across 2 sessions" — the day in the words a person would use. */
export function practiceDayLine(day: PracticeDay): string {
  if (day.sessions.length === 0) return 'Nothing yet today.';
  const minutes = Math.round(day.totalSeconds / 60);
  const span = minutes < 1
    ? `${day.totalSeconds} seconds`
    : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  if (day.sessions.length === 1) return `${span} today.`;
  return `${span} today, across ${day.sessions.length} sessions.`;
}

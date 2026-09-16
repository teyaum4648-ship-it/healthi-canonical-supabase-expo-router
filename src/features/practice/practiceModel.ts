import { techniqueById } from './breathTechniques';
import type { BreathTechnique } from './breathTechniques';

/**
 * What a breathing session is, once it has been done.
 *
 * The techniques themselves live in `breathTechniques.ts`; this is the record side —
 * what happened, on which day, for how long. Kept apart because content and history
 * change for different reasons: adding a technique should not touch how a day is
 * summarised, and vice versa.
 */

export type PracticeSession = {
  id: string;
  /** YYYY-MM-DD, the day it belongs to. */
  date: string;
  /**
   * The technique's id. Named `rhythmId` because rows written by earlier builds use that
   * key and the ids themselves did not change; renaming it would orphan everything
   * already on a device for no gain.
   */
  rhythmId: string;
  /** What was actually completed, which is not always what was chosen. */
  seconds: number;
  finishedAt: string;
};

/**
 * The durations offered. Long enough to matter at the bottom, short enough to finish at
 * the top; the movement practices this also paces run two to twenty minutes.
 */
export const PRACTICE_MINUTES = [1, 2, 5, 10] as const;

export type PracticeDay = {
  sessions: PracticeSession[];
  totalSeconds: number;
  /** Null when nothing has been done today, so the screen can say that instead of "0". */
  lastTechnique: BreathTechnique | null;
  /** Distinct techniques used today, in the order first used. */
  techniqueIds: string[];
};

export function summarisePracticeDay(sessions: PracticeSession[], date: string): PracticeDay {
  const today = sessions
    .filter((session) => session.date === date)
    .sort((left, right) => left.finishedAt.localeCompare(right.finishedAt));
  return {
    sessions: today,
    totalSeconds: today.reduce((sum, session) => sum + session.seconds, 0),
    lastTechnique: today.length > 0 ? techniqueById(today[today.length - 1].rhythmId) : null,
    techniqueIds: [...new Set(today.map((session) => session.rhythmId))]
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

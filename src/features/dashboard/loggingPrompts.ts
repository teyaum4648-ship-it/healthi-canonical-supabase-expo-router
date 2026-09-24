import type { PillarId } from '../../styles/pillarColors';

export type LoggingPromptId = 'sleep' | 'checkin' | 'food' | 'movement';

export type LoggingPromptRow = {
  id: LoggingPromptId;
  pillar: PillarId;
  pillarName: string;
  icon: 'moon-outline' | 'pulse-outline' | 'nutrition-outline' | 'barbell-outline';
  /** What is known about this right now, in plain words. */
  status: string;
  /** True when today already has something here, so the row reads as done rather than asked for. */
  done: boolean;
  actionLabel: string;
};

export type LoggingPromptInput = {
  /** Whether last night is missing from today's recovery evidence. */
  sleepMissing: boolean;
  /** Today's latest check-in, or null for none; undefined when it cannot be known here. */
  checkin?: { at: string; stale: boolean } | null;
  mealsToday: number;
  /** Water entries today, or null when water is not loaded here. */
  waterToday: number | null;
  /** Sessions in the last seven days, or null when that is not known here. */
  sessionsThisWeek: number | null;
  clock: (iso: string) => string;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The four things a person can add to make today's estimate more complete, in a fixed order.
 *
 * This is what "Why this estimate?" leads with. It used to open on nine unknowns written as
 * sentences with nothing to press, some of them in the engine's own terms, so the one thing
 * a person could do about an estimate — add what it is missing — was not offered where they
 * were looking. Each row now says what is known and carries the action that changes it.
 *
 * The order never moves. A row that is done stays where it was and says so; rows that jump
 * about as they are completed are harder to scan than rows that simply fill in.
 */
export function loggingPrompts(input: LoggingPromptInput): LoggingPromptRow[] {
  const checkin = input.checkin;
  const checkinRow: LoggingPromptRow = checkin === undefined
    ? { id: 'checkin', pillar: 'mind_life_load', pillarName: 'Mind + Life Load', icon: 'pulse-outline', status: 'How today has felt so far', done: false, actionLabel: 'Check in' }
    : checkin === null
      ? { id: 'checkin', pillar: 'mind_life_load', pillarName: 'Mind + Life Load', icon: 'pulse-outline', status: 'No check-in today', done: false, actionLabel: 'Check in' }
      : checkin.stale
        ? { id: 'checkin', pillar: 'mind_life_load', pillarName: 'Mind + Life Load', icon: 'pulse-outline', status: 'Your check-in is over two hours old', done: false, actionLabel: 'Update' }
        : { id: 'checkin', pillar: 'mind_life_load', pillarName: 'Mind + Life Load', icon: 'pulse-outline', status: `Checked in at ${input.clock(checkin.at)}`, done: true, actionLabel: 'Update' };

  const water = input.waterToday;
  const food = input.mealsToday > 0
    ? `${plural(input.mealsToday, 'meal')} logged today${water ? ' · water too' : ''}`
    : water === null ? 'No meals logged today' : water > 0 ? 'Water logged, no meals yet' : 'No food or water logged today';

  const sessions = input.sessionsThisWeek;
  const movement = sessions === null
    ? 'Log a session to count it this week'
    : sessions === 0 ? 'No sessions in the last 7 days' : `${plural(sessions, 'session')} in the last 7 days`;

  return [
    {
      id: 'sleep', pillar: 'recovery_rhythm', pillarName: 'Recovery + Rhythm', icon: 'moon-outline',
      status: input.sleepMissing ? 'Last night isn’t logged yet' : 'Last night is counted',
      done: !input.sleepMissing, actionLabel: input.sleepMissing ? 'Add sleep' : 'Edit'
    },
    checkinRow,
    {
      id: 'food', pillar: 'nourishment', pillarName: 'Nourishment', icon: 'nutrition-outline',
      status: food, done: input.mealsToday > 0, actionLabel: input.mealsToday > 0 ? 'Add more' : 'Log food'
    },
    {
      id: 'movement', pillar: 'movement_capacity', pillarName: 'Movement Capacity', icon: 'barbell-outline',
      status: movement, done: (sessions ?? 0) > 0, actionLabel: (sessions ?? 0) > 0 ? 'Log another' : 'Log one'
    }
  ];
}

import type { MindPulseBand, MindScoreInput } from '../../engines/mind';
import type { ReadinessCheckin } from '../dashboard/readinessNow';
import { lastSevenDays } from '../dashboard/weekCards';
import { localDay } from '../../utils/localDay';
import type { DaylightDay } from './daylightModel';
import type { HabitDay } from './moodHabits';
import type { PracticeDay, PracticeSession } from './practiceModel';
import { comparePulse, isRestingContext, type PulseBaseline, type PulseReading } from './pulseModel';
import type { ZoneDay } from './zoneModel';
import { latestHeadCheck, type HeadCheck } from './headCheck';

/**
 * What the Mood tab's Today view is built from: the day's signals, gathered from the
 * stores that already hold them, in the shape the Mind + Life Load engine reads.
 */

type SleepLike = { date: string; duration_minutes: number | null; sleep_end_at?: string | null };

/** Last night is the session that ended today. The latest one, if a nap was logged too. */
export function lastNightMinutes(sessions: readonly SleepLike[], today: string): number | null {
  const tonight = sessions.filter((session) => session.date === today && typeof session.duration_minutes === 'number');
  if (!tonight.length) return null;
  const longest = tonight.reduce((best, session) => (session.duration_minutes! > best.duration_minutes! ? session : best));
  return longest.duration_minutes;
}

/** The latest check-in made today, whatever time it was answered. */
export function todaysCheckin(checkins: readonly ReadinessCheckin[], today: string): MindScoreInput['checkin'] {
  const latest = checkins.filter((checkin) => localDay(checkin.at) === today).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return latest ? { demand: latest.demand, energy: latest.energy } : null;
}

/** Today's latest resting reading against the person's usual range, once there is one. */
export function todaysPulseBand(readings: readonly PulseReading[], baseline: PulseBaseline | null, today: string): MindPulseBand | null {
  if (!baseline) return null;
  const latest = readings.filter((reading) => reading.date === today && isRestingContext(reading.context))
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt)).at(-1);
  return latest ? comparePulse(latest.bpm, baseline).band : null;
}

export function moodScoreInput(input: {
  today: string;
  sleepSessions: readonly SleepLike[];
  sleepNeedMinutes: number | null;
  scheduleBlocks: number | null;
  checkins: readonly ReadinessCheckin[];
  pulses: readonly PulseReading[];
  baseline: PulseBaseline | null;
  practice: PracticeDay;
  daylight: DaylightDay;
  zones: ZoneDay;
  habits: HabitDay;
  heads?: readonly HeadCheck[];
}): MindScoreInput {
  const minutes = lastNightMinutes(input.sleepSessions, input.today);
  const head = latestHeadCheck(input.heads ?? [], input.today);
  return {
    date: input.today,
    sleep: minutes === null ? null : { minutes, needMinutes: input.sleepNeedMinutes },
    scheduleBlocks: input.scheduleBlocks,
    checkin: todaysCheckin(input.checkins, input.today),
    pulseBand: todaysPulseBand(input.pulses, input.baseline, input.today),
    resets: {
      breathingSeconds: input.practice.totalSeconds,
      tensionReleases: input.zones.sessions.length,
      morningLightMinutes: input.daylight.morningMinutes,
      habitsDone: input.habits.done
    },
    head: head ? { rating: head.rating } : null
  };
}

export type MoodRing = { id: 'breathing' | 'light' | 'habits' | 'release'; label: string; value: string; fraction: number };

/**
 * Today's levers as rings. Targets are general guidance and fill to full rather than past
 * it; an empty ring is today not started yet, never a mark against anyone.
 */
export function moodRings(day: { practice: PracticeDay; daylight: DaylightDay; habits: HabitDay; zones: ZoneDay }): MoodRing[] {
  const minutes = Math.floor(day.practice.totalSeconds / 60);
  const fill = (value: number, target: number) => Math.max(0, Math.min(1, target > 0 ? value / target : 0));
  return [
    { id: 'breathing', label: 'Breathing', value: `${minutes} of 5 min`, fraction: fill(day.practice.totalSeconds, 300) },
    { id: 'light', label: 'Morning light', value: `${day.daylight.morningMinutes} of 10 min`, fraction: fill(day.daylight.morningMinutes, 10) },
    { id: 'habits', label: 'Habits', value: `${day.habits.done} of ${day.habits.total}`, fraction: fill(day.habits.done, day.habits.total) },
    { id: 'release', label: 'Release', value: day.zones.sessions.length ? 'Done' : 'Not yet', fraction: day.zones.sessions.length ? 1 : 0 }
  ];
}

export type MoodWeekDay = { day: string; letter: string; minutes: number; isToday: boolean };

/** Breathing minutes for each of the last seven days, today last. */
export function moodWeek(practice: readonly PracticeSession[], today: string): MoodWeekDay[] {
  return lastSevenDays(today).map((day) => {
    const seconds = practice.filter((session) => session.date === day).reduce((sum, session) => sum + session.seconds, 0);
    const letter = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
    return { day, letter, minutes: Math.round(seconds / 60), isToday: day === today };
  });
}

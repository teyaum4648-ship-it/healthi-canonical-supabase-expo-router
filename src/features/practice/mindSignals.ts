import type { GenerateDailyReadinessInput } from '../../engines/readiness';
import type { ReadinessCheckin } from '../dashboard/readinessNow';
import { createReadinessNowDemoStore } from '../dashboard/readinessNowStore';
import type { DaylightBout } from './daylightModel';
import { localDaylightStore } from './daylightModel';
import { latestHeadCheck, localHeadCheckStore, type HeadCheck } from './headCheck';
import { todaysCheckin, todaysPulseBand } from './moodDashboardModel';
import { localHabitCompletionStore, type HabitCompletion } from './moodHabits';
import type { PracticeSession } from './practiceModel';
import { localPracticeStore } from './practiceStore';
import { localPulseStore, pulseBaseline, type PulseReading } from './pulseModel';
import { localZoneStore, type ZoneSession } from './zoneModel';

/**
 * Today's Mind + Life Load entries for readiness, from what the Mood tab and the check-in
 * already store. Sleep is left out because Recovery + Rhythm already counts it.
 */

export type MindEntries = {
  checkins: readonly ReadinessCheckin[];
  pulses: readonly PulseReading[];
  practice: readonly PracticeSession[];
  zones: readonly ZoneSession[];
  daylight: readonly DaylightBout[];
  habits: readonly HabitCompletion[];
  heads: readonly HeadCheck[];
};

export const EMPTY_MIND_ENTRIES: MindEntries = { checkins: [], pulses: [], practice: [], zones: [], daylight: [], habits: [], heads: [] };

/** A breathing session shorter than this was opened, not done. */
const MIN_BREATHING_SECONDS = 60;

export function mindReadinessSignals(entries: MindEntries, today: string): GenerateDailyReadinessInput['mind'] | null {
  const head = latestHeadCheck(entries.heads, today);
  const checkin = todaysCheckin(entries.checkins, today);
  const demand = checkin?.demand === 'usual' || checkin?.demand === 'demanding' ? checkin.demand : null;
  const pulseBand = todaysPulseBand(entries.pulses, pulseBaseline([...entries.pulses]), today);
  const resets =
    entries.practice.filter((row) => row.date === today && row.seconds >= MIN_BREATHING_SECONDS).length +
    entries.zones.filter((row) => row.date === today).length +
    entries.daylight.filter((row) => row.date === today && row.minutes > 0).length +
    entries.habits.filter((row) => row.date === today).length;

  if (!head && !demand && !pulseBand && resets === 0) return null;
  return {
    head_rating: head?.rating ?? null,
    demand,
    pulse_band: pulseBand,
    resets_today: resets,
    confidence: 'medium',
    reason_codes: ['mind_entries_today']
  };
}

type Storage = Parameters<typeof createReadinessNowDemoStore>[0];

/** Reads every store the signals come from. A store that fails reads as empty. */
export async function loadMindEntries(scope: string, storage: Storage): Promise<MindEntries> {
  const safe = <T,>(promise: Promise<T[]>) => promise.catch(() => [] as T[]);
  const [practice, pulses, daylight, zones, habits, heads, checkins] = await Promise.all([
    safe(localPracticeStore.read(scope)),
    safe(localPulseStore.read(scope)),
    safe(localDaylightStore.read(scope)),
    safe(localZoneStore.read(scope)),
    safe(localHabitCompletionStore.read(scope)),
    safe(localHeadCheckStore.read(scope)),
    createReadinessNowDemoStore(storage).read().then((data) => data.checkins).catch(() => [] as ReadinessCheckin[])
  ]);
  return { practice, pulses, daylight, zones, habits, heads, checkins };
}

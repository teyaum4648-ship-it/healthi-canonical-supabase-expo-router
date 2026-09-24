import type { SleepInterval, SleepSession } from '../../engines/circadian';
import { SLEEP_SOURCE_PRIORITY } from '../sleepRhythm/sleepWindowEngine';

/**
 * Sleep and steps from Apple Health or Health Connect, turned into what Healthi stores.
 *
 * This is the half of the integration that does not need the phone: the shapes the two
 * platforms hand back, how they become nights and daily step counts, and the rule that an
 * import never overwrites a night the person logged or confirmed themselves. The native
 * reader is a separate module that implements `HealthSource`; until it is added, the app
 * uses `unavailableHealthSource` and nothing here runs.
 */

export type HealthPlatform = 'healthkit' | 'health_connect';

/** One sleep sample as either platform reports it, reduced to what matters here. */
export type ImportedSleepSample = { start: string; end: string; stage: 'in_bed' | 'asleep' | 'awake' };
export type ImportedStepSample = { start: string; end: string; count: number };
export type DailySteps = { date: string; steps: number };

export type HealthSource = {
  platform: HealthPlatform | null;
  isAvailable(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  readSleep(since: string, until: string): Promise<ImportedSleepSample[]>;
  readSteps(since: string, until: string): Promise<ImportedStepSample[]>;
};

/** What the web build and Expo Go get: nothing to connect to, and nothing pretended. */
export const unavailableHealthSource: HealthSource = {
  platform: null,
  isAvailable: async () => false,
  requestPermission: async () => false,
  readSleep: async () => [],
  readSteps: async () => []
};

/** A gap this long between asleep samples starts a new night rather than an awakening. */
const NIGHT_BREAK_MS = 3 * 60 * 60 * 1000;
/** Shorter than this is a nap or noise, not a night the rhythm engine should learn from. */
const MIN_NIGHT_MINUTES = 120;

type WallClock = { date: string; iso: string };

/**
 * The same instant as wall-clock time in a zone, written on the UTC axis.
 *
 * The Sleep tab stores times this way — "11:05 PM" is 23:05 on the UTC clock, whatever
 * zone the person is in — so an imported 03:05Z night in New York has to arrive as 23:05
 * the evening before, not three hours into the next day.
 */
export function wallClock(instant: string, timeZone: string): WallClock {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, iso: `${date}T${parts.hour}:${parts.minute}:${parts.second}.000Z` };
}

const minutesBetween = (start: string, end: string) => Math.max(0, (Date.parse(end) - Date.parse(start)) / 60000);

/**
 * Nights from raw samples: asleep samples close together make one night, in-bed samples
 * are ignored (lying awake in bed is not sleep), and a night is dated by the morning it
 * ends on, the way the Sleep tab dates the nights people log themselves.
 */
export function sleepSessionsFromSamples(samples: ImportedSleepSample[], platform: HealthPlatform, timeZone: string, importedAt: string): SleepSession[] {
  const useful = samples
    .filter((sample) => sample.stage !== 'in_bed' && Number.isFinite(Date.parse(sample.start)) && Date.parse(sample.end) > Date.parse(sample.start))
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start));

  const nights: ImportedSleepSample[][] = [];
  for (const sample of useful) {
    const current = nights[nights.length - 1];
    const lastEnd = current ? Math.max(...current.map((item) => Date.parse(item.end))) : -Infinity;
    if (!current || Date.parse(sample.start) - lastEnd > NIGHT_BREAK_MS) nights.push([sample]);
    else current.push(sample);
  }

  return nights.flatMap((night) => {
    const asleep = night.filter((sample) => sample.stage === 'asleep');
    const minutes = Math.round(asleep.reduce((sum, sample) => sum + minutesBetween(sample.start, sample.end), 0));
    if (!asleep.length || minutes < MIN_NIGHT_MINUTES) return [];
    const start = wallClock(asleep[0]!.start, timeZone);
    const end = wallClock(asleep.reduce((latest, sample) => Date.parse(sample.end) > Date.parse(latest.end) ? sample : latest).end, timeZone);
    const intervals: SleepInterval[] = night.map((sample, index) => ({
      id: `${platform}-${end.date}-${index}`,
      state: sample.stage === 'awake' ? 'awake' : 'asleep',
      start_at: wallClock(sample.start, timeZone).iso,
      end_at: wallClock(sample.end, timeZone).iso
    }));
    return [{
      date: end.date,
      sleep_start_at: start.iso,
      sleep_end_at: end.iso,
      duration_minutes: minutes,
      source: platform,
      source_confidence: 'high' as const,
      timezone: timeZone,
      sleep_intervals: intervals,
      reason_codes: [`imported_from_${platform}`],
      created_at: importedAt
    }];
  });
}

/**
 * The imported nights that may be saved. A night already logged, confirmed or corrected by
 * the person outranks an import and is kept; an earlier import of the same night is
 * replaced by the fresher one.
 */
export function importableSleep(existing: SleepSession[], imported: SleepSession[]): SleepSession[] {
  return imported.filter((night) => !existing.some((current) =>
    current.date.slice(0, 10) === night.date
    && (current.confirmed_by_user || current.corrected_by_user || SLEEP_SOURCE_PRIORITY[current.source] > SLEEP_SOURCE_PRIORITY[night.source])
  ));
}

/** Steps summed by the local day each sample started on. */
export function dailyStepsFromSamples(samples: ImportedStepSample[], timeZone: string): DailySteps[] {
  const byDay = new Map<string, number>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.count) || sample.count <= 0 || !Number.isFinite(Date.parse(sample.start))) continue;
    const date = wallClock(sample.start, timeZone).date;
    byDay.set(date, (byDay.get(date) ?? 0) + Math.round(sample.count));
  }
  return [...byDay.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, steps]) => ({ date, steps }));
}

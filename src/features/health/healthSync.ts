import type { SleepSession } from '../../engines/circadian';
import { createScopedLogStore, isRecord } from '../practice/scopedLogStore';
import { dailyStepsFromSamples, importableSleep, sleepSessionsFromSamples, type HealthPlatform, type HealthSource } from './healthImport';

export type StepsDay = { date: string; steps: number; source: HealthPlatform; importedAt: string };

function isStepsDay(value: unknown): value is StepsDay {
  return isRecord(value) && typeof value.date === 'string' && typeof value.steps === 'number' && typeof value.source === 'string' && typeof value.importedAt === 'string';
}

/** Daily step counts brought in from a health app; one row per day, replaced on each sync. */
export const localStepsStore = createScopedLogStore<StepsDay>({ key: 'healthi:health:steps:v1', isRow: isStepsDay, cap: 120 });

export type HealthSyncResult = { nightsSaved: number; nightsKept: number; stepDays: number };

/**
 * Bring the last week in. Nights the person logged themselves are kept as they are, and
 * the count of those is reported so the screen can say so rather than silently skip.
 */
export async function syncHealth(source: HealthSource, deps: {
  scope: string;
  timeZone: string;
  now: Date;
  readSleep(): Promise<SleepSession[]>;
  saveSleep(session: SleepSession): Promise<void>;
}): Promise<HealthSyncResult | null> {
  if (!source.platform || !(await source.isAvailable())) return null;
  if (!(await source.requestPermission())) throw new Error('Healthi wasn’t given access. You can allow it in your phone’s Health settings.');
  const until = deps.now.toISOString();
  const since = new Date(deps.now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [sleepSamples, stepSamples, existing] = await Promise.all([source.readSleep(since, until), source.readSteps(since, until), deps.readSleep()]);

  const nights = sleepSessionsFromSamples(sleepSamples, source.platform, deps.timeZone, until);
  const toSave = importableSleep(existing, nights);
  for (const night of toSave) await deps.saveSleep(night);

  const steps = dailyStepsFromSamples(stepSamples, deps.timeZone);
  const current = await localStepsStore.read(deps.scope);
  const updated = new Map(current.map((row) => [row.date, row]));
  for (const day of steps) updated.set(day.date, { ...day, source: source.platform, importedAt: until });
  await localStepsStore.replace(deps.scope, [...updated.values()].sort((left, right) => left.date.localeCompare(right.date)));

  return { nightsSaved: toSave.length, nightsKept: nights.length - toSave.length, stepDays: steps.length };
}

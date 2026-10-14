import type { ImportedSleepSample, ImportedStepSample } from './healthImport';

/**
 * What Apple Health and Health Connect hand back, reduced to the platform-neutral samples
 * healthImport works with. Kept apart from the native readers so it can be tested without
 * a phone: the readers only fetch, and everything that decides anything happens here.
 */

const iso = (value: Date | string): string | null => {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

/** HealthKit's sleep analysis values: 0 in bed, 2 awake, everything else a kind of asleep. */
const HEALTHKIT_IN_BED = 0;
const HEALTHKIT_AWAKE = 2;

export function healthKitSleepToSamples(rows: readonly { startDate: Date | string; endDate: Date | string; value: number }[]): ImportedSleepSample[] {
  return rows.flatMap((row) => {
    const start = iso(row.startDate);
    const end = iso(row.endDate);
    if (!start || !end) return [];
    const stage = row.value === HEALTHKIT_IN_BED ? 'in_bed' : row.value === HEALTHKIT_AWAKE ? 'awake' : 'asleep';
    return [{ start, end, stage }];
  });
}

export function healthKitStepsToSamples(rows: readonly { startDate: Date | string; endDate: Date | string; quantity: number }[]): ImportedStepSample[] {
  return rows.flatMap((row) => {
    const start = iso(row.startDate);
    const end = iso(row.endDate);
    return start && end && Number.isFinite(row.quantity) ? [{ start, end, count: row.quantity }] : [];
  });
}

/** Health Connect's stage codes: 1 awake and 3 out of bed are awake; 0 unknown is counted as asleep. */
const HEALTH_CONNECT_AWAKE = new Set([1, 3]);

export function healthConnectSleepToSamples(records: readonly {
  startTime: string;
  endTime: string;
  stages?: readonly { startTime: string; endTime: string; stage: number }[];
}[]): ImportedSleepSample[] {
  return records.flatMap((record) => {
    // A session with no stages says only that the person slept between these times.
    if (!record.stages?.length) {
      const start = iso(record.startTime);
      const end = iso(record.endTime);
      return start && end ? [{ start, end, stage: 'asleep' as const }] : [];
    }
    return record.stages.flatMap((stage) => {
      const start = iso(stage.startTime);
      const end = iso(stage.endTime);
      return start && end ? [{ start, end, stage: HEALTH_CONNECT_AWAKE.has(stage.stage) ? 'awake' as const : 'asleep' as const }] : [];
    });
  });
}

export function healthConnectStepsToSamples(records: readonly { startTime: string; endTime: string; count: number }[]): ImportedStepSample[] {
  return records.flatMap((record) => {
    const start = iso(record.startTime);
    const end = iso(record.endTime);
    return start && end && Number.isFinite(record.count) ? [{ start, end, count: record.count }] : [];
  });
}

import Constants, { ExecutionEnvironment } from 'expo-constants';

import { healthConnectSleepToSamples, healthConnectStepsToSamples } from './healthAdapters';
import type { HealthSource } from './healthImport';

/**
 * Health Connect, on Android.
 *
 * Loaded on first use, like the iPhone reader, so Expo Go reads it as unavailable rather
 * than failing. Health Connect itself can also be missing or out of date on a phone; that
 * is checked before anything is asked for.
 */

type HealthConnect = typeof import('react-native-health-connect');

let cached: HealthConnect | null | undefined;
let initialized = false;

function healthConnect(): HealthConnect | null {
  if (cached !== undefined) return cached;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily so Expo Go never touches it
    cached = require('react-native-health-connect') as HealthConnect;
  } catch {
    cached = null;
  }
  return cached;
}

async function ready(): Promise<HealthConnect | null> {
  const hc = healthConnect();
  if (!hc) return null;
  try {
    if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return null;
    if (!initialized) initialized = await hc.initialize();
    return initialized ? hc : null;
  } catch {
    return null;
  }
}

/** Every page of a read; Health Connect pages long ranges. */
async function readAll<T extends 'SleepSession' | 'Steps'>(hc: HealthConnect, recordType: T, since: string, until: string) {
  const records: Awaited<ReturnType<HealthConnect['readRecords']>>['records'] = [];
  let pageToken: string | undefined;
  do {
    const page = await hc.readRecords(recordType, { timeRangeFilter: { operator: 'between', startTime: since, endTime: until }, ascendingOrder: true, pageToken });
    records.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return records;
}

export const healthSource: HealthSource = {
  platform: 'health_connect',
  async isAvailable() {
    return (await ready()) !== null;
  },
  async requestPermission() {
    const hc = await ready();
    if (!hc) return false;
    const granted = await hc.requestPermission([
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'Steps' }
    ]);
    return granted.some((permission) => 'recordType' in permission && (permission.recordType === 'SleepSession' || permission.recordType === 'Steps'));
  },
  async readSleep(since, until) {
    const hc = await ready();
    if (!hc) return [];
    const records = await readAll(hc, 'SleepSession', since, until);
    return healthConnectSleepToSamples(records as { startTime: string; endTime: string; stages?: { startTime: string; endTime: string; stage: number }[] }[]);
  },
  async readSteps(since, until) {
    const hc = await ready();
    if (!hc) return [];
    const records = await readAll(hc, 'Steps', since, until);
    return healthConnectStepsToSamples(records as { startTime: string; endTime: string; count: number }[]);
  }
};

import Constants, { ExecutionEnvironment } from 'expo-constants';

import { healthKitSleepToSamples, healthKitStepsToSamples } from './healthAdapters';
import type { HealthSource } from './healthImport';

/**
 * Apple Health, on iPhone.
 *
 * The HealthKit module only exists in a build of the app made with its config plugin, so
 * it is loaded on first use rather than imported: Expo Go has no such module, and there
 * this reads as unavailable instead of crashing the app on launch.
 */

type HealthKit = typeof import('@kingstinct/react-native-healthkit');

let cached: HealthKit | null | undefined;

function healthKit(): HealthKit | null {
  if (cached !== undefined) return cached;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily so Expo Go never touches it
    cached = require('@kingstinct/react-native-healthkit') as HealthKit;
  } catch {
    cached = null;
  }
  return cached;
}

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;

export const healthSource: HealthSource = {
  platform: 'healthkit',
  async isAvailable() {
    const hk = healthKit();
    if (!hk) return false;
    try {
      return await hk.isHealthDataAvailableAsync();
    } catch {
      return false;
    }
  },
  async requestPermission() {
    const hk = healthKit();
    if (!hk) return false;
    // HealthKit never says whether reading was allowed; this is whether the request was made.
    return hk.requestAuthorization({ toRead: [SLEEP, STEPS] });
  },
  async readSleep(since, until) {
    const hk = healthKit();
    if (!hk) return [];
    const rows = await hk.queryCategorySamples(SLEEP, { limit: 0, ascending: true, filter: { date: { startDate: new Date(since), endDate: new Date(until) } } });
    return healthKitSleepToSamples(rows.map((row) => ({ startDate: row.startDate, endDate: row.endDate, value: Number(row.value) })));
  },
  async readSteps(since, until) {
    const hk = healthKit();
    if (!hk) return [];
    const rows = await hk.queryQuantitySamples(STEPS, { limit: 0, ascending: true, unit: 'count', filter: { date: { startDate: new Date(since), endDate: new Date(until) } } });
    return healthKitStepsToSamples(rows.map((row) => ({ startDate: row.startDate, endDate: row.endDate, quantity: row.quantity })));
  }
};

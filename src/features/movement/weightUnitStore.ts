import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_WEIGHT_UNIT, isWeightUnit, type WeightUnit } from './weightUnits';

/**
 * The unit new sets are entered in. Lives in app Settings rather than in Move,
 * so the logging surface stays free of configuration during a workout.
 *
 * Changing it never rewrites history: existing sets keep the unit they were
 * recorded in.
 */

const STORAGE_KEY = 'healthi:movement:weightUnit:v1';

const isUuid = (value: string | null | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

/** User-scoped key segment, matching the other local stores. */
export function weightUnitScope(userId: string | null | undefined): string {
  return isUuid(userId) ? userId : 'demo';
}

function keyFor(scope: string): string {
  return `${STORAGE_KEY}:${scope}`;
}

export async function readWeightUnit(scope: string): Promise<WeightUnit> {
  try {
    const stored = await AsyncStorage.getItem(keyFor(scope));
    return isWeightUnit(stored) ? stored : DEFAULT_WEIGHT_UNIT;
  } catch {
    return DEFAULT_WEIGHT_UNIT;
  }
}

export async function writeWeightUnit(scope: string, unit: WeightUnit): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(scope), unit);
  } catch {
    // A failed preference write must never interrupt logging.
  }
}

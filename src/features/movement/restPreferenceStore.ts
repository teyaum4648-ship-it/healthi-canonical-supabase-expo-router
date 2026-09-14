import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether completing a set starts a rest timer.
 *
 * A rest timer is a preference, not a per-session decision — someone who trains on a
 * clock wants it every time, and someone who does not wants it never. So the answer
 * given mid-workout is the one kept, rather than being asked again tomorrow.
 *
 * It is only ever turned off from the logger, where the current state is on screen and
 * turning it back on is one tap, so the preference can never go quietly missing.
 */

const STORAGE_KEY = 'healthi:movement:restTimerEnabled:v1';

export const DEFAULT_REST_ENABLED = true;

const isUuid = (value: string | null | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

/** User-scoped key segment, matching the other local stores. */
export function restPreferenceScope(userId: string | null | undefined): string {
  return isUuid(userId) ? userId : 'demo';
}

function keyFor(scope: string): string {
  return `${STORAGE_KEY}:${scope}`;
}

export function parseRestEnabled(value: string | null): boolean {
  // Only an explicit "off" turns it off. A corrupt or missing value leaves the timer
  // running, which is the behaviour someone who never touched this setting expects.
  return value === 'off' ? false : DEFAULT_REST_ENABLED;
}

export async function readRestEnabled(scope: string): Promise<boolean> {
  try {
    return parseRestEnabled(await AsyncStorage.getItem(keyFor(scope)));
  } catch {
    return DEFAULT_REST_ENABLED;
  }
}

export async function writeRestEnabled(scope: string, enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(scope), enabled ? 'on' : 'off');
  } catch {
    // A failed preference write must never interrupt logging.
  }
}

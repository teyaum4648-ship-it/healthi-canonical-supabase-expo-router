import AsyncStorage from '@react-native-async-storage/async-storage';

import { ALLERGEN_GROUPS, type AllergenGroup } from './allergens';

/**
 * The allergen groups a person has asked Healthi to watch for.
 *
 * Stored locally and per user, like the other preference stores. A read failure returns an
 * empty list, which turns the flagging off rather than guessing at a profile — the opposite
 * default would be worse, since a wrong list is more dangerous here than no list at all.
 *
 * This is a convenience for spotting declarations on a label. It is not a safety system,
 * and nothing in Healthi ever tells a person a food is free of an allergen.
 */

const STORAGE_KEY = 'healthi:nutrition:allergenProfile:v1';

const isUuid = (value: string | null | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

/** User-scoped key segment, matching the other local stores. */
export function allergenProfileScope(userId: string | null | undefined): string {
  return isUuid(userId) ? userId : 'demo';
}

function keyFor(scope: string): string {
  return `${STORAGE_KEY}:${scope}`;
}

export function isAllergenGroup(value: unknown): value is AllergenGroup {
  return typeof value === 'string' && (ALLERGEN_GROUPS as readonly string[]).includes(value);
}

/** Drops anything unrecognized rather than failing the whole profile. */
export function parseAllergenProfile(value: unknown): AllergenGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<AllergenGroup>();
  for (const entry of value) if (isAllergenGroup(entry)) seen.add(entry);
  // Canonical order, so the UI is stable regardless of the order they were picked in.
  return ALLERGEN_GROUPS.filter((group) => seen.has(group));
}

export async function readAllergenProfile(scope: string): Promise<AllergenGroup[]> {
  try {
    const stored = await AsyncStorage.getItem(keyFor(scope));
    if (!stored) return [];
    return parseAllergenProfile(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
}

export async function writeAllergenProfile(scope: string, groups: AllergenGroup[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(scope), JSON.stringify(parseAllergenProfile(groups)));
  } catch {
    // A failed preference write must never interrupt logging.
  }
}

export function toggleAllergenGroup(groups: AllergenGroup[], group: AllergenGroup): AllergenGroup[] {
  const next = groups.includes(group) ? groups.filter((item) => item !== group) : [...groups, group];
  return parseAllergenProfile(next);
}

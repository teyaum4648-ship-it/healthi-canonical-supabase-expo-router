import { createScopedLogStore, isRecord } from '../practice/scopedLogStore';

/**
 * Caffeine, logged by the drink.
 *
 * The energy model has always had a term for caffeine still on board, and nothing fed it,
 * so the curve on the Sleep tab drew every day as if it were uncaffeinated. One tap per
 * drink is the least that can fill it: amounts are typical servings, not lab values, and
 * the copy says so.
 *
 * What is on board decays with a five-hour half-life, the usual adult figure. People vary
 * widely around it, which is why the cutoff copy elsewhere calls itself a starting point.
 */

export type CaffeineDrink = { id: string; name: string; mg: number; serving: string };

export const CAFFEINE_DRINKS: readonly CaffeineDrink[] = [
  { id: 'coffee', name: 'Coffee', mg: 95, serving: '8 oz brewed' },
  { id: 'espresso', name: 'Espresso', mg: 63, serving: 'single shot' },
  { id: 'tea', name: 'Black tea', mg: 47, serving: '8 oz' },
  { id: 'cold_brew', name: 'Large cold brew', mg: 200, serving: '16 oz' },
  { id: 'green_tea', name: 'Green tea', mg: 28, serving: '8 oz' },
  { id: 'energy_drink', name: 'Energy drink', mg: 160, serving: '16 oz can' },
  { id: 'cola', name: 'Cola', mg: 34, serving: '12 oz can' },
  { id: 'pre_workout', name: 'Pre-workout', mg: 200, serving: 'one scoop' }
];

export type CaffeineEntry = {
  id: string;
  /** YYYY-MM-DD, the day it belongs to. */
  date: string;
  drinkId: string;
  mg: number;
  at: string;
};

export const CAFFEINE_HALF_LIFE_HOURS = 5;
/** Past a day, what is left is too small to matter and not worth summing. */
const LOOKBACK_MS = 24 * 3_600_000;

function isEntry(value: unknown): value is CaffeineEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.date === 'string'
    && typeof value.drinkId === 'string'
    && typeof value.mg === 'number' && value.mg > 0 && value.mg <= 1000
    && typeof value.at === 'string' && Number.isFinite(Date.parse(value.at));
}

export const localCaffeineStore = createScopedLogStore<CaffeineEntry>({
  key: 'healthi:caffeine:v1',
  isRow: isEntry
});

export function drinkById(id: string): CaffeineDrink | null {
  return CAFFEINE_DRINKS.find((drink) => drink.id === id) ?? null;
}

export function createCaffeineEntry(drink: CaffeineDrink, date: string, at = new Date().toISOString()): CaffeineEntry {
  return { id: `caffeine-${Date.parse(at)}`, date, drinkId: drink.id, mg: drink.mg, at };
}

/** Milligrams still on board at `nowMs`, from everything logged in the last day. */
export function caffeineOnBoard(entries: readonly CaffeineEntry[], nowMs: number, halfLifeHours = CAFFEINE_HALF_LIFE_HOURS): number {
  const total = entries.reduce((sum, entry) => {
    const age = nowMs - Date.parse(entry.at);
    if (!(age >= 0) || age > LOOKBACK_MS) return sum;
    return sum + entry.mg * 0.5 ** (age / (halfLifeHours * 3_600_000));
  }, 0);
  return Math.round(total);
}

export function caffeineDay(entries: readonly CaffeineEntry[], date: string): { totalMg: number; count: number; last: CaffeineEntry | null } {
  const today = entries.filter((entry) => entry.date === date).sort((a, b) => a.at.localeCompare(b.at));
  return { totalMg: today.reduce((sum, entry) => sum + entry.mg, 0), count: today.length, last: today.at(-1) ?? null };
}

/**
 * Whether a drink came after the day's cutoff. The cutoff is a wall-clock time on the UTC
 * axis, the way every sleep time is held; the drink's own time is real, so it is read in
 * local hours.
 */
export function isAfterCutoff(entryAt: string, cutoffWallClock: string | null | undefined): boolean {
  if (!cutoffWallClock) return false;
  const drink = new Date(entryAt);
  const cutoff = new Date(cutoffWallClock);
  if (Number.isNaN(drink.getTime()) || Number.isNaN(cutoff.getTime())) return false;
  const drinkMinute = drink.getHours() * 60 + drink.getMinutes();
  const cutoffMinute = cutoff.getUTCHours() * 60 + cutoff.getUTCMinutes();
  // Drinks after midnight but before 5 a.m. belong to the night before, and are late.
  return drinkMinute >= cutoffMinute || drinkMinute < 5 * 60;
}

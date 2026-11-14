/** Presentation-only routes. Logging still uses each feature's existing save path. */
/**
 * The bar is the four doctors plus a way home.
 *
 * Diet, Movement and Sleep were already Chek's Dr. Diet, Dr. Movement and Dr. Quiet
 * under other names; Mood is the fourth, which the app had never had. "You" comes off
 * the bar and moves into the Home header, because a pillar and a settings screen do not
 * deserve equal standing and six tabs at phone width reads as a menu.
 */
export const mainTabs = [
  { route: 'index', label: 'Today', outline: 'home-outline', filled: 'home' },
  { route: 'food', label: 'Diet', outline: 'nutrition-outline', filled: 'nutrition' },
  { route: 'movement', label: 'Move', outline: 'body-outline', filled: 'body' },
  { route: 'rhythm', label: 'Sleep', outline: 'moon-outline', filled: 'moon' },
  { route: 'mood', label: 'Mood', outline: 'happy-outline', filled: 'happy' }
] as const;

export type QuickEntry = 'food' | 'workout' | 'sleep';

export function quickEntryHref(destination: QuickEntry, requestId = String(Date.now())) {
  const pathname = { food: '/food', workout: '/movement', sleep: '/rhythm' } as const;
  return { pathname: pathname[destination], params: { action: 'log', entry: requestId } };
}

export function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function quickEntryRequest(action: string | string[] | undefined, entry: string | string[] | undefined) {
  return firstRouteParam(action) === 'log' ? firstRouteParam(entry) ?? 'direct' : null;
}

export function shiftDay(date: string, offset: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export function dayTitle(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === shiftDay(today, -1)) return 'Yesterday';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

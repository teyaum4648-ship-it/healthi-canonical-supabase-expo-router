/** Presentation-only routes. Logging still uses each feature's existing save path. */
export const mainTabs = [
  { route: 'index', label: 'Home', outline: 'home-outline', filled: 'home' },
  { route: 'food', label: 'Food', outline: 'nutrition-outline', filled: 'nutrition' },
  { route: 'movement', label: 'Move', outline: 'body-outline', filled: 'body' },
  { route: 'rhythm', label: 'Sleep', outline: 'moon-outline', filled: 'moon' },
  { route: 'settings', label: 'You', outline: 'person-outline', filled: 'person' }
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

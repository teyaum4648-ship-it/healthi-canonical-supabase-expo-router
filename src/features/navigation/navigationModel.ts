/** Presentation-only routes. Logging still uses each feature's existing save path. */
/**
 * The bar in the 1c "Thread" design: Today, then the four foundations.
 *
 * Only labels, icons and order changed from the earlier bar; every route is the same, so
 * deep links, quickEntryHref and every router.navigate('/food')-style call keep working.
 * Plan and the profile are not tabs: Plan sits in Today's header, and the "You" avatar
 * there opens the side menu, which replaced the old three-line Menu tab.
 */
export const mainTabs = [
  { route: 'index', label: 'Today', outline: 'sunny-outline', filled: 'sunny' },
  { route: 'rhythm', label: 'Sleep', outline: 'moon-outline', filled: 'moon' },
  { route: 'food', label: 'Food', outline: 'restaurant-outline', filled: 'restaurant' },
  { route: 'movement', label: 'Move', outline: 'walk-outline', filled: 'walk' },
  { route: 'mood', label: 'Mind', outline: 'leaf-outline', filled: 'leaf' }
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

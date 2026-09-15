import { describe, expect, it } from 'vitest';
import { dayTitle, firstRouteParam, mainTabs, quickEntryHref, quickEntryRequest, shiftDay } from '../../../src/features/navigation/navigationModel';

describe('mobile navigation contract', () => {
  it('is the four pillars plus a way home, and nothing else', () => {
    // Diet, Movement and Sleep were already Chek's Dr. Diet, Dr. Movement and Dr. Quiet
    // under other names. Mood is the fourth, which the app had never had.
    expect(mainTabs.map((tab) => tab.label)).toEqual(['Home', 'Diet', 'Movement', 'Sleep', 'Mood']);
    expect(new Set(mainTabs.map((tab) => tab.route)).size).toBe(5);
    // Plan and the profile are reached from the Home header; neither is a pillar.
    expect(mainTabs.some((tab) => String(tab.route) === 'plan')).toBe(false);
    expect(mainTabs.some((tab) => String(tab.route) === 'settings')).toBe(false);
  });

  it('renames labels without moving routes, so every deep link still resolves', () => {
    // The tabs were relabelled, not rerouted: /food is still Diet and /movement is
    // still Movement, which is what quickEntryHref and every saved link depend on.
    const byLabel = new Map(mainTabs.map((tab) => [tab.label, String(tab.route)]));
    expect(byLabel.get('Diet')).toBe('food');
    expect(byLabel.get('Movement')).toBe('movement');
    expect(byLabel.get('Sleep')).toBe('rhythm');
    expect(byLabel.get('Mood')).toBe('mood');
  });
  it.each([['food', '/food'], ['workout', '/movement'], ['sleep', '/rhythm']] as const)('opens the %s logger with a one-time intent', (destination, pathname) => {
    expect(quickEntryHref(destination, 'request-1')).toEqual({ pathname, params: { action: 'log', entry: 'request-1' } });
  });
  it('does not treat normal tab navigation or an unknown action as a log request', () => {
    expect(quickEntryRequest(undefined, undefined)).toBeNull();
    expect(quickEntryRequest('delete', 'request-1')).toBeNull();
  });
  it('handles direct links and repeated query parameters predictably', () => {
    expect(quickEntryRequest('log', undefined)).toBe('direct');
    expect(quickEntryRequest(['log', 'ignored'], ['one', 'two'])).toBe('one');
    expect(firstRouteParam([])).toBeUndefined();
  });
  it('uses calendar arithmetic across month and leap-year boundaries', () => {
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDay('2026-03-08', 1)).toBe('2026-03-09');
  });
  it('keeps Today and Yesterday explicit', () => {
    expect(dayTitle('2026-09-09', '2026-09-09')).toBe('Today');
    expect(dayTitle('2026-09-08', '2026-09-09')).toBe('Yesterday');
    expect(dayTitle('2026-09-07', '2026-09-09')).not.toBe('Today');
  });
});

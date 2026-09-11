import { afterEach, describe, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({
  value: '', cleanup: undefined as undefined | (() => void),
  resume: undefined as undefined | ((state: string) => void),
  events: new Map<string, () => void>(), removed: vi.fn()
}));
vi.mock('react', () => ({
  useState: (initial: () => string) => { harness.value = initial(); return [harness.value, (value: string) => { harness.value = value; }]; },
  useEffect: (effect: () => (() => void)) => { harness.cleanup = effect(); }
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: {
  addEventListener: (_event: string, callback: (state: string) => void) => { harness.resume = callback; return { remove: harness.removed }; }
} }));
import { useLocalToday } from '../../../src/features/navigation/useLocalToday';
import { localDay } from '../../../src/utils/localDay';

afterEach(() => { harness.cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); harness.events.clear(); });
function start() {
  vi.useFakeTimers();
  const surface = { addEventListener: (event: string, callback: () => void) => harness.events.set(event, callback), removeEventListener: (event: string) => harness.events.delete(event) };
  vi.stubGlobal('window', surface); vi.stubGlobal('document', surface);
  vi.setSystemTime(new Date(2026, 8, 10, 23, 59, 59));
  useLocalToday();
}
describe('diary clock lifecycle', () => {
  it('updates at local midnight and removes timers/listeners on unmount', () => {
    start();
    expect(harness.value).toBe('2026-09-10');
    vi.advanceTimersByTime(1100);
    expect(harness.value).toBe('2026-09-11');
    harness.cleanup?.(); harness.cleanup = undefined;
    expect(vi.getTimerCount()).toBe(0);
    expect(harness.events.size).toBe(0);
    expect(harness.removed).toHaveBeenCalled();
  });
  it('catches up when the phone wakes or the browser tab regains focus', () => {
    start();
    vi.setSystemTime(new Date(2026, 8, 12, 8));
    harness.resume?.('active');
    expect(harness.value).toBe('2026-09-12');
    vi.setSystemTime(new Date(2026, 8, 13, 9));
    harness.events.get('visibilitychange')?.();
    expect(harness.value).toBe(localDay());
    expect(harness.value).toBe('2026-09-13');
    expect(vi.getTimerCount()).toBe(1);
  });
});

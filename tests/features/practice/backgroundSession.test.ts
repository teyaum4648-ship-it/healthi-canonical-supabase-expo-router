import { afterEach, describe, expect, it, vi } from 'vitest';
const lifecycle = vi.hoisted(() => ({ listener: null as ((state: string) => void) | null, cleanup: undefined as (() => void) | undefined, remove: vi.fn() }));
vi.mock('react', () => ({ useEffect: (effect: () => (() => void) | undefined) => { lifecycle.cleanup = effect(); } }));
vi.mock('react-native', () => ({ AppState: { addEventListener: (_event: string, listener: (state: string) => void) => { lifecycle.listener = listener; return { remove: lifecycle.remove }; } } }));
import { useStopOnBackground } from '../../../src/features/practice/useStopOnBackground';
afterEach(() => { lifecycle.listener = null; lifecycle.cleanup = undefined; vi.clearAllMocks(); });
describe('Guided session interruptions', () => {
  it.each(['inactive', 'background'])('ends an active session on %s', state => {
    const stop = vi.fn(); useStopOnBackground(true, stop); lifecycle.listener?.(state); expect(stop).toHaveBeenCalledOnce();
    lifecycle.cleanup?.(); expect(lifecycle.remove).toHaveBeenCalledOnce();
  });
  it('does not restart or stop when returning to active', () => {
    const stop = vi.fn(); useStopOnBackground(true, stop); lifecycle.listener?.('active'); expect(stop).not.toHaveBeenCalled();
  });
  it('does not subscribe for an idle session', () => {
    useStopOnBackground(false, vi.fn()); expect(lifecycle.listener).toBeNull();
  });
});

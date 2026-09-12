import { describe, expect, it } from 'vitest';
import { entryDestination } from '../../../src/features/auth/entryRouting';

describe('cold-launch entry routing', () => {
  it.each(['demo', 'account'] as const)('waits for %s hydration instead of flashing onboarding', mode => {
    expect(entryDestination({ mode, isLoading: true, hasSession: true, onboardingStatus: 'completed' })).toBe('loading');
    expect(entryDestination({ mode, isLoading: true, hasSession: false })).toBe('loading');
  });
  it('shows the real demo entry instead of calling disabled account signup', () => {
    expect(entryDestination({ mode: 'demo', isLoading: false, hasSession: false })).toBe('demo');
  });
  it.each(['demo', 'account'] as const)('returns completed %s users to Home on reload', mode => {
    expect(entryDestination({ mode, isLoading: false, hasSession: true, onboardingStatus: 'completed' })).toBe('/(app)/(tabs)');
  });
  it.each(['not_started', 'in_progress', null, undefined] as const)('preserves incomplete setup (%s)', onboardingStatus => {
    expect(entryDestination({ mode: 'demo', isLoading: false, hasSession: true, onboardingStatus })).toBe('/(onboarding)');
  });
  it('never treats an old completed profile as an active account session', () => {
    expect(entryDestination({ mode: 'account', isLoading: false, hasSession: false, onboardingStatus: 'completed' })).toBe('welcome');
  });
  it('offers Continue demo when a completed local demo has been signed out', () => {
    expect(entryDestination({ mode: 'demo', isLoading: false, hasSession: false, onboardingStatus: 'completed' })).toBe('demo');
  });
  it('uses existing state without modifying it or resetting saved entries', () => {
    const state = { mode: 'demo' as const, isLoading: false, hasSession: true, onboardingStatus: 'completed' as const };
    const original = { ...state };
    entryDestination(state);
    expect(state).toEqual(original);
  });
});

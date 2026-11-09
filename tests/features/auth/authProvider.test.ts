import { describe, expect, it, vi } from 'vitest';

import {
  AuthProvider,
  parseDemoOnboardingStatus
} from '../../../src/features/auth/AuthProvider';
vi.mock('../../../src/features/auth/AccountUnavailable', () => ({ AccountUnavailable: () => null }));

vi.mock('expo-linking', () => ({ createURL: (path: string) => `healthi://${path}` }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    removeItem: vi.fn(async () => undefined),
    setItem: vi.fn(async () => undefined)
  }
}));

vi.mock('../../../src/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {}
}));

describe('AuthProvider', () => {
  it('requires onboarding for a fresh demo', () => {
    expect(parseDemoOnboardingStatus(null)).toBe('not_started');
    expect(parseDemoOnboardingStatus('true')).toBe('completed');
    expect(parseDemoOnboardingStatus('false')).toBe('in_progress');
  });

  it('selects a dedicated auth provider without invoking conditional hooks', () => {
    const element = AuthProvider({ children: 'Healthi auth' });

    expect(typeof element.type).toBe('function');
    // Missing backend settings must not mount children or silently enable demo.
    expect(element.props.children).toBeUndefined();
  });
});

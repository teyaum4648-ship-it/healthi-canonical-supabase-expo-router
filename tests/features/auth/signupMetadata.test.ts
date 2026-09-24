import { describe, expect, it, vi } from 'vitest';

import { signupMetadata } from '../../../src/features/auth/AuthProvider';

vi.mock('../../../src/lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: false }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined } }));

const consent = { version: '1', terms: true, privacy: true, healthData: true, ageConfirmed: true };

describe('signupMetadata', () => {
  it('stores the first name as both first_name and display_name, tidied', () => {
    expect(signupMetadata(consent, '  Maya   Rose ')).toEqual({ healthi_consent: consent, first_name: 'Maya Rose', display_name: 'Maya Rose' });
  });

  it('leaves the name out when none was typed, so nothing blank is stored', () => {
    expect(signupMetadata(consent, '   ')).toEqual({ healthi_consent: consent });
    expect(signupMetadata(undefined, undefined)).toEqual({});
  });
});

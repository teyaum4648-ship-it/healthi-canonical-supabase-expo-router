import { afterEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({ isSupabaseConfigured: false, supabase: {} }));
vi.mock('../../../src/lib/supabase', () => backend);
vi.mock('../../../src/features/auth/AccountUnavailable', () => ({ AccountUnavailable: () => null }));
vi.mock('expo-linking', () => ({ createURL: (path: string) => `healthi://${path}` }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('Explicit account and demo configuration', () => {
  it.each([
    ['false', false, 'AccountUnavailable'],
    [undefined, false, 'AccountUnavailable'],
    ['true', false, 'DemoAuthProvider'],
    ['true', true, 'DemoAuthProvider'],
    ['false', true, 'RemoteAuthProvider'],
    [undefined, true, 'RemoteAuthProvider']
  ] as const)('mode %s, configured %s selects %s', async (mode, configured, expected) => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', mode);
    backend.isSupabaseConfigured = configured;
    const { AuthProvider } = await import('../../../src/features/auth/AuthProvider');
    const element = AuthProvider({ children: 'protected app' });
    expect(element.type.name).toBe(expected);
    expect(element.props.children).toBe(expected === 'AccountUnavailable' ? undefined : 'protected app');
  });
});

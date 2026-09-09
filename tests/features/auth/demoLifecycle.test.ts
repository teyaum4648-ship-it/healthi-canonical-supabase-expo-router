import { describe, expect, it } from 'vitest';
import {
  demoOnboardingCompletedKey,
  demoSessionActiveKey,
  parseDemoOnboardingStatus,
  resetDemoStorage,
  resettableDemoKeys
} from '../../../src/features/auth/demoLifecycle';

function memoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); }
  };
}

describe('clean demo lifecycle', () => {
  it('never treats missing or malformed onboarding state as completed', () => {
    for (const value of [null, '', 'undefined', '{}', '1']) {
      expect(parseDemoOnboardingStatus(value)).toBe('not_started');
    }
  });

  it('resets the explicit demo stores and returns to first-time onboarding', async () => {
    const storage = memoryStorage(Object.fromEntries(resettableDemoKeys.map((key) => [key, 'saved data'])));
    await resetDemoStorage(storage);
    expect(resettableDemoKeys.every((key) => !storage.values.has(key))).toBe(true);
    expect(parseDemoOnboardingStatus(await storage.getItem(demoOnboardingCompletedKey))).toBe('not_started');
    expect(await storage.getItem(demoSessionActiveKey)).toBe('true');
  });

  it('does not remove auth tokens, account onboarding, or unrelated device settings', async () => {
    const retained = {
      'sb-beta-auth-token': 'private account session',
      'healthi:onboarding:account-id': 'account draft',
      'healthi:display-preference': 'dark'
    };
    const storage = memoryStorage(retained);
    await resetDemoStorage(storage);
    for (const [key, value] of Object.entries(retained)) expect(await storage.getItem(key)).toBe(value);
  });

  it('removes only the demo scope from mixed-account coaching records', async () => {
    const keys = ['healthi:coachingLoop:protocol:v1', 'healthi:coachingLoop:closeout:v1'];
    const storage = memoryStorage(Object.fromEntries(keys.map((key) => [key, JSON.stringify({ demo: { old: true }, accountA: { done: true }, accountB: { done: false } })])));
    await resetDemoStorage(storage);
    for (const key of keys) {
      expect(JSON.parse((await storage.getItem(key))!)).toEqual({ accountA: { done: true }, accountB: { done: false } });
    }
  });

  it('preserves corrupt mixed-account records for recovery', async () => {
    const key = 'healthi:coachingLoop:protocol:v1';
    for (const raw of ['invalid-json', '["possibly-account-data"]', 'null']) {
      const storage = memoryStorage({ [key]: raw });
      await resetDemoStorage(storage);
      expect(await storage.getItem(key)).toBe(raw);
    }
  });

  it('does not report an active fresh demo if a required storage removal fails', async () => {
    const storage = memoryStorage();
    await expect(resetDemoStorage({ ...storage, removeItem: async () => { throw new Error('Storage unavailable'); } })).rejects.toThrow('Storage unavailable');
    expect(await storage.getItem(demoSessionActiveKey)).toBeNull();
  });
});

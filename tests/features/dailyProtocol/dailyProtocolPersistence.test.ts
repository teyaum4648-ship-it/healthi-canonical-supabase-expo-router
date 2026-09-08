import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DailyProtocol } from '../../../src/engines/protocol';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    })
  }
}));

import {
  localDailyProtocolStore,
  protocolScope,
  reconcileProtocolStatuses,
  remoteDailyProtocolStoreUnavailable
} from '../../../src/features/dailyProtocol/dailyProtocolPersistence';

function protocol(overrides: Partial<DailyProtocol> = {}): DailyProtocol {
  return {
    id: 'protocol_2026-07-15',
    date: '2026-07-15',
    status: 'ready',
    day_mode: 'maintain',
    primary_focus: 'balanced',
    confidence: 'medium',
    headline: 'A steady, useful day',
    summary: 'A moderate, practical day.',
    actions: [
      { id: 'protocol_walk', title: 'Walk', detail: '', domain: 'movement_capacity', kind: 'walk', priority: 'low', status: 'pending', reason_codes: ['x'], time_hint: null },
      { id: 'protocol_hydration', title: 'Hydrate', detail: '', domain: 'nourishment', kind: 'hydration', priority: 'low', status: 'pending', reason_codes: ['x'] }
    ],
    safety: { status: 'clear', summary: '', training_allowed: true, progression_allowed: true },
    reason_codes: [],
    missing_data: [],
    ...overrides
  };
}

describe('daily protocol persistence', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('scopes signed-in users by id and everyone else to demo', () => {
    expect(protocolScope('11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
    expect(protocolScope('demo-user')).toBe('demo');
    expect(protocolScope(undefined)).toBe('demo');
  });

  it('reads null safely when nothing is stored, then round-trips a write', async () => {
    expect(await localDailyProtocolStore.read('demo', '2026-07-15')).toBeNull();
    await localDailyProtocolStore.write('demo', protocol());
    const stored = await localDailyProtocolStore.read('demo', '2026-07-15');
    expect(stored?.id).toBe('protocol_2026-07-15');
  });

  it('updates a single action status and returns null when the day is missing', async () => {
    await localDailyProtocolStore.write('demo', protocol());
    const updated = await localDailyProtocolStore.setActionStatus('demo', '2026-07-15', 'protocol_walk', 'done');
    expect(updated?.actions.find((action) => action.id === 'protocol_walk')?.status).toBe('done');

    const missing = await localDailyProtocolStore.setActionStatus('demo', '2026-01-01', 'protocol_walk', 'done');
    expect(missing).toBeNull();
  });

  it('reconciles stored action statuses onto a freshly generated protocol', () => {
    const stored = protocol({ actions: [{ id: 'protocol_walk', title: 'Walk', detail: '', domain: 'movement_capacity', kind: 'walk', priority: 'low', status: 'done', reason_codes: ['x'] }] });
    const fresh = protocol();
    expect(reconcileProtocolStatuses(fresh, null)).toEqual(fresh);
    const reconciled = reconcileProtocolStatuses(fresh, stored);
    expect(reconciled.actions.find((action) => action.id === 'protocol_walk')?.status).toBe('done');
    expect(reconciled.actions.find((action) => action.id === 'protocol_hydration')?.status).toBe('pending');
  });

  it('keeps the deferred remote store safe and inert', async () => {
    await expect(remoteDailyProtocolStoreUnavailable.read('demo', '2026-07-15')).resolves.toBeNull();
    await expect(remoteDailyProtocolStoreUnavailable.write('demo', protocol())).resolves.toBeUndefined();
    await expect(remoteDailyProtocolStoreUnavailable.setActionStatus('demo', '2026-07-15', 'protocol_walk', 'done')).resolves.toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { createReadinessNowDemoStore, readinessNowDemoKey } from '../../../src/features/dashboard/readinessNowStore';
import { defaultReadinessReminders, type ReadinessCheckin } from '../../../src/features/dashboard/readinessNow';
import { resetDemoStorage } from '../../../src/features/auth/demoLifecycle';
function storage(raw: string | null = null) {
  const values = new Map<string, string>(raw ? [[readinessNowDemoKey, raw]] : []);
  return { values, getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
}
const checkin: ReadinessCheckin = { id: 'one', at: '2026-09-11T19:00:00Z', woke_at: null, food: 'some', water: 'unknown', energy: 'steady', demand: 'usual' };
describe('device-local readiness persistence', () => {
  it('starts without synthetic check-ins and with reminders off', async () => {
    expect(await createReadinessNowDemoStore(storage()).read()).toEqual({ version: 1, owner: 'demo-user', checkins: [], reminders: defaultReadinessReminders });
  });
  it('serializes concurrent writes and hydrates both check-ins and settings', async () => {
    const device = storage(), store = createReadinessNowDemoStore(device);
    await Promise.all([store.saveCheckin(checkin), store.saveReminders({ ...defaultReadinessReminders, enabled: true }), store.saveCheckin({ ...checkin, id: 'two' })]);
    const data = await createReadinessNowDemoStore(device).read();
    expect(data.checkins).toHaveLength(2);
    expect(data.reminders.enabled).toBe(true);
  });
  it('is idempotent on a retried entry ID', async () => {
    const store = createReadinessNowDemoStore(storage());
    await store.saveCheckin(checkin); await store.saveCheckin(checkin);
    expect((await store.read()).checkins).toHaveLength(1);
  });
  it.each(['not-json', 'null', '{}', JSON.stringify({ version: 1, owner: 'account-id', checkins: [], reminders: defaultReadinessReminders })])('preserves unreadable/foreign state: %s', async raw => {
    const device = storage(raw), store = createReadinessNowDemoStore(device);
    await expect(store.read()).rejects.toThrow();
    await expect(store.saveCheckin(checkin)).rejects.toThrow();
    expect(await device.getItem(readinessNowDemoKey)).toBe(raw);
  });
  it('rejects invalid inputs without writing', async () => {
    const device = storage(), store = createReadinessNowDemoStore(device);
    await expect(store.saveCheckin({ ...checkin, food: 'invented' } as unknown as ReadinessCheckin)).rejects.toThrow();
    await expect(store.saveReminders({ ...defaultReadinessReminders, lunchTime: '25:00' })).rejects.toThrow();
    expect(device.values.size).toBe(0);
  });
  it('reports failed writes and permits a successful retry without losing existing records', async () => {
    const device = storage(); let fail = false;
    const store = createReadinessNowDemoStore({ ...device, setItem: async (k, v) => { if (fail) throw new Error('offline'); await device.setItem(k, v); } });
    await store.saveCheckin(checkin); fail = true;
    await expect(store.saveCheckin({ ...checkin, id: 'two' })).rejects.toThrow();
    expect((await store.read()).checkins).toHaveLength(1);
    fail = false; await store.saveCheckin({ ...checkin, id: 'two' });
    expect((await store.read()).checkins).toHaveLength(2);
  });
  it('clean demo reset removes this store while preserving other accounts', async () => {
    const device = storage();
    await createReadinessNowDemoStore(device).saveCheckin(checkin);
    await device.setItem('account-data', 'keep');
    await resetDemoStorage(device);
    expect(await device.getItem(readinessNowDemoKey)).toBeNull();
    expect(await device.getItem('account-data')).toBe('keep');
  });
});

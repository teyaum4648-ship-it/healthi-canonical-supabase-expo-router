import { describe, expect, it, vi } from 'vitest';
import { createDemoWaterStore, createWaterEntry, demoWaterKey, formatWater, readWater, saveWater, undoWater, waterAmountMl, waterForDay, type HydrationClient, type WaterEntry } from '../../../src/features/nutrition/hydrationStore';

function storageFixture(initial: string | null = null) {
  let value = initial;
  return { getItem: vi.fn(async () => value), setItem: vi.fn(async (_key: string, next: string) => { value = next; }) };
}
function clientFixture(data: unknown, error: object | null = null) {
  const result = { data, error };
  const query = {
    eq: vi.fn(() => query), gte: vi.fn(() => query), lt: vi.fn(() => query), order: vi.fn(() => query), select: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  };
  const table = { select: vi.fn(() => query), delete: vi.fn(() => query), upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => result) })) })) };
  const from = vi.fn(() => table);
  return { client: { from } as unknown as HydrationClient, from, table, query };
}
const entry = (amount = 250, user = 'demo-user', day = '2026-09-10') => createWaterEntry(amount, user, day, '2026-09-10T12:30:00.000Z');

describe('water logging amounts and scope', () => {
  it('supports mL and US fluid ounces with explicit input bounds', () => {
    expect(waterAmountMl('250', 'mL')).toBe(250);
    expect(waterAmountMl('8', 'fl oz')).toBe(237);
    expect(waterAmountMl('8.5', 'fl oz')).toBe(251);
    for (const value of ['', '0', '-2', '5001', 'NaN', '1e3', '250ml']) expect(waterAmountMl(value, 'mL')).toBeNull();
    expect(formatWater(237, 'fl oz')).toBe('8 fl oz');
  });
  it('filters by both selected diary day and owner', () => {
    const mine = entry();
    expect(waterForDay([mine, entry(500, 'other'), entry(500, 'demo-user', '2026-09-09')], 'demo-user', '2026-09-10')).toEqual([mine]);
    expect(mine.logged_at).toBe('2026-09-10T12:30:00.000Z');
    expect(() => createWaterEntry(0, 'demo-user', '2026-09-10')).toThrow();
    expect(() => createWaterEntry(250, 'demo-user', 'bad-day')).toThrow();
  });
  it('persists concurrent demo additions, survives remount, and undoes just the selected entry', async () => {
    const storage = storageFixture(); const store = createDemoWaterStore(storage); const first = entry(); const second = entry(500);
    await Promise.all([store.save(first), store.save(second)]);
    expect(storage.setItem).toHaveBeenCalledWith(demoWaterKey, expect.any(String));
    expect(await createDemoWaterStore(storage).read()).toEqual([first, second]);
    await store.undo(first.id);
    expect(await store.read()).toEqual([second]);
  });
  it('deduplicates a retried entry by stable id', async () => {
    const store = createDemoWaterStore(storageFixture()); const water = entry();
    await store.save(water); await store.save(water);
    expect(await store.read()).toEqual([water]);
  });
  it('never overwrites unreadable storage or mixes signed-in account data into a demo', async () => {
    const storage = storageFixture('{corrupt'); const store = createDemoWaterStore(storage);
    await expect(store.save(entry())).rejects.toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
    await expect(createDemoWaterStore(storageFixture()).save(entry(250, 'account-a'))).rejects.toThrow();
    await expect(createDemoWaterStore(storageFixture(JSON.stringify([entry(250, 'account-a')]))).read()).rejects.toThrow();
  });
  it('reports local write failure rather than claiming the entry was saved', async () => {
    const storage = storageFixture(); storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    const store = createDemoWaterStore(storage); const water = entry();
    await expect(store.save(water)).rejects.toThrow();
    expect(await store.read()).toEqual([]);
    await store.save(water);
    expect(await store.read()).toEqual([water]);
  });
});

describe('owner-protected account water persistence', () => {
  it('scopes reads to the owner and diary day', async () => {
    const water = entry(250, 'account-a'); const mock = clientFixture([water, entry(500, 'account-b')]);
    expect(await readWater(mock.client, 'account-a', '2026-09-10')).toEqual([water]);
    expect(mock.from).toHaveBeenCalledWith('hydration_logs');
    expect(mock.query.eq).toHaveBeenCalledWith('user_id', 'account-a');
    expect(mock.query.gte).toHaveBeenCalledWith('logged_at', '2026-09-10T00:00:00.000Z');
    expect(mock.query.lt).toHaveBeenCalledWith('logged_at', '2026-09-11T00:00:00.000Z');
  });
  it('upserts the same owner-scoped ID for a safe retry', async () => {
    const water = entry(250, 'account-a'); const mock = clientFixture(water);
    await saveWater(mock.client, 'account-a', water); await saveWater(mock.client, 'account-a', water);
    expect(mock.table.upsert).toHaveBeenCalledTimes(2);
    expect(mock.table.upsert).toHaveBeenLastCalledWith(water, { onConflict: 'id' });
    await expect(saveWater(mock.client, 'account-b', water)).rejects.toThrow();
    await expect(saveWater(mock.client, 'demo-user', entry())).rejects.toThrow();
    expect(mock.table.upsert).toHaveBeenCalledTimes(2);
  });
  it('scopes undo by both id and owner', async () => {
    const mock = clientFixture([]);
    await undoWater(mock.client, 'account-a', 'water-id');
    expect(mock.query.eq).toHaveBeenCalledWith('user_id', 'account-a');
    expect(mock.query.eq).toHaveBeenCalledWith('id', 'water-id');
  });
  it('surfaces server failures and rejects a mismatched returned row', async () => {
    const water = entry(250, 'account-a'); const mock = clientFixture(null, { message: 'RLS blocked' });
    await expect(readWater(mock.client, 'account-a', '2026-09-10')).rejects.toThrow();
    await expect(saveWater(mock.client, 'account-a', water)).rejects.toThrow();
    await expect(undoWater(mock.client, 'account-a', water.id)).rejects.toThrow();
    await expect(saveWater(clientFixture({ ...water, id: 'different' } satisfies WaterEntry).client, 'account-a', water)).rejects.toThrow();
  });
});

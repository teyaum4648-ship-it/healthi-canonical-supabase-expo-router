import { describe, expect, it } from 'vitest';

import { demoWaterKey } from '../../../src/features/nutrition/hydrationStore';
import { addGlassOfWater, GLASS_ML, removeWater } from '../../../src/features/nutrition/quickWater';

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
}

describe('quick water', () => {
  it('saves a labelled glass to the same demo store the Diet tab reads, and undoes it', async () => {
    const storage = memoryStorage();
    const target = { demo: true, userId: null, client: null, storage };
    const entry = await addGlassOfWater({ ...target, day: '2026-09-24' });
    expect(entry.amount_ml).toBe(GLASS_ML);
    expect(JSON.parse(storage.values.get(demoWaterKey)!)).toHaveLength(1);
    await removeWater(target, entry.id);
    expect(JSON.parse(storage.values.get(demoWaterKey)!)).toHaveLength(0);
  });

  it('refuses an account save without a signed-in client rather than writing to the demo store', async () => {
    const storage = memoryStorage();
    await expect(addGlassOfWater({ demo: false, userId: null, client: null, storage, day: '2026-09-24' })).rejects.toThrow();
    expect(storage.values.size).toBe(0);
  });
});

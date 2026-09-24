import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealLog } from '../../../src/engines/nutrition';

const storage = vi.hoisted(() => new Map<string, string>());
const failLoad = vi.hoisted(() => ({ value: false }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => (failLoad.value ? Promise.reject(new Error('storage unavailable')) : Promise.resolve(storage.get(key) ?? null))),
    setItem: vi.fn((key: string, value: string) => { storage.set(key, value); return Promise.resolve(); }),
    removeItem: vi.fn((key: string) => { storage.delete(key); return Promise.resolve(); })
  }
}));

import {
  applyLocalDemoMealResponse,
  demoNutritionMealLogsKey,
  getLocalDemoNutritionState,
  replaceLocalDemoMealLog,
  saveLocalDemoMealLogs
} from '../../../src/features/nutrition/localDemoNutritionStore';

function meal(id: string, day: string): MealLog {
  return {
    id, user_id: 'demo-user', logged_at: `${day}T12:00:00.000Z`, meal_type: 'lunch', name: `Meal ${id}`,
    source: 'manual', source_confidence: 'medium', calories: 500, protein_g: 30, carbs_g: 50, fat_g: 18,
    fiber_g: 6, sugar_g: 8, sodium_mg: 400, servings: 1, quality_flags: [], reason_codes: [],
    created_at: `${day}T12:00:00.000Z`, updated_at: `${day}T12:00:00.000Z`
  } as MealLog;
}

const history = [meal('a', '2026-09-21'), meal('b', '2026-09-22'), meal('c', '2026-09-23')];

/**
 * A screen's copy of the diary is never the authority on what is stored.
 *
 * Saving a post-meal response used to write the screen's whole meal array over storage. When
 * the demo load had failed that array was empty, so the write erased every meal the person
 * had logged — days of history gone, from an action that reads like an afterthought.
 */
describe('writing to the demo diary cannot erase what it did not read', () => {
  beforeEach(async () => { failLoad.value = false; storage.clear(); await saveLocalDemoMealLogs(history); });

  it('keeps every other day when a response is attached', async () => {
    const next = await applyLocalDemoMealResponse('b', { digestion: 'good', energy: 'steady', appetite: 'stable', cravings: 'none', notes: '' });
    expect(next.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(next.find((row) => row.id === 'b')?.user_response?.energy).toBe('steady');
    expect((await getLocalDemoNutritionState()).mealLogs).toHaveLength(3);
  });
  it('leaves the diary untouched when the response names no meal', async () => {
    expect(await applyLocalDemoMealResponse(null, { digestion: 'good', energy: 'steady', appetite: 'stable', cravings: 'none', notes: '' })).toHaveLength(3);
    expect((await getLocalDemoNutritionState()).mealLogs).toHaveLength(3);
  });
  it('leaves the diary untouched when the named meal is not there', async () => {
    await applyLocalDemoMealResponse('gone', { digestion: 'good', energy: 'steady', appetite: 'stable', cravings: 'none', notes: '' });
    expect((await getLocalDemoNutritionState()).mealLogs.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });
  it('does not write at all when the diary cannot be read', async () => {
    failLoad.value = true;
    await expect(applyLocalDemoMealResponse('b', null)).rejects.toThrow();
    failLoad.value = false;
    expect((await getLocalDemoNutritionState()).mealLogs).toHaveLength(3);
  });
  it('changes one meal on an edit and refuses one that is gone', async () => {
    const next = await replaceLocalDemoMealLog({ ...meal('b', '2026-09-22'), name: 'Edited' });
    expect(next.map((row) => row.name)).toEqual(['Meal a', 'Edited', 'Meal c']);
    await expect(replaceLocalDemoMealLog(meal('nope', '2026-09-22'))).rejects.toThrow('no longer available');
    expect((await getLocalDemoNutritionState()).mealLogs).toHaveLength(3);
  });
  it('is the only way the response screen touches stored meals', () => {
    const screen = readFileSync('app/(app)/(tabs)/food.tsx', 'utf8');
    const save = screen.slice(screen.indexOf('async function handleSaveResponse()'), screen.indexOf('function handleAnswer('));
    expect(save).toContain('applyLocalDemoMealResponse');
    expect(save).not.toContain('saveLocalDemoMealLogs');
    // Nothing outside the store may overwrite the whole collection.
    expect(screen).not.toContain('saveLocalDemoMealLogs');
  });
  it('stores nothing under the meal key until a read has happened', async () => {
    storage.clear();
    failLoad.value = true;
    await expect(applyLocalDemoMealResponse('b', null)).rejects.toThrow();
    expect(storage.has(demoNutritionMealLogsKey)).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealLog } from '../../../src/engines/nutrition';
import { demoNutritionMealLogItemsKey, demoNutritionMealLogsKey, getLocalDemoNutritionState, replaceLocalDemoMealItems } from '../../../src/features/nutrition/localDemoNutritionStore';
import { resettableDemoKeys } from '../../../src/features/auth/demoLifecycle';
const state = vi.hoisted(() => ({ values: new Map<string, string>(), failOn: '' }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: vi.fn(async (key: string) => state.values.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { if (state.failOn === key) throw new Error('Storage interrupted'); state.values.set(key, value); }),
  removeItem: vi.fn(async (key: string) => { state.values.delete(key); })
} }));
const meal: MealLog = { id: 'm1', name: 'Meal', meal_type: 'lunch', logged_at: '2026-09-10T12:00:00Z', created_at: '2026-09-10T12:00:00Z', source: 'demo', source_confidence: 'low', calories: 100, quality_flags: [], reason_codes: [] };
beforeEach(() => { state.values.clear(); state.failOn = ''; state.values.set(demoNutritionMealLogsKey, JSON.stringify([meal])); state.values.set(demoNutritionMealLogItemsKey, '[]'); });
describe('device-local meal edit commit', () => {
  it('leaves the previous meal unchanged if the journal cannot be written', async () => {
    state.failOn = 'healthi:demo:nutrition:mealEditJournal';
    await expect(replaceLocalDemoMealItems({ ...meal, calories: 200 }, [])).rejects.toThrow();
    expect(JSON.parse(state.values.get(demoNutritionMealLogsKey)!)[0].calories).toBe(100);
  });
  it('recovers an interrupted item write before showing a half-updated diary', async () => {
    state.failOn = demoNutritionMealLogItemsKey;
    await replaceLocalDemoMealItems({ ...meal, calories: 200 }, []);
    expect(state.values.has('healthi:demo:nutrition:mealEditJournal')).toBe(true);
    await expect(getLocalDemoNutritionState()).rejects.toThrow();
    state.failOn = '';
    expect((await getLocalDemoNutritionState()).mealLogs[0].calories).toBe(200);
    expect(state.values.has('healthi:demo:nutrition:mealEditJournal')).toBe(false);
  });
  it('never inserts a new diary record while editing a missing meal', async () => {
    await expect(replaceLocalDemoMealItems({ ...meal, id: 'missing' }, [])).rejects.toThrow('no longer');
    expect(JSON.parse(state.values.get(demoNutritionMealLogsKey)!)).toHaveLength(1);
  });
  it('resets saved meals and recovery data only within the explicit demo reset', () => {
    expect(resettableDemoKeys).toContain('healthi:demo:nutrition:mealCollection');
    expect(resettableDemoKeys).toContain('healthi:demo:nutrition:mealEditJournal');
  });
});

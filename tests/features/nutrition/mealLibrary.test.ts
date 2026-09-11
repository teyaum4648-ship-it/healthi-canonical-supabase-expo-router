import { describe, expect, it, vi } from 'vitest';
import type { MealLog } from '../../../src/engines/nutrition';
import { addMealBuilderItem, calculateMealBuilderTotals, removeMealBuilderItem, updateMealBuilderItemServings, validateManualProductForm, createEmptyManualProductForm } from '../../../src/features/nutrition/mealBuilder';
import { buildEditedMeal, collectMealHistory, createMealCollectionEntry, mealEntryToBuilder, mealItemToSnapshot, matchesHistory } from '../../../src/features/nutrition/mealLibrary';
import { demoMealCollectionKey, persistMealItemEdit, readMealCollection, readMealHistory, saveMealCollectionEntry } from '../../../src/features/nutrition/mealCollectionStore';
import { toMealLogItemInsert, type MealLogItemRow } from '../../../src/features/nutrition/mealItemPersistence';

const meal: MealLog = { id: 'meal-1', user_id: 'owner', name: 'Morning bowl', logged_at: '2026-09-10T08:00:00Z', created_at: '2026-09-10T08:01:00Z', meal_type: 'breakfast', source: 'manual', source_confidence: 'medium', calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4, fiber_g: null, sugar_g: 0, sodium_mg: null, quality_flags: [], reason_codes: ['manual_food_log'], user_response: { energy: 'steady' }, confirmed_by_user: true };
function food(overrides: Partial<MealLogItemRow> = {}): MealLogItemRow {
  return { ...toMealLogItemInsert({ name: 'Yogurt', brand: 'Sample Dairy', servings: 2, calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4, sugar_g: 0, meal_log_id: meal.id, meal_type: 'breakfast', logged_at: meal.logged_at, serving_size: '100 g', serving_quantity_g: 100 }, 'owner'), id: 'food-1', created_at: meal.created_at, updated_at: meal.created_at, ...overrides };
}
const store = () => { const map = new Map<string, string>(); return { map, getItem: vi.fn(async (key: string) => map.get(key) ?? null), setItem: vi.fn(async (key: string, value: string) => { map.set(key, value); }) }; };
describe('meal library and reuse', () => {
  it('pins starred meals ahead of newer unstarred meals without duplicate repeated logs', () => {
    const old = createMealCollectionEntry(meal, [food()]); old.is_starred = true;
    const repeated = { ...meal, id: 'meal-2', logged_at: '2026-09-11T08:00:00Z' };
    const latest = { ...meal, id: 'meal-3', name: 'Lunch', logged_at: '2026-09-12T12:00:00Z' };
    const list = collectMealHistory([meal, repeated, latest], [food(), food({ id: 'food-2', meal_log_id: repeated.id, servings: 1 })], [old]);
    expect(list).toHaveLength(2); expect(list[0].is_starred).toBe(true); expect(list[0].meal.id).toBe('meal-2');
    expect(collectMealHistory([meal, latest], [food()], [{ ...old, is_starred: false }])[0].meal.name).toBe('Lunch');
  });
  it('searches meals by title, brand, and contained food with case/accent normalization', () => {
    const entry = createMealCollectionEntry(meal, [food({ name: 'Açaí yogurt' })]);
    for (const query of ['MORNING', 'acai', 'sample yogurt']) expect(collectMealHistory([], [], [entry], query)).toHaveLength(1);
    expect(collectMealHistory([], [], [entry], 'bread')).toEqual([]);
    expect(matchesHistory('  whole grain ', 'Whole-Grain Bread')).toBe(true);
  });
  it('keeps saved templates separate from stars and preserves template portions after later logs', () => {
    const saved = { ...createMealCollectionEntry(meal, [food()]), is_saved: true };
    const current = { ...meal, id: 'meal-new', logged_at: '2026-09-12T08:00:00Z' };
    expect(collectMealHistory([current], [food({ servings: 3, meal_log_id: current.id })], [saved])[0].items[0].servings).toBe(2);
    expect(collectMealHistory([meal], [food()], [{ ...saved, is_saved: false, is_starred: true }], '', true)).toEqual([]);
  });
  it('reuses original per-portion nutrients without changing historical or template data', () => {
    const saved = createMealCollectionEntry(meal, [food()]); const before = JSON.stringify(saved);
    const builder = mealEntryToBuilder(saved, 'lunch');
    expect(builder.meal_type).toBe('lunch'); expect(builder.items[0].snapshot.calories_per_serving).toBe(100);
    const changed = updateMealBuilderItemServings(builder, builder.items[0].id, 3);
    expect(calculateMealBuilderTotals(changed.items).calories).toBe(300);
    expect(JSON.stringify(saved)).toBe(before);
  });
  it('does not fabricate missing nutrients or treat reported zero as missing', () => {
    const snapshot = mealItemToSnapshot(food());
    expect(snapshot.sugar_g).toBe(0); expect(snapshot.fiber_g).toBeNull(); expect(snapshot.ingredients_text).toBeNull();
    const totals = calculateMealBuilderTotals(mealEntryToBuilder(createMealCollectionEntry(meal, [food()])).items);
    expect(totals.fiber_g).toBeNull(); expect(totals.sugar_g).toBe(0);
  });
  it('adds/removes foods and changes portions while retaining diary identity and response', () => {
    const entry = createMealCollectionEntry(meal, [food(), food({ id: 'second', name: 'Fruit', calories: 50, servings: 1 })]);
    let builder = mealEntryToBuilder(entry);
    builder = removeMealBuilderItem(builder, 'reused-1');
    builder = updateMealBuilderItemServings(builder, 'reused-0', 1);
    const result = validateManualProductForm({ ...createEmptyManualProductForm(), name: 'Seeds', calories: '30', protein_g: '2' });
    if (!result.valid) throw new Error('fixture');
    builder = addMealBuilderItem(builder, { snapshot: result.snapshot, source: 'manual' });
    const updated = buildEditedMeal(meal, { ...builder, name: 'Updated bowl' }, false);
    expect(updated).toMatchObject({ id: meal.id, user_id: meal.user_id, created_at: meal.created_at, logged_at: meal.logged_at, user_response: meal.user_response, calories: 130, protein_g: 7, corrected_by_user: true });
    expect(meal.calories).toBe(200);
  });
  it('rejects empty edited meals, invalid portions and totals-only reuse', () => {
    const builder = mealEntryToBuilder(createMealCollectionEntry(meal, [food()]));
    expect(() => buildEditedMeal(meal, { ...builder, items: [] }, true)).toThrow('one food');
    expect(() => buildEditedMeal(meal, { ...builder, items: [{ ...builder.items[0], servings: NaN }] }, true)).toThrow('portions');
    expect(() => mealEntryToBuilder(createMealCollectionEntry(meal, []))).toThrow('totals only');
    expect(() => mealItemToSnapshot(food({ servings: 0 }))).toThrow('portion');
  });
  it('persists demo stars independently of saved foods and reloads them', async () => {
    const storage = store(); const entry = { ...createMealCollectionEntry(meal, [food()]), is_starred: true };
    await saveMealCollectionEntry(entry, 'demo-user', true, null, storage);
    expect(storage.map.has(demoMealCollectionKey)).toBe(true);
    expect((await readMealCollection('demo-user', true, null, storage))[0].is_starred).toBe(true);
    await saveMealCollectionEntry({ ...entry, is_saved: true }, 'demo-user', true, null, storage);
    expect(await readMealCollection(null, true, null, storage)).toHaveLength(1);
  });
  it('never uses demo storage as fallback for account library failures', async () => {
    const storage = store(); const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'offline' } }) };
    await expect(readMealCollection('owner', false, client, storage)).rejects.toThrow('could not load');
    await expect(saveMealCollectionEntry(createMealCollectionEntry(meal, [food()]), 'owner', false, client, storage)).rejects.toThrow('could not be saved');
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
    await expect(readMealCollection(null, false, client, storage)).rejects.toThrow('Sign in');
  });
  it('uses one edit RPC without allowing a replacement owner or timestamps in the meal patch', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { meal, items: [food()] }, error: null }) };
    await persistMealItemEdit(client, meal, { ...meal, name: 'Edited' }, [food()]);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc.mock.calls[0][1].meal_patch).not.toHaveProperty('user_id');
    expect(client.rpc.mock.calls[0][1].meal_patch).not.toHaveProperty('logged_at');
    expect(client.rpc.mock.calls[0][1].meal_id).toBe(meal.id);
  });
  it('searches account history server-side with bounded query and pagination', async () => {
    const page = { meals: [], items: [], foods: [], has_more: false };
    const client = { rpc: vi.fn().mockResolvedValue({ data: page, error: null }) };
    expect(await readMealHistory(client, '  older lunch  ', 50)).toBe(page);
    expect(client.rpc).toHaveBeenCalledWith('search_meal_history', { query: 'older lunch', page_offset: 50 });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDay, localDayBounds, rolloverDiaryDay } from '../../../src/utils/localDay';
import { loggedAtForDay, mealsForDay } from '../../../src/features/nutrition/foodDiaryPresentation';
import { calculateNutrientSummary, calculateFoodQuality, calculateFoodResponse, type MealLog } from '../../../src/engines/nutrition';
import { createWaterEntry, waterForDay, readWater, type HydrationClient } from '../../../src/features/nutrition/hydrationStore';
import { getMealLogsForDate, type NutritionSupabaseClient } from '../../../src/features/nutrition/persistence';
import { getMealLogItemsForDate, type MealItemSupabaseClient } from '../../../src/features/nutrition/mealItemPersistence';

const originalTz = process.env.TZ;
beforeEach(() => { process.env.TZ = 'America/Los_Angeles'; });
afterEach(() => { if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz; });
const dinner: MealLog = { id: 'thursday-dinner', name: 'Dinner', logged_at: '2026-09-11T02:30:00Z', meal_type: 'dinner', source: 'manual', source_confidence: 'high', calories: 700, protein_g: 30, carbs_g: 60, fat_g: 20, quality_flags: [], reason_codes: [], created_at: '2026-09-11T02:30:00Z' };

describe('local nutrition diary dates', () => {
  it('keeps Thursday evening on Thursday even when its stored UTC date is Friday', () => {
    const meals = [dinner];
    const before = JSON.stringify(meals);
    expect(localDay(dinner.logged_at)).toBe('2026-09-10');
    expect(mealsForDay(meals, '2026-09-10')).toEqual(meals);
    expect(mealsForDay(meals, '2026-09-11')).toEqual([]);
    expect(calculateNutrientSummary({ date: '2026-09-10', meals })).toMatchObject({ meal_count: 1, calories: 700 });
    expect(calculateNutrientSummary({ date: '2026-09-11', meals })).toMatchObject({ meal_count: 0, calories: null });
    expect(calculateFoodQuality({ date: '2026-09-11', meals }).reason_codes).toContain('food_data_missing');
    expect(calculateFoodResponse({ date: '2026-09-11', meals }).reason_codes).toContain('food_response_missing');
    expect(JSON.stringify(meals)).toBe(before);
  });
  it('puts midnight entries on the new day without duplicating yesterday', () => {
    const midnight = { ...dinner, id: 'friday', logged_at: '2026-09-11T07:00:00Z', calories: 100 };
    expect(calculateNutrientSummary({ date: '2026-09-10', meals: [dinner, midnight] }).calories).toBe(700);
    expect(calculateNutrientSummary({ date: '2026-09-11', meals: [dinner, midnight] }).calories).toBe(100);
    expect(loggedAtForDay('2026-09-10', dinner.logged_at)).toBe('2026-09-11T02:30:00.000Z');
  });
  it('backs a meal onto the selected local day while retaining the local clock', () => {
    const logged = loggedAtForDay('2026-09-08', dinner.logged_at);
    expect(logged).toBe('2026-09-09T02:30:00.000Z');
    expect(localDay(logged)).toBe('2026-09-08');
  });
  it('advances Today but preserves a deliberately selected history day or unfinished meal', () => {
    expect(rolloverDiaryDay('2026-09-10', '2026-09-10', '2026-09-11')).toBe('2026-09-11');
    expect(rolloverDiaryDay('2026-09-08', '2026-09-10', '2026-09-11')).toBe('2026-09-08');
    expect(rolloverDiaryDay('2026-09-10', '2026-09-10', '2026-09-11', true)).toBe('2026-09-10');
  });
  it('computes half-open local bounds including 23- and 25-hour DST days', () => {
    expect(localDayBounds('2026-09-10')).toEqual({ start: '2026-09-10T07:00:00.000Z', end: '2026-09-11T07:00:00.000Z' });
    for (const [day, hours] of [['2026-03-08', 23], ['2026-11-01', 25]] as const) {
      const { start, end } = localDayBounds(day);
      expect((Date.parse(end) - Date.parse(start)) / 3600000).toBe(hours);
    }
    expect(() => localDayBounds('2026-02-30')).toThrow();
  });
  it('also handles a timezone ahead of UTC', () => {
    process.env.TZ = 'Asia/Tokyo';
    expect(localDay('2026-09-10T15:15:00Z')).toBe('2026-09-11');
    expect(localDayBounds('2026-09-11').start).toBe('2026-09-10T15:00:00.000Z');
  });
  it('water follows the same local day and retains yesterday’s entries', () => {
    const entry = createWaterEntry(250, 'demo-user', '2026-09-10', dinner.logged_at);
    expect(entry.logged_at).toBe('2026-09-11T02:30:00.000Z');
    expect(waterForDay([entry], 'demo-user', '2026-09-10')).toEqual([entry]);
    expect(waterForDay([entry], 'demo-user', '2026-09-11')).toEqual([]);
  });
  it('remote meals, food items and water all query local bounds and remain owner-scoped', async () => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'gte', 'lt', 'order']) query[method] = vi.fn(() => query);
    query.limit = vi.fn(async () => ({ data: [], error: null }));
    query.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
    const client = { from: vi.fn(() => query) };
    for (const run of [
      () => getMealLogsForDate(client as unknown as NutritionSupabaseClient, 'owner', '2026-09-10'),
      () => getMealLogItemsForDate(client as unknown as MealItemSupabaseClient, 'owner', '2026-09-10'),
      () => readWater(client as unknown as HydrationClient, 'owner', '2026-09-10')
    ]) {
      await run();
      expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
      expect(query.gte).toHaveBeenCalledWith('logged_at', '2026-09-10T07:00:00.000Z');
      expect(query.lt).toHaveBeenCalledWith('logged_at', '2026-09-11T07:00:00.000Z');
      vi.clearAllMocks();
    }
  });
});

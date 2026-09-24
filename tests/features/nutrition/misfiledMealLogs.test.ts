import { describe, expect, it } from 'vitest';
import type { MealLog } from '../../../src/engines/nutrition';
import { findMisfiledMealLogs, repairMisfiledMealLogs } from '../../../src/features/nutrition/misfiledMealLogs';
import { manualMealFormToMealLog, createEmptyManualMealForm } from '../../../src/features/nutrition/foodTabForms';
import { mealBuilderToAggregateMealLog, createEmptyMealBuilder } from '../../../src/features/nutrition/mealBuilder';
import { scannedProductToMealLog } from '../../../src/features/nutrition/scannedMealLogMapper';
import { loggedAtForDay } from '../../../src/features/nutrition/foodDiaryPresentation';
import { localDay } from '../../../src/utils/localDay';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

function meal(id: string, loggedAt: string, createdAt = loggedAt): MealLog {
  return {
    id, user_id: 'demo-user', logged_at: loggedAt, meal_type: 'lunch', name: `Meal ${id}`,
    source: 'manual', source_confidence: 'medium', calories: 500, protein_g: 30, carbs_g: 50,
    fat_g: 18, fiber_g: 6, sugar_g: 8, sodium_mg: 400, quality_flags: [], reason_codes: [],
    created_at: createdAt
  } as MealLog;
}

const snapshot: HealthiProductSnapshot = {
  barcode: '012345678905', provider: 'open_food_facts', provider_product_id: '012345678905',
  name: 'Yogurt', brand: 'T', serving_size: '150 g', serving_quantity_g: 150, calories_per_serving: 120,
  protein_g: 15, carbs_g: 8, fat_g: 3, saturated_fat_g: 2, fiber_g: 0, sugar_g: 6, sodium_mg: 60,
  ingredients_text: 'Milk', quality_flags: [], confidence: 'high', reason_codes: ['product_label_data']
};

describe('finding entries the manual form filed under the wrong day', () => {
  it('finds one whose entry day and filed day disagree', () => {
    const found = findMisfiledMealLogs([meal('a', '2026-09-22T22:00:00.000Z', '2026-09-23T07:10:00.000Z')]);
    expect(found).toHaveLength(1);
    expect(found[0].filedOn).toBe(localDay('2026-09-22T22:00:00.000Z'));
    expect(found[0].enteredOn).toBe(localDay('2026-09-23T07:10:00.000Z'));
  });
  it('leaves a normal entry alone', () => {
    expect(findMisfiledMealLogs([meal('a', '2026-09-22T12:00:00.000Z')])).toEqual([]);
  });
  it('does not flag an entry deliberately logged to an earlier day', () => {
    const backdated = loggedAtForDay('2026-09-20', '2026-09-23T19:00:00.000Z');
    for (const saved of [
      mealBuilderToAggregateMealLog(createEmptyMealBuilder(), backdated, true),
      scannedProductToMealLog({ snapshot, servingQuantity: 1, loggedAt: backdated, mealType: 'snack' }),
      manualMealFormToMealLog({ ...createEmptyManualMealForm(backdated), logged_at: backdated, name: 'X' }, backdated)
    ]) {
      expect(findMisfiledMealLogs([saved as MealLog])).toEqual([]);
    }
  });
  it('reproduces the defect from the form itself, not from a hand-built row', () => {
    const mounted = '2026-09-22T22:00:00.000Z';
    const savedAt = '2026-09-23T07:10:00.000Z';
    const broken = manualMealFormToMealLog({ ...createEmptyManualMealForm(mounted), name: 'Breakfast' }, savedAt) as MealLog;
    expect(findMisfiledMealLogs([broken])).toHaveLength(1);
  });
  it('says nothing about entries with a missing or unreadable timestamp', () => {
    expect(findMisfiledMealLogs([meal('a', '2026-09-22T12:00:00.000Z', 'not a date')])).toEqual([]);
    expect(findMisfiledMealLogs([{ ...meal('a', '2026-09-22T12:00:00.000Z'), created_at: '' } as MealLog])).toEqual([]);
  });
});

describe('moving them back', () => {
  const diary = [
    meal('a', '2026-09-21T12:00:00.000Z'),
    meal('b', '2026-09-22T22:00:00.000Z', '2026-09-23T07:10:00.000Z'),
    meal('c', '2026-09-23T12:00:00.000Z')
  ];

  it('moves only what was chosen and keeps the rest exactly as they were', () => {
    const repaired = repairMisfiledMealLogs(diary, ['b']);
    expect(repaired).toHaveLength(3);
    expect(repaired[0]).toBe(diary[0]);
    expect(repaired[2]).toBe(diary[2]);
    expect(repaired[1].logged_at).toBe('2026-09-23T07:10:00.000Z');
    expect(findMisfiledMealLogs(repaired)).toEqual([]);
  });
  it('changes nothing when nothing is chosen', () => {
    expect(repairMisfiledMealLogs(diary, [])).toEqual(diary);
  });
  it('will not move an entry that is not misfiled, even if it is named', () => {
    expect(repairMisfiledMealLogs(diary, ['a', 'c'])).toEqual(diary);
  });
  it('runs twice without moving anything the second time', () => {
    const once = repairMisfiledMealLogs(diary, ['b']);
    expect(repairMisfiledMealLogs(once, ['b'])).toEqual(once);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { MealLog } from '../../../src/engines/nutrition';
import { applyMealEdit, createMealEditDraft, persistMealEdit, type MealEditClient } from '../../../src/features/nutrition/mealEditing';
import type { MealLogRow } from '../../../src/features/nutrition/persistence';

const meal: MealLog = {
  id: 'meal-1', user_id: 'owner-1', logged_at: '2026-09-09T12:00:00Z', created_at: '2026-09-09T12:01:00Z',
  name: 'Lunch', meal_type: 'lunch', source: 'manual', source_confidence: 'medium', calories: 400,
  protein_g: 20, carbs_g: 40, fat_g: 18, fiber_g: null, sugar_g: 0, sodium_mg: null,
  quality_flags: ['balanced_meal'], reason_codes: ['manual_food_log'], corrected_by_user: false, confirmed_by_user: true
};
describe('editing an existing meal', () => {
  it('retains identity, timestamps and evidence while changing totals in place', () => {
    const draft = createMealEditDraft(meal);
    draft.name = 'Updated lunch'; draft.amounts.protein_g = '25';
    const updated = applyMealEdit(draft);
    expect(updated).toMatchObject({ id: meal.id, logged_at: meal.logged_at, created_at: meal.created_at, name: 'Updated lunch', protein_g: 25, corrected_by_user: true, source: 'manual', source_confidence: 'medium' });
    expect(updated.quality_flags).toEqual(meal.quality_flags);
    expect(updated.reason_codes).toEqual(meal.reason_codes);
    expect(meal.name).toBe('Lunch'); expect(meal.protein_g).toBe(20);
  });
  it('keeps missing values distinct from declared zero', () => {
    const draft = createMealEditDraft(meal);
    expect(draft.amounts.fiber_g).toBe(''); expect(draft.amounts.sugar_g).toBe('0');
    const updated = applyMealEdit(draft);
    expect(updated.fiber_g).toBeNull(); expect(updated.sugar_g).toBe(0);
  });
  it('does not change the original when the user cancels a draft', () => {
    const original = JSON.stringify(meal); const draft = createMealEditDraft(meal);
    draft.name = 'Unsubmitted'; draft.amounts.calories = '600';
    expect(JSON.stringify(meal)).toBe(original);
  });
  it.each(['-10', 'Infinity', 'NaN', 'bad'])('rejects an invalid nutrient value %s', (value) => {
    const draft = createMealEditDraft(meal); draft.amounts.protein_g = value;
    expect(() => applyMealEdit(draft)).toThrow();
  });
  it('requires a saved meal identity and a readable name', () => {
    expect(() => applyMealEdit(createMealEditDraft({ ...meal, id: undefined }))).toThrow();
    const draft = createMealEditDraft(meal); draft.name = ' ';
    expect(() => applyMealEdit(draft)).toThrow('meal name');
  });
  it('validates the integer calorie column without rounding nutrient edits', () => {
    const draft = createMealEditDraft(meal);
    draft.amounts.calories = '400.5';
    expect(() => applyMealEdit(draft)).toThrow('whole number');
    draft.amounts.calories = '401'; draft.amounts.protein_g = '25.5';
    expect(applyMealEdit(draft)).toMatchObject({ calories: 401, protein_g: 25.5 });
  });
  it('scopes a single update to the current owner and existing meal without inserting a duplicate', async () => {
    const row = { ...meal } as MealLogRow;
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const ownerEq = vi.fn().mockReturnValue({ select });
    const idEq = vi.fn().mockReturnValue({ eq: ownerEq });
    const update = vi.fn().mockReturnValue({ eq: idEq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as MealEditClient;
    expect(await persistMealEdit(client, 'owner-1', meal)).toBe(row);
    expect(from).toHaveBeenCalledWith('meal_logs');
    expect(idEq).toHaveBeenCalledWith('id', 'meal-1');
    expect(ownerEq).toHaveBeenCalledWith('user_id', 'owner-1');
    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('id'); expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('source'); expect(payload).not.toHaveProperty('raw_source_payload');
  });
  it('propagates a failed save rather than reporting success', async () => {
    const client = { from: () => ({ update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'Save unavailable' } }) }) }) }) }) }) } as MealEditClient;
    await expect(persistMealEdit(client, 'owner-1', meal)).rejects.toThrow('Save unavailable');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loggedAtForDay, mealsForDay } from '../../../src/features/nutrition/foodDiaryPresentation';
import { createEmptyManualMealForm, manualMealFormToMealLog } from '../../../src/features/nutrition/foodTabForms';
import { scannedProductToMealLog } from '../../../src/features/nutrition/scannedMealLogMapper';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import { localDay } from '../../../src/utils/localDay';

const screen = readFileSync('app/(app)/(tabs)/food.tsx', 'utf8');
const between = (from: string, to: string) => screen.slice(screen.indexOf(from), screen.indexOf(to));

/**
 * Every way of logging food has to file the entry under the day on screen.
 *
 * Three of the four save paths used to take the wall clock instead, so anything logged while
 * looking at an earlier day was written to today and vanished from the day it was entered on.
 * It looked exactly like the entry had not saved.
 */
describe('a logged entry lands on the day being looked at', () => {
  const saves = {
    'the meal builder': between('async function handleSaveBuiltMeal()', 'async function handleAddScannerProductToBuilder()'),
    'a scanned product': between('async function handleSaveScannedMeal()', 'async function handleSaveMeal()'),
    'the manual meal form': between('async function handleSaveMeal()', 'function handleAnswer(')
  };

  it.each(Object.entries(saves))('%s stamps the selected day, not the clock', (_name, body) => {
    expect(body).toContain('loggedAtForDay(today, new Date().toISOString())');
    expect(body).not.toMatch(/logged(_a|A)t:\s*now\b/);
  });
  it.each(Object.entries(saves))('%s tells the user which day it went to', (_name, body) => {
    expect(body).toMatch(/dayTitle\(today, actualToday\)|dayLabel/);
  });
  it('does not leave a save path building its own timestamp', () => {
    for (const body of Object.values(saves)) expect(body).not.toContain("const now = new Date().toISOString()");
  });
});

describe('the pieces those paths rely on', () => {
  const day = '2026-09-21';
  const now = '2026-09-23T20:35:00.000Z';

  it('keeps a late-evening save on the day it was filed under', () => {
    expect(localDay(loggedAtForDay(day, now))).toBe(day);
  });
  /**
   * The manual form stamps itself when the screen mounts. An app left open across midnight
   * therefore carries yesterday's stamp into today, which is how a morning's logs end up on
   * the previous day and read as missing from both.
   */
  it('does not carry the timestamp the form was created with across midnight', () => {
    const mounted = '2026-09-22T22:00:00.000Z';
    const saved = '2026-09-23T00:30:00.000Z';
    const form = { ...createEmptyManualMealForm(mounted), name: 'Soup' };
    expect(localDay(manualMealFormToMealLog(form, saved).logged_at)).toBe('2026-09-22');
    const anchored = loggedAtForDay('2026-09-23', saved);
    expect(localDay(manualMealFormToMealLog({ ...form, logged_at: anchored }, anchored).logged_at)).toBe('2026-09-23');
  });
  it('files a scanned product under the day it is given', () => {
    const snapshot: HealthiProductSnapshot = {
      barcode: '012345678905', provider: 'open_food_facts', provider_product_id: '012345678905',
      name: 'Greek yogurt', brand: 'Healthi Test', serving_size: '150 g', serving_quantity_g: 150,
      calories_per_serving: 120, protein_g: 15, carbs_g: 8, fat_g: 3, saturated_fat_g: 2,
      fiber_g: 0, sugar_g: 6, sodium_mg: 60, ingredients_text: 'Milk, cultures',
      quality_flags: [], confidence: 'high', reason_codes: ['product_label_data']
    };
    const meal = scannedProductToMealLog({ snapshot, servingQuantity: 1, loggedAt: loggedAtForDay(day, now), mealType: 'snack' });
    expect(localDay(meal.logged_at)).toBe(day);
    expect(mealsForDay([meal as never], day)).toHaveLength(1);
    expect(mealsForDay([meal as never], '2026-09-23')).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';

import {
  calorieRange,
  correctPortion,
  estimateConfidence,
  formatCalorieRange,
  parsePhotoEstimate,
  photoEstimateItemToSnapshot,
  portionLabel,
  removeEstimateItem
} from '../../../src/features/nutrition/photoEstimate/photoEstimate';
import { foodLoggingNutrition } from '../../../src/features/nutrition/foodLoggingNutrition';

const NOW = '2026-09-14T12:00:00.000Z';

function payload(items: unknown[]) {
  return { items };
}

const salmon = {
  name: 'Salmon fillet',
  detail: 'the pink fillet at the left',
  amount: 170,
  unit: 'g',
  nutrients: { calories: 350, protein_g: 38, fat_g: 22, carbs_g: 0 },
  identification_confidence: 'high',
  portion_confidence: 'medium'
};

function parsed(items: unknown[] = [salmon]) {
  const result = parsePhotoEstimate(payload(items), { model: 'test-model', now: NOW });
  if (!result.ok) throw new Error(`expected an estimate, got ${result.refusal.reason}`);
  return result.estimate;
}

describe('reading an estimate out of model output', () => {
  it('keeps identification and portion confidence apart', () => {
    const item = parsed().items[0];
    // The model can know it is salmon and still not know if it is 4 oz or 8 oz.
    expect(item.identification_confidence).toBe('high');
    expect(item.portion_confidence).toBe('medium');
  });

  it('records which model made the guess and that it still needs review', () => {
    const estimate = parsed();
    expect(estimate.model).toBe('test-model');
    expect(estimate.requires_review).toBe(true);
  });

  it('treats a missing or unknown confidence as the weakest, never the strongest', () => {
    const item = parsed([{ ...salmon, identification_confidence: undefined, portion_confidence: 'certain' }]).items[0];
    expect(item.identification_confidence).toBe('low');
    expect(item.portion_confidence).toBe('low');
  });

  it('drops an item it cannot name rather than logging a placeholder', () => {
    const estimate = parsed([salmon, { amount: 100, unit: 'g', nutrients: { calories: 200 } }]);
    expect(estimate.items).toHaveLength(1);
  });

  it('drops an item with no usable portion instead of inventing one', () => {
    const estimate = parsed([salmon, { name: 'Side salad', amount: 0, nutrients: { calories: 90 } }]);
    expect(estimate.items.map((item) => item.name)).toEqual(['Salmon fillet']);
  });
});

describe('what it refuses to do', () => {
  it('names an empty plate instead of reporting zero calories', () => {
    const result = parsePhotoEstimate(payload([]), { now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe('no_food_found');
    expect(result.refusal.detail).toMatch(/could not make out/i);
  });

  it('refuses a payload it cannot read rather than throwing', () => {
    for (const bad of [null, 'nope', 42, {}, { items: 'salmon' }]) {
      const result = parsePhotoEstimate(bad, { now: NOW });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.refusal.reason).toBe('malformed_response');
    }
  });

  it('clamps a runaway figure instead of writing it to the diary', () => {
    const item = parsed([{ ...salmon, amount: 1e9, nutrients: { calories: 1e9, protein_g: -5 } }]).items[0];
    expect(item.nutrients.calories).toBeLessThanOrEqual(100_000);
    expect(item.portion.amount).toBeLessThanOrEqual(100_000);
    // A negative nutrient is unreported, not zero.
    expect(item.nutrients.protein_g).toBeNull();
  });

  it('claims no ingredients, brand or label evidence from a photo', () => {
    const snapshot = photoEstimateItemToSnapshot(parsed().items[0]);
    expect(snapshot.ingredients_text).toBeNull();
    expect(snapshot.brand).toBeNull();
    expect(snapshot.quality_flags).toEqual([]);
    expect(snapshot.provider).toBe('photo_estimate');
  });
});

describe('calories as a band, never a single figure', () => {
  it('widens the band as portion confidence falls', () => {
    const medium = calorieRange(parsed().items)!;
    const low = calorieRange(parsed([{ ...salmon, portion_confidence: 'low' }]).items)!;
    expect(medium).toEqual({ low: 263, high: 438 });
    expect(low.low).toBeLessThan(medium.low);
    expect(low.high).toBeGreaterThan(medium.high);
  });

  it('bands each item by its own confidence rather than one global width', () => {
    const range = calorieRange(parsed([
      { ...salmon, portion_confidence: 'high', nutrients: { calories: 100 } },
      { name: 'Rice', amount: 200, unit: 'g', nutrients: { calories: 100 }, portion_confidence: 'low' }
    ]).items)!;
    // 100 ± 15% plus 100 ± 40% — a measured item is not widened by an uncertain neighbour.
    expect(range).toEqual({ low: 145, high: 255 });
  });

  it('reports no band when nothing carried a calorie figure', () => {
    const estimate = parsed([{ ...salmon, nutrients: {} }]);
    expect(estimate.calories).toBeNull();
    expect(estimate.calorie_range).toBeNull();
    expect(formatCalorieRange(null)).toBeNull();
  });

  it('reads as a range', () => {
    expect(formatCalorieRange({ low: 410, high: 680 })).toBe('410–680 kcal');
  });
});

describe('an estimate is only as good as its weakest item', () => {
  it('takes the lower of identification and portion, across every item', () => {
    expect(estimateConfidence(parsed().items)).toBe('medium');
    expect(estimateConfidence(parsed([salmon, { ...salmon, name: 'Rice', portion_confidence: 'low' }]).items)).toBe('low');
    expect(estimateConfidence([])).toBe('low');
  });
});

describe('correcting a portion', () => {
  it('scales the nutrients and settles the portion without settling the identity', () => {
    const estimate = parsed();
    const corrected = correctPortion(estimate, estimate.items[0].id, 85);
    const item = corrected.items[0];
    expect(item.portion.amount).toBe(85);
    expect(item.portion.corrected).toBe(true);
    expect(item.nutrients.calories).toBe(175);
    expect(item.nutrients.protein_g).toBe(19);
    // Saying "85 g" makes the portion known; it says nothing about whether this is salmon.
    expect(item.portion_confidence).toBe('high');
    expect(item.identification_confidence).toBe('high');
  });

  it('recomputes the total and narrows the band after a correction', () => {
    const estimate = parsed();
    const corrected = correctPortion(estimate, estimate.items[0].id, 170);
    expect(corrected.calories).toBe(350);
    // Same calories, but a known portion: ±15% rather than ±25%.
    expect(corrected.calorie_range).toEqual({ low: 298, high: 402 });
  });

  it('ignores a nonsense correction instead of destroying the estimate', () => {
    const estimate = parsed();
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(correctPortion(estimate, estimate.items[0].id, bad)).toBe(estimate);
    }
  });

  it('records a corrected item as user-corrected in its reason codes', () => {
    const estimate = parsed();
    expect(photoEstimateItemToSnapshot(estimate.items[0]).reason_codes)
      .toEqual(['photo_estimated_food_log']);

    const corrected = correctPortion(estimate, estimate.items[0].id, 85);
    expect(photoEstimateItemToSnapshot(corrected.items[0]).reason_codes)
      .toEqual(['photo_estimated_food_log', 'user_corrected_food_log']);
  });
});

describe('removing an item', () => {
  it('drops it and recomputes the totals', () => {
    const estimate = parsed([salmon, { name: 'Rice', amount: 200, unit: 'g', nutrients: { calories: 260 } }]);
    expect(estimate.calories).toBe(610);
    const trimmed = removeEstimateItem(estimate, estimate.items[1].id);
    expect(trimmed.items).toHaveLength(1);
    expect(trimmed.calories).toBe(350);
  });
});

describe('portion labels', () => {
  it('states the measure, and the model phrasing only until a person overrides it', () => {
    const estimate = parsed([{ ...salmon, described_as: 'about a palm' }]);
    expect(portionLabel(estimate.items[0])).toBe('170 g · about a palm');
    const corrected = correctPortion(estimate, estimate.items[0].id, 200);
    expect(portionLabel(corrected.items[0])).toBe('200 g');
  });

  it('never presents a count as a mass', () => {
    const estimate = parsed([{ name: 'Boiled egg', amount: 2, unit: 'count', nutrients: { calories: 140 } }]);
    expect(portionLabel(estimate.items[0])).toBe('2 servings');
    expect(photoEstimateItemToSnapshot(estimate.items[0]).serving_quantity_g).toBeNull();
  });

  it('keeps a millilitre portion in millilitres', () => {
    const estimate = parsed([{ name: 'Orange juice', amount: 250, unit: 'ml', nutrients: { calories: 110 } }]);
    expect(portionLabel(estimate.items[0])).toBe('250 mL');
  });
});

describe('flowing into the existing logging pipeline', () => {
  it('logs the estimated portion itself rather than falling back to 100 g', () => {
    const snapshot = photoEstimateItemToSnapshot(parsed().items[0]);
    const logging = foodLoggingNutrition(snapshot);
    // The serving basis must win, or an estimate would be re-scaled against per-100 g data.
    expect(logging.basis).toBe('serving');
    expect(logging.isServing).toBe(true);
    expect(logging.portionLabel).toBe('per serving');
    expect(logging.nutrients.calories).toBe(350);
  });

  it('carries the item confidence onto the snapshot', () => {
    expect(photoEstimateItemToSnapshot(parsed().items[0]).confidence).toBe('medium');
  });
});

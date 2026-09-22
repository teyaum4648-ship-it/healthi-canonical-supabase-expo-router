import { MICRONUTRIENTS, type MicronutrientAmounts, type MicronutrientUnit } from '../../../engines/nutrition/micronutrients';

/**
 * Reading the micronutrient panel out of what the providers already send.
 *
 * Neither provider was withholding this. USDA returns a full nutrient array on every
 * food in a search response and Open Food Facts returns whatever the label carried; both
 * were being read for nine fields and the rest discarded, which is why the Nutrients tab
 * had three rows permanently reading "Not reported".
 *
 * Both readers refuse to guess. A nutrient whose unit cannot be established is skipped
 * rather than assumed, because the failure mode of assuming is not a missing row — it is
 * a wrong number off by a factor of a thousand, sitting under a heading that says
 * "honestly reported".
 */

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Grams, milligrams and micrograms, as a multiplier onto the definition's unit. */
const UNIT_SCALE: Record<MicronutrientUnit, Record<string, number>> = {
  g: { g: 1, mg: 1e-3, ug: 1e-6, mcg: 1e-6, 'µg': 1e-6, 'μg': 1e-6 },
  mg: { g: 1e3, mg: 1, ug: 1e-3, mcg: 1e-3, 'µg': 1e-3, 'μg': 1e-3 },
  ug: { g: 1e6, mg: 1e3, ug: 1, mcg: 1, 'µg': 1, 'μg': 1 }
};

function convert(value: number, from: string, to: MicronutrientUnit): number | null {
  const scale = UNIT_SCALE[to][from.trim().toLowerCase()];
  return typeof scale === 'number' ? value * scale : null;
}

/**
 * A value that survived conversion still has to be plausible per 100 g.
 *
 * A thousand daily values in one bite is a unit error rather than a food, and catching it
 * here means a bad conversion shows as a missing row instead of as a number nobody can
 * question.
 */
function plausible(amount: number, dailyValue: number): boolean {
  return Number.isFinite(amount) && amount >= 0 && amount <= dailyValue * 100;
}

/** USDA states the unit on every row, so the panel can be read without assuming anything. */
export function readUsdaMicronutrients(foodNutrients: unknown): MicronutrientAmounts {
  const rows = Array.isArray(foodNutrients) ? foodNutrients.filter(record) : [];
  if (rows.length === 0) return {};

  const amounts: MicronutrientAmounts = {};
  for (const definition of MICRONUTRIENTS) {
    const row = rows.find((candidate) => candidate.nutrientId === definition.usdaNutrientId);
    if (!row) continue;
    const value = row.value;
    const unit = typeof row.unitName === 'string' ? row.unitName : '';
    if (typeof value !== 'number' || !Number.isFinite(value) || !unit) continue;
    const converted = convert(value, unit, definition.unit);
    if (converted === null || !plausible(converted, definition.dailyValue)) continue;
    amounts[definition.id] = converted;
  }
  return amounts;
}

/**
 * Open Food Facts, read only where the label stated its own unit.
 *
 * OFF's `<key>_100g` values are not reliably in the unit a reader would expect, and the
 * companion `<key>_unit` is the only thing in the payload that settles it. Where that key
 * is absent the nutrient is left unreported: a gap is recoverable, a milligram read as a
 * gram is not.
 */
export function readOpenFoodFactsMicronutrients(nutriments: unknown): MicronutrientAmounts {
  if (!record(nutriments)) return {};

  const amounts: MicronutrientAmounts = {};
  for (const definition of MICRONUTRIENTS) {
    const value = nutriments[`${definition.offKey}_100g`];
    const unit = nutriments[`${definition.offKey}_unit`];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (typeof unit !== 'string' || !unit.trim()) continue;
    const converted = convert(value, unit, definition.unit);
    if (converted === null || !plausible(converted, definition.dailyValue)) continue;
    amounts[definition.id] = converted;
  }
  return amounts;
}

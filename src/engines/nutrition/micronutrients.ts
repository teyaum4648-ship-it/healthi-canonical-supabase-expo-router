/**
 * The micronutrients Healthi tracks, and where each one comes from.
 *
 * Until now the Nutrients tab showed six macros and three rows — potassium, calcium,
 * iron — hardcoded to read "Not reported" forever, under a heading that said "Full
 * spectrum, honestly reported". The data was never missing from the providers: the USDA
 * search returns a full nutrient panel on every food and Open Food Facts returns whatever
 * the label carried, and both were being read for nine fields and thrown away.
 *
 * One table, four jobs: what to call it, what unit it is in, which provider field to read
 * it from, and what a day's worth looks like. Adding a nutrient here is the only step
 * needed for it to appear in totals, in coverage and on screen.
 *
 * Reference amounts are the FDA Daily Values for adults and children over four — a
 * labelling standard, not a personal target. They exist so a number can be given a sense
 * of scale ("18% of a day's reference") rather than to tell anyone what they need, which
 * depends on things this app does not know.
 */

export type MicronutrientGroup = 'vitamin' | 'mineral';

/** Units as the providers report them; USDA spells micrograms 'UG'. */
export type MicronutrientUnit = 'g' | 'mg' | 'ug';

export type MicronutrientDefinition = {
  id: string;
  label: string;
  group: MicronutrientGroup;
  unit: MicronutrientUnit;
  /**
   * USDA FoodData Central nutrient number.
   *
   * A wrong number here degrades to "not reported" rather than to a wrong value, because
   * the reader requires the unit to match as well — a mismatched id would have to collide
   * with another nutrient measured in the same unit to produce a number at all. That is
   * deliberate: these numbers could not be checked against the live API from the
   * environment this was written in, so the failure mode had to be silence.
   */
  usdaNutrientId: number;
  /** Open Food Facts nutriment key, before the per-100g suffix. */
  offKey: string;
  /** FDA Daily Value for adults, in `unit`. */
  dailyValue: number;
};

export const MICRONUTRIENTS: readonly MicronutrientDefinition[] = [
  // Vitamins
  { id: 'vitamin_a', label: 'Vitamin A', group: 'vitamin', unit: 'ug', usdaNutrientId: 1106, offKey: 'vitamin-a', dailyValue: 900 },
  { id: 'vitamin_c', label: 'Vitamin C', group: 'vitamin', unit: 'mg', usdaNutrientId: 1162, offKey: 'vitamin-c', dailyValue: 90 },
  { id: 'vitamin_d', label: 'Vitamin D', group: 'vitamin', unit: 'ug', usdaNutrientId: 1114, offKey: 'vitamin-d', dailyValue: 20 },
  { id: 'vitamin_e', label: 'Vitamin E', group: 'vitamin', unit: 'mg', usdaNutrientId: 1109, offKey: 'vitamin-e', dailyValue: 15 },
  { id: 'vitamin_k', label: 'Vitamin K', group: 'vitamin', unit: 'ug', usdaNutrientId: 1185, offKey: 'vitamin-k', dailyValue: 120 },
  { id: 'thiamin', label: 'Thiamin (B1)', group: 'vitamin', unit: 'mg', usdaNutrientId: 1165, offKey: 'vitamin-b1', dailyValue: 1.2 },
  { id: 'riboflavin', label: 'Riboflavin (B2)', group: 'vitamin', unit: 'mg', usdaNutrientId: 1166, offKey: 'vitamin-b2', dailyValue: 1.3 },
  { id: 'niacin', label: 'Niacin (B3)', group: 'vitamin', unit: 'mg', usdaNutrientId: 1167, offKey: 'vitamin-pp', dailyValue: 16 },
  { id: 'pantothenic_acid', label: 'Pantothenic acid (B5)', group: 'vitamin', unit: 'mg', usdaNutrientId: 1170, offKey: 'pantothenic-acid', dailyValue: 5 },
  { id: 'vitamin_b6', label: 'Vitamin B6', group: 'vitamin', unit: 'mg', usdaNutrientId: 1175, offKey: 'vitamin-b6', dailyValue: 1.7 },
  { id: 'biotin', label: 'Biotin (B7)', group: 'vitamin', unit: 'ug', usdaNutrientId: 1176, offKey: 'biotin', dailyValue: 30 },
  { id: 'folate', label: 'Folate (B9)', group: 'vitamin', unit: 'ug', usdaNutrientId: 1190, offKey: 'vitamin-b9', dailyValue: 400 },
  { id: 'vitamin_b12', label: 'Vitamin B12', group: 'vitamin', unit: 'ug', usdaNutrientId: 1178, offKey: 'vitamin-b12', dailyValue: 2.4 },
  { id: 'choline', label: 'Choline', group: 'vitamin', unit: 'mg', usdaNutrientId: 1180, offKey: 'choline', dailyValue: 550 },

  // Minerals
  { id: 'calcium', label: 'Calcium', group: 'mineral', unit: 'mg', usdaNutrientId: 1087, offKey: 'calcium', dailyValue: 1300 },
  { id: 'iron', label: 'Iron', group: 'mineral', unit: 'mg', usdaNutrientId: 1089, offKey: 'iron', dailyValue: 18 },
  { id: 'magnesium', label: 'Magnesium', group: 'mineral', unit: 'mg', usdaNutrientId: 1090, offKey: 'magnesium', dailyValue: 420 },
  { id: 'phosphorus', label: 'Phosphorus', group: 'mineral', unit: 'mg', usdaNutrientId: 1091, offKey: 'phosphorus', dailyValue: 1250 },
  { id: 'potassium', label: 'Potassium', group: 'mineral', unit: 'mg', usdaNutrientId: 1092, offKey: 'potassium', dailyValue: 4700 },
  { id: 'zinc', label: 'Zinc', group: 'mineral', unit: 'mg', usdaNutrientId: 1095, offKey: 'zinc', dailyValue: 11 },
  { id: 'copper', label: 'Copper', group: 'mineral', unit: 'mg', usdaNutrientId: 1098, offKey: 'copper', dailyValue: 0.9 },
  { id: 'manganese', label: 'Manganese', group: 'mineral', unit: 'mg', usdaNutrientId: 1101, offKey: 'manganese', dailyValue: 2.3 },
  { id: 'selenium', label: 'Selenium', group: 'mineral', unit: 'ug', usdaNutrientId: 1103, offKey: 'selenium', dailyValue: 55 },
  { id: 'iodine', label: 'Iodine', group: 'mineral', unit: 'ug', usdaNutrientId: 1100, offKey: 'iodine', dailyValue: 150 },
  { id: 'chromium', label: 'Chromium', group: 'mineral', unit: 'ug', usdaNutrientId: 1096, offKey: 'chromium', dailyValue: 35 },
  { id: 'molybdenum', label: 'Molybdenum', group: 'mineral', unit: 'ug', usdaNutrientId: 1102, offKey: 'molybdenum', dailyValue: 45 },
  { id: 'chloride', label: 'Chloride', group: 'mineral', unit: 'mg', usdaNutrientId: 1088, offKey: 'chloride', dailyValue: 2300 }
];

/**
 * Amounts for some subset of the tracked micronutrients, keyed by id.
 *
 * A key that is not present means the provider did not report that nutrient — which is
 * not the same as reporting zero, and the difference is the whole point: a packaged food
 * with no vitamin K on its label has an unknown amount, not none. Readers must check
 * before using a value; this is deliberately a plain JSON-safe record so it can be
 * persisted and read back without a wrapper.
 */
export type MicronutrientAmounts = Record<string, number>;

export const MICRONUTRIENT_IDS: readonly string[] = MICRONUTRIENTS.map((item) => item.id);

export function micronutrientById(id: string): MicronutrientDefinition | null {
  return MICRONUTRIENTS.find((item) => item.id === id) ?? null;
}

/**
 * How much of the tracked panel a set of amounts actually reports.
 *
 * This is the number the app owes the user. A branded product carries the label panel and
 * little else, so coverage on a packaged day is genuinely low — and saying "14 of 27
 * reported" is honest where showing fourteen numbers and silence for the rest implies the
 * silence means zero. Missing data lowers confidence, never the score.
 */
export function micronutrientCoverage(amounts: MicronutrientAmounts): {
  reported: number;
  tracked: number;
  fraction: number;
} {
  const reported = MICRONUTRIENT_IDS.filter((id) => {
    const value: number | undefined = amounts[id];
    return typeof value === 'number' && Number.isFinite(value);
  }).length;
  return {
    reported,
    tracked: MICRONUTRIENT_IDS.length,
    fraction: MICRONUTRIENT_IDS.length === 0 ? 0 : reported / MICRONUTRIENT_IDS.length
  };
}

/** Adds two sparse amount sets, keeping absence distinct from zero. */
export function addMicronutrients(
  left: MicronutrientAmounts,
  right: MicronutrientAmounts
): MicronutrientAmounts {
  const total: MicronutrientAmounts = { ...left };
  for (const id of MICRONUTRIENT_IDS) {
    const value: number | undefined = right[id];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const existing: number | undefined = total[id];
    total[id] = (typeof existing === 'number' && Number.isFinite(existing) ? existing : 0) + value;
  }
  return total;
}

/** Share of a day's reference amount, or null when the nutrient was not reported. */
export function dailyValueFraction(id: string, amount: number | null | undefined): number | null {
  const definition = micronutrientById(id);
  if (!definition || typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (definition.dailyValue <= 0) return null;
  return amount / definition.dailyValue;
}

/** The unit as it should be read on screen; 'ug' is a wire format, not a label. */
export function micronutrientDisplayUnit(unit: MicronutrientUnit): string {
  return unit === 'ug' ? 'µg' : unit;
}

/**
 * An amount as it should read on a row, or null when the nutrient was not reported.
 *
 * Precision follows magnitude rather than unit: 0.9 mg of copper needs a decimal and
 * 1250 mg of phosphorus does not, and a figure carried to more places than the label
 * supports reads as certainty the data has not earned.
 */
export function formatMicronutrientAmount(id: string, amount: number | null | undefined): string | null {
  const definition = micronutrientById(id);
  if (!definition || typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  const unit = micronutrientDisplayUnit(definition.unit);
  if (amount >= 100) return `${Math.round(amount)} ${unit}`;
  if (amount >= 10) return `${Math.round(amount * 10) / 10} ${unit}`;
  return `${Math.round(amount * 100) / 100} ${unit}`;
}

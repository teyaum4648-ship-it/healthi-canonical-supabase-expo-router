export const PRODUCT_NUTRITION_VALIDATION_VERSION = 'nutrition_validation_v1' as const;
export const PRODUCT_IDENTITY_ACCEPTANCE_THRESHOLD = 0.72;

export type DataReliability = 'KNOWN' | 'ESTIMATED' | 'CONFLICTED' | 'UNRELIABLE' | 'MISSING';
export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type NutritionBasis = 'PER_SERVING' | 'PER_100G' | 'PER_100ML' | 'PER_CONTAINER' | 'UNKNOWN';

export type ValidatedNutrientField =
  | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'saturated_fat_g'
  | 'fiber_g' | 'sugar_g' | 'added_sugar_g' | 'sodium_mg' | 'caffeine_mg';

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  field?: string;
  source?: string;
  observed?: unknown;
  expected?: string;
  message: string;
};

export type NormalizedNutrient = {
  value: number | null;
  unit: string | null;
  basis: NutritionBasis;
  source: string;
  reliability: DataReliability;
  derived: boolean;
  validationIssues: ValidationIssue[];
};

export type ProviderResolutionTrace = {
  field: string;
  candidates: Array<{ source: string; value: unknown; reliability: DataReliability }>;
  selectedSource: string | null;
  selectedValue: unknown;
  reason: string;
};

export type ProductIdentitySignals = {
  barcodeMatch: boolean | null;
  brandSimilarity: number | null;
  productNameSimilarity: number | null;
  packageSizeSimilarity: number | null;
  ingredientSimilarity: number | null;
  formulationDateCompatibility?: number | null;
};

export type ProductIdentityResolution = {
  confidence: number;
  accepted: boolean;
  signals: ProductIdentitySignals;
};

export type ProviderCategoryResolution = {
  category: string | null;
  confidence: number;
  source: string[];
};

export type NutritionValidationInput = {
  source: string;
  values: Partial<Record<ValidatedNutrientField, unknown>>;
  units?: Partial<Record<ValidatedNutrientField, string | null>>;
  basis?: NutritionBasis;
  servingQuantity?: unknown;
  servingUnit?: string | null;
  servingDescription?: string | null;
  reportedServingQuantity?: unknown;
  packageQuantity?: unknown;
  packageUnit?: string | null;
  servingsPerContainer?: unknown;
  per100g?: Partial<Record<ValidatedNutrientField, unknown>> | null;
  per100ml?: Partial<Record<ValidatedNutrientField, unknown>> | null;
  ingredientsText?: string | null;
  categoryAvailable?: boolean;
  categories?: string[];
};

export type NutritionValidationResult = {
  version: typeof PRODUCT_NUTRITION_VALIDATION_VERSION;
  nutrients: Record<ValidatedNutrientField, NormalizedNutrient>;
  serving: {
    value: number | null;
    unit: string | null;
    reliability: DataReliability;
    validationIssues: ValidationIssue[];
  };
  validationIssues: ValidationIssue[];
  categoryResolution: ProviderCategoryResolution;
  requiresFallback: boolean;
  fallbackReasons: string[];
};

export const VALIDATED_NUTRIENT_FIELDS: ValidatedNutrientField[] = [
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'saturated_fat_g',
  'fiber_g', 'sugar_g', 'added_sugar_g', 'sodium_mg', 'caffeine_mg'
];

const EXPECTED_UNITS: Record<ValidatedNutrientField, string> = {
  calories: 'kcal', protein_g: 'g', carbs_g: 'g', fat_g: 'g', saturated_fat_g: 'g',
  fiber_g: 'g', sugar_g: 'g', added_sugar_g: 'g', sodium_mg: 'mg', caffeine_mg: 'mg'
};

const SCORING_RELEVANT_FIELDS = new Set<ValidatedNutrientField>([
  'protein_g', 'saturated_fat_g', 'fiber_g', 'sugar_g', 'added_sugar_g', 'sodium_mg'
]);

const CALORIC_ADDED_SWEETENER = /\b(sugar|cane sugar|cane syrup|sucrose|high[- ]fructose corn syrup|corn syrup|glucose syrup|fructose syrup|invert sugar|dextrose|glucose|maltose|malt syrup|brown rice syrup|rice syrup|honey|agave(?: syrup)?|maple syrup|molasses)\b/i;
const ADDED_FAT = /\b(oil|butter|shortening|lard|margarine|ghee|cream)\b/i;
const SODIUM_SOURCE = /\b(salt|sea salt|sodium (?:chloride|citrate|phosphate|nitrite|nitrate|benzoate|bicarbonate)|monosodium glutamate|msg)\b/i;

const round = (value: number): number => Math.round(value * 10) / 10;
const finite = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

function relativeConflict(left: number, right: number, absoluteTolerance: number, relativeTolerance = 0.2): boolean {
  const difference = Math.abs(left - right);
  if (difference <= absoluteTolerance) return false;
  return difference / Math.max(Math.abs(left), Math.abs(right), 1) > relativeTolerance;
}

function issue(input: ValidationIssue): ValidationIssue {
  return input;
}

function containsHouseholdMeasure(value: string | null | undefined): boolean {
  return Boolean(value && /\b(cookie|cookies|piece|pieces|slice|slices|cup|cups|tbsp|tablespoons?|tsp|teaspoons?|bar|bars|cracker|crackers|can|container|bottle|packet|pouch|serving|servings)\b/i.test(value));
}

function ingredientTokens(value: string | null | undefined): string[] {
  return (value ?? '').toLowerCase().split(/[,;()\[\]]/).map((item) => item.trim()).filter(Boolean);
}

function meaningfulIngredientMatch(value: string | null | undefined, pattern: RegExp): boolean {
  const tokens = ingredientTokens(value);
  return tokens.slice(0, 5).some((token) => pattern.test(token)) || tokens.filter((token) => pattern.test(token)).length >= 2;
}

function fieldIssue(
  issues: ValidationIssue[],
  nutrientIssues: ValidationIssue[],
  value: ValidationIssue
): void {
  issues.push(value);
  nutrientIssues.push(value);
}

function expectedFromReference(
  field: ValidatedNutrientField,
  source: Partial<Record<ValidatedNutrientField, unknown>> | null | undefined,
  servingQuantity: number,
  denominator: number
): number | null {
  const value = finite(source?.[field]);
  return value === null || value < 0 ? null : value * servingQuantity / denominator;
}

function canDeriveUnambiguousUnitCorrection(input: {
  field: ValidatedNutrientField;
  reported: number;
  expected: number;
  servingQuantity: number;
  ingredientsText?: string | null;
}): boolean {
  if (input.field !== 'sodium_mg' && input.field !== 'caffeine_mg') return false;
  const ratio = Math.max(input.reported, input.expected) / Math.max(Math.min(input.reported, input.expected), 0.0001);
  if (ratio < 900 || ratio > 1_100) return false;
  if (input.expected > input.servingQuantity * 1_000 * 1.05) return false;
  if (input.field === 'sodium_mg' && input.reported < input.expected) {
    return meaningfulIngredientMatch(input.ingredientsText, SODIUM_SOURCE);
  }
  return true;
}

export function validateNutritionData(input: NutritionValidationInput): NutritionValidationResult {
  const source = input.source;
  const basis = input.basis ?? 'PER_SERVING';
  const issues: ValidationIssue[] = [];
  const servingIssues: ValidationIssue[] = [];
  const servingValue = finite(input.servingQuantity);
  const servingUnit = input.servingUnit?.trim().toLowerCase() ?? null;
  const packageValue = finite(input.packageQuantity);
  const packageUnit = input.packageUnit?.trim().toLowerCase() ?? null;
  const categories = [...new Set((input.categories ?? []).map((value) => value.trim()).filter(Boolean))];
  const categoryAvailable = input.categoryAvailable ?? categories.length > 0;
  let servingReliability: DataReliability = servingValue === null ? 'MISSING' : 'KNOWN';

  if (servingValue !== null && servingValue <= 0) {
    const value = issue({
      code: 'INVALID_SERVING_SIZE', severity: 'ERROR', field: 'serving', source, observed: input.servingQuantity,
      expected: 'a finite serving quantity greater than zero', message: 'The normalized serving quantity is not physically valid.'
    });
    issues.push(value); servingIssues.push(value); servingReliability = 'UNRELIABLE';
  }
  if (servingValue !== null && servingValue > 0 && packageValue !== null && packageValue > 0 && servingUnit && packageUnit === servingUnit) {
    if (servingValue > packageValue * 1.05) {
      const value = issue({
        code: 'SERVING_EXCEEDS_PACKAGE', severity: 'ERROR', field: 'serving', source,
        observed: { serving: servingValue, package: packageValue, unit: servingUnit }, expected: 'serving size no larger than package size',
        message: 'The declared serving is larger than the package quantity.'
      });
      issues.push(value); servingIssues.push(value); servingReliability = 'UNRELIABLE';
    }
    const servings = finite(input.servingsPerContainer);
    if (servings !== null && servings > 0) {
      const expectedServing = packageValue / servings;
      if (relativeConflict(servingValue, expectedServing, 1, 0.12)) {
        const value = issue({
          code: 'SERVING_PACKAGE_COUNT_CONFLICT', severity: 'ERROR', field: 'serving', source,
          observed: servingValue, expected: `approximately ${round(expectedServing)} ${servingUnit} from package quantity and serving count`,
          message: 'Serving quantity conflicts with package mass and servings-per-container metadata.'
        });
        issues.push(value); servingIssues.push(value); servingReliability = 'CONFLICTED';
      }
    } else if (packageValue / servingValue > 100 && !containsHouseholdMeasure(input.servingDescription)) {
      const value = issue({
        code: 'SERVING_PACKAGE_RATIO_IMPLAUSIBLE', severity: 'ERROR', field: 'serving', source,
        observed: { serving: servingValue, package: packageValue, unit: servingUnit },
        expected: 'a package-to-serving relationship supported by household or serving-count metadata',
        message: 'The package would contain more than 100 unexplained metric-only servings.'
      });
      issues.push(value); servingIssues.push(value); servingReliability = 'UNRELIABLE';
    }
  }
  const reportedServing = finite(input.reportedServingQuantity);
  if (reportedServing !== null && servingValue !== null && reportedServing > 0 && relativeConflict(reportedServing, servingValue, 1, 0.08)) {
    const value = issue({
      code: 'HOUSEHOLD_METRIC_SERVING_CONFLICT', severity: 'ERROR', field: 'serving', source,
      observed: { structured: reportedServing, parsedMetric: servingValue }, expected: 'compatible structured and metric serving quantities',
      message: 'Structured serving quantity conflicts with the metric equivalent in the serving description.'
    });
    issues.push(value); servingIssues.push(value); servingReliability = 'CONFLICTED';
  }

  const nutrients = Object.fromEntries(VALIDATED_NUTRIENT_FIELDS.map((field) => {
    const nutrientIssues: ValidationIssue[] = [];
    const raw = input.values[field];
    const value = finite(raw);
    const expectedUnit = EXPECTED_UNITS[field];
    const providedUnit = input.units?.[field] ?? expectedUnit;
    let reliability: DataReliability = raw === null || raw === undefined || raw === '' ? 'MISSING' : 'KNOWN';
    let selected = value;
    let derived = false;
    if (reliability !== 'MISSING' && value === null) {
      fieldIssue(issues, nutrientIssues, issue({
        code: 'INVALID_NUMERIC_VALUE', severity: 'ERROR', field, source, observed: raw,
        expected: 'a finite numeric value', message: 'The nutrient value is not a finite number.'
      }));
      reliability = 'UNRELIABLE'; selected = null;
    } else if (value !== null && value < 0) {
      fieldIssue(issues, nutrientIssues, issue({
        code: 'IMPOSSIBLE_NEGATIVE_VALUE', severity: 'ERROR', field, source, observed: value,
        expected: 'a value greater than or equal to zero', message: 'Negative nutrient quantities are not physically valid.'
      }));
      reliability = 'UNRELIABLE'; selected = null;
    }
    if (providedUnit && providedUnit.toLowerCase() !== expectedUnit) {
      fieldIssue(issues, nutrientIssues, issue({
        code: 'NUTRIENT_UNIT_CONFLICT', severity: 'ERROR', field, source, observed: providedUnit,
        expected: expectedUnit, message: 'The normalized nutrient unit does not match the scoring unit.'
      }));
      reliability = 'CONFLICTED'; selected = null;
    }
    return [field, { value: selected, unit: expectedUnit, basis, source, reliability, derived, validationIssues: nutrientIssues } satisfies NormalizedNutrient];
  })) as Record<ValidatedNutrientField, NormalizedNutrient>;

  const invalidate = (field: ValidatedNutrientField, validationIssue: ValidationIssue, reliability: DataReliability = 'CONFLICTED') => {
    fieldIssue(issues, nutrients[field].validationIssues, validationIssue);
    nutrients[field].value = null;
    nutrients[field].reliability = reliability;
  };

  const sugar = nutrients.sugar_g.value;
  const addedSugar = nutrients.added_sugar_g.value;
  if (sugar !== null && addedSugar !== null && addedSugar > sugar + 0.1) {
    invalidate('added_sugar_g', issue({
      code: 'ADDED_SUGAR_EXCEEDS_TOTAL_SUGAR', severity: 'ERROR', field: 'added_sugar_g', source,
      observed: { addedSugarG: addedSugar, totalSugarG: sugar }, expected: 'added sugar no greater than total sugar',
      message: 'Added sugar cannot exceed total sugar on the same basis.'
    }));
  } else if (addedSugar === 0 && meaningfulIngredientMatch(input.ingredientsText, CALORIC_ADDED_SWEETENER)) {
    invalidate('added_sugar_g', issue({
      code: 'ADDED_SUGAR_INGREDIENT_CONFLICT', severity: 'ERROR', field: 'added_sugar_g', source,
      observed: { addedSugarG: 0, ingredientSignal: 'caloric_added_sweetener' }, expected: 'nonzero or unknown added sugar when an added caloric sweetener is declared',
      message: 'A declared caloric added sweetener conflicts with a measured added-sugar value of zero.'
    }));
  }

  if (nutrients.fat_g.value === 0 && meaningfulIngredientMatch(input.ingredientsText, ADDED_FAT)) {
    invalidate('fat_g', issue({
      code: 'FAT_INGREDIENT_CONFLICT', severity: 'ERROR', field: 'fat_g', source,
      observed: { fatG: 0, ingredientSignal: 'meaningful_added_fat' }, expected: 'nonzero or unknown fat when a meaningful added fat is declared',
      message: 'A meaningful declared fat or oil conflicts with total fat reported as zero.'
    }));
  }
  if (servingValue !== null && servingValue > 0 && servingReliability === 'KNOWN' && (servingUnit === 'g' || servingUnit === 'ml')) {
    const reference = servingUnit === 'g' ? input.per100g : input.per100ml;
    for (const field of VALIDATED_NUTRIENT_FIELDS) {
      const reported = nutrients[field].value;
      const expected = expectedFromReference(field, reference, servingValue, 100);
      if (reported === null || expected === null) continue;
      const absoluteTolerance = field === 'calories' ? 10 : field === 'sodium_mg' || field === 'caffeine_mg' ? 15 : 0.75;
      if (!relativeConflict(reported, expected, absoluteTolerance, 0.2)) continue;
      if (canDeriveUnambiguousUnitCorrection({ field, reported, expected, servingQuantity: servingValue, ingredientsText: input.ingredientsText })) {
        const correction = issue({
          code: 'UNIT_SCALE_CORRECTED_FROM_REDUNDANT_FIELD', severity: 'INFO', field, source,
          observed: reported, expected: `${round(expected)} ${EXPECTED_UNITS[field]} from the compatible per-100 basis`,
          message: 'A redundant compatible basis established an unambiguous unit-scale correction.'
        });
        fieldIssue(issues, nutrients[field].validationIssues, correction);
        nutrients[field].value = round(expected);
        nutrients[field].reliability = 'ESTIMATED';
        nutrients[field].derived = true;
      } else {
        invalidate(field, issue({
          code: 'SERVING_100G_CONFLICT', severity: 'ERROR', field, source,
          observed: reported, expected: `${round(expected)} ${EXPECTED_UNITS[field]} from the compatible per-100 basis`,
          message: 'Per-serving and per-100 nutrient representations materially disagree.'
        }));
      }
    }
  }

  if (nutrients.sodium_mg.value !== null && nutrients.sodium_mg.value <= 2 && meaningfulIngredientMatch(input.ingredientsText, SODIUM_SOURCE)) {
    invalidate('sodium_mg', issue({
      code: 'SODIUM_INGREDIENT_CONFLICT', severity: 'ERROR', field: 'sodium_mg', source,
      observed: { sodiumMg: nutrients.sodium_mg.value, ingredientSignal: 'meaningful_sodium_source' },
      expected: 'non-negligible or unknown sodium when meaningful sodium sources are declared',
      message: 'Declared sodium sources conflict with a physically implausible near-zero sodium value.'
    }));
  }

  if (servingValue !== null && servingValue > 0 && servingUnit === 'g') {
    const protein = nutrients.protein_g.value;
    const carbohydrate = nutrients.carbs_g.value;
    const fat = nutrients.fat_g.value;
    for (const [field, value] of [['protein_g', protein], ['carbs_g', carbohydrate], ['fat_g', fat], ['saturated_fat_g', nutrients.saturated_fat_g.value], ['fiber_g', nutrients.fiber_g.value], ['sugar_g', nutrients.sugar_g.value]] as const) {
      if (value !== null && value > servingValue * 1.05 + 1) {
        invalidate(field, issue({
          code: 'NUTRIENT_EXCEEDS_FOOD_MASS', severity: 'CRITICAL', field, source, observed: value,
          expected: `no more than the represented ${servingValue} g food mass plus rounding tolerance`,
          message: 'A nutrient mass materially exceeds the food mass represented by the same basis.'
        }), 'UNRELIABLE');
      }
    }
    if (protein !== null && carbohydrate !== null && fat !== null && protein + carbohydrate + fat > servingValue * 1.15 + 2) {
      const massIssue = issue({
        code: 'MACRONUTRIENT_MASS_BALANCE_CONFLICT', severity: 'CRITICAL', field: 'macronutrients', source,
        observed: round(protein + carbohydrate + fat), expected: `no more than ${round(servingValue * 1.15 + 2)} g with tolerance`,
        message: 'Declared macronutrient mass is physically incompatible with the represented food mass.'
      });
      for (const field of ['protein_g', 'carbs_g', 'fat_g'] as const) invalidate(field, massIssue, 'UNRELIABLE');
    }
  }

  const calories = nutrients.calories.value;
  const protein = nutrients.protein_g.value;
  const carbohydrate = nutrients.carbs_g.value;
  const fat = nutrients.fat_g.value;
  if (calories !== null && protein !== null && carbohydrate !== null && fat !== null) {
    const fiber = nutrients.fiber_g.value ?? 0;
    const estimated = protein * 4 + Math.max(0, carbohydrate - fiber) * 4 + fiber * 2 + fat * 9;
    const tolerance = Math.max(15, estimated * 0.3);
    if (Math.abs(calories - estimated) > tolerance) {
      const energyIssue = issue({
        code: 'ENERGY_MACRO_CONFLICT', severity: 'ERROR', field: 'calories', source,
        observed: calories, expected: `approximately ${round(estimated)} kcal with ±${round(tolerance)} kcal validation tolerance`,
        message: 'Declared energy materially disagrees with the available macronutrient estimate.'
      });
      invalidate('calories', energyIssue);
    }
  }

  const fallbackReasons = [
    ...VALIDATED_NUTRIENT_FIELDS.filter((field) => SCORING_RELEVANT_FIELDS.has(field) &&
      ['MISSING', 'CONFLICTED', 'UNRELIABLE'].includes(nutrients[field].reliability)).map((field) => `${field}:${nutrients[field].reliability.toLowerCase()}`),
    ...(['MISSING', 'CONFLICTED', 'UNRELIABLE'].includes(servingReliability) ? [`serving:${servingReliability.toLowerCase()}`] : []),
    ...(!input.ingredientsText?.trim() ? ['ingredients:missing'] : []),
    ...(!categoryAvailable ? ['category:missing'] : []),
    ...(issues.some((item) => item.severity === 'CRITICAL') ? ['critical_validation_failure'] : [])
  ];

  return {
    version: PRODUCT_NUTRITION_VALIDATION_VERSION,
    nutrients,
    serving: {
      value: servingReliability === 'KNOWN' ? servingValue : null,
      unit: servingReliability === 'KNOWN' ? servingUnit : null,
      reliability: servingReliability,
      validationIssues: servingIssues
    },
    validationIssues: issues,
    categoryResolution: {
      category: categoryAvailable ? categories[0] ?? null : null,
      confidence: categoryAvailable && categories.length > 0 ? 0.7 : 0,
      source: categoryAvailable && categories.length > 0 ? [source] : []
    },
    requiresFallback: fallbackReasons.length > 0,
    fallbackReasons: [...new Set(fallbackReasons)]
  };
}

function normalizedWords(value: string | null | undefined): Set<string> {
  return new Set((value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 1));
}

export function textSimilarity(left: string | null | undefined, right: string | null | undefined): number | null {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  if (a.size === 0 || b.size === 0) return null;
  const intersection = [...a].filter((value) => b.has(value)).length;
  return Math.round(intersection / new Set([...a, ...b]).size * 100) / 100;
}

export function packageSizeSimilarity(
  leftQuantity: number | null | undefined,
  leftUnit: string | null | undefined,
  rightQuantity: number | null | undefined,
  rightUnit: string | null | undefined
): number | null {
  if (!leftQuantity || !rightQuantity || !leftUnit || leftUnit !== rightUnit) return null;
  return Math.round(Math.min(leftQuantity, rightQuantity) / Math.max(leftQuantity, rightQuantity) * 100) / 100;
}

export function resolveProductIdentity(input: {
  barcodeMatch: boolean | null;
  primaryBrand?: string | null;
  secondaryBrand?: string | null;
  primaryName?: string | null;
  secondaryName?: string | null;
  primaryPackageQuantity?: number | null;
  primaryPackageUnit?: string | null;
  secondaryPackageQuantity?: number | null;
  secondaryPackageUnit?: string | null;
  primaryIngredients?: string | null;
  secondaryIngredients?: string | null;
  formulationDateCompatibility?: number | null;
}): ProductIdentityResolution {
  const signals: ProductIdentitySignals = {
    barcodeMatch: input.barcodeMatch,
    brandSimilarity: textSimilarity(input.primaryBrand, input.secondaryBrand),
    productNameSimilarity: textSimilarity(input.primaryName, input.secondaryName),
    packageSizeSimilarity: packageSizeSimilarity(
      input.primaryPackageQuantity, input.primaryPackageUnit,
      input.secondaryPackageQuantity, input.secondaryPackageUnit
    ),
    ingredientSimilarity: textSimilarity(input.primaryIngredients, input.secondaryIngredients),
    formulationDateCompatibility: input.formulationDateCompatibility ?? null
  };
  if (signals.barcodeMatch === false) return { confidence: 0, accepted: false, signals };
  let confidence = signals.barcodeMatch === true ? 0.65 : 0;
  if ((signals.brandSimilarity ?? 0) >= 0.75) confidence += 0.1;
  if ((signals.productNameSimilarity ?? 0) >= 0.45) confidence += 0.1;
  if ((signals.packageSizeSimilarity ?? 0) >= 0.8) confidence += 0.05;
  if ((signals.ingredientSimilarity ?? 0) >= 0.45) confidence += 0.1;
  if ((signals.formulationDateCompatibility ?? 1) < 0.4) confidence -= 0.15;
  confidence = Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
  return { confidence, accepted: confidence >= PRODUCT_IDENTITY_ACCEPTANCE_THRESHOLD, signals };
}

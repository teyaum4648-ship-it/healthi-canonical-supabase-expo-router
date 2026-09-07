import type { DataConfidence } from '../../../engines/nutrition';
import type {
  NormalizedProviderNutrition,
  NutrientBasis,
  NutrientConflictStatus,
  NutrientEvidenceLedger,
  NutrientIdentifier,
  NutrientMetricUnit,
  NutrientObservation,
  NutrientSelection,
  ProductEvidenceProviderId
} from './productDataProvider';

export const NUTRIENT_IDENTIFIERS: NutrientIdentifier[] = [
  'calories',
  'protein_g',
  'carbs_g',
  'fat_g',
  'saturated_fat_g',
  'fiber_g',
  'sugar_g',
  'added_sugar_g',
  'sodium_mg',
  'caffeine_mg'
];

const STANDARD_UNITS: Record<NutrientIdentifier, NutrientObservation['unit']> = {
  calories: 'kcal',
  protein_g: 'g',
  carbs_g: 'g',
  fat_g: 'g',
  saturated_fat_g: 'g',
  fiber_g: 'g',
  sugar_g: 'g',
  added_sugar_g: 'g',
  sodium_mg: 'mg',
  caffeine_mg: 'mg'
};

const CONFIDENCE_RANK: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function safeIdPart(value: string | null): string {
  return (value ?? 'none').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

export function nutrientObservation(input: Omit<NutrientObservation,
  'id' | 'conflictStatus' | 'plausibilityFlags' | 'plausibilityNotes' | 'selectedFor' | 'rejectionReasons'
> & { id?: string }): NutrientObservation {
  return {
    ...input,
    id: input.id ?? [
      input.provider,
      safeIdPart(input.providerRecordId),
      input.nutrient,
      input.basis,
      safeIdPart(input.rawField),
      String(input.value)
    ].join(':'),
    value: round(input.value),
    conflictStatus: 'none',
    plausibilityFlags: [],
    plausibilityNotes: [],
    selectedFor: [],
    rejectionReasons: []
  };
}

export function metricServing(value: number | null | undefined, unit: string | null | undefined): {
  quantity: number;
  unit: NutrientMetricUnit;
} | null {
  const normalizedUnit = unit?.trim().toLowerCase();
  return typeof value === 'number' && Number.isFinite(value) && value > 0 &&
    (normalizedUnit === 'g' || normalizedUnit === 'ml')
    ? { quantity: value, unit: normalizedUnit }
    : null;
}

export function derivePerServingObservation(
  source: NutrientObservation,
  servingQuantity: number,
  servingUnit: NutrientMetricUnit
): NutrientObservation | null {
  const compatible = source.basis === 'per_100g' && servingUnit === 'g' ||
    source.basis === 'per_100ml' && servingUnit === 'ml';
  if (!compatible || !Number.isFinite(servingQuantity) || servingQuantity <= 0) return null;
  return nutrientObservation({
    nutrient: source.nutrient,
    value: source.value * servingQuantity / 100,
    unit: source.unit,
    basis: 'per_serving',
    servingQuantity,
    servingUnit,
    packageQuantity: source.packageQuantity,
    packageUnit: source.packageUnit,
    provider: source.provider,
    providerRecordId: source.providerRecordId,
    directlyReported: false,
    derivedFrom: [source.id],
    conversionFormula: `${source.id} × ${servingQuantity} ${servingUnit} ÷ 100 ${servingUnit}`,
    conversionConfidence: source.confidence,
    confidence: source.confidence,
    sourceTimestamp: source.sourceTimestamp,
    rawField: source.rawField,
    selectionReason: null
  });
}

function addFlag(observation: NutrientObservation, flag: string): void {
  if (!observation.plausibilityFlags.includes(flag)) observation.plausibilityFlags.push(flag);
  observation.conflictStatus = 'suspicious';
  observation.confidence = 'low';
}

function addNote(observation: NutrientObservation, note: string): void {
  if (!observation.plausibilityNotes.includes(note)) observation.plausibilityNotes.push(note);
}

export type MacroEnergyAssessment = {
  reportedCalories: number;
  estimatedCalories: number;
  discrepancy: number;
  tolerance: number;
  proportionalTolerance: number;
  roundingTolerance: number;
  accepted: boolean;
  formula: string;
  reason: string;
};

function lowerConfidence(values: DataConfidence[]): DataConfidence {
  const rank: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };
  return values.reduce((lowest, value) => rank[value] < rank[lowest] ? value : lowest, 'high' as DataConfidence);
}

export function assessMacroEnergyPlausibility(input: {
  calories: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG?: number | null;
  confidence: DataConfidence;
  directlyReported: boolean;
}): MacroEnergyAssessment {
  const fiber = input.fiberG ?? 0;
  const digestibleCarbohydrate = Math.max(0, input.carbohydrateG - fiber);
  const estimatedCalories = input.proteinG * 4 + digestibleCarbohydrate * 4 + fiber * 2 + input.fatG * 9;
  const discrepancy = Math.abs(input.calories - estimatedCalories);
  const proportionalRate = !input.directlyReported || input.confidence === 'low'
    ? 0.3
    : input.confidence === 'high'
      ? 0.15
      : 0.2;
  const proportionalTolerance = estimatedCalories * proportionalRate;
  // Direct label macros commonly round to whole grams. The maximum ordinary
  // energy swing from half-gram rounding across protein, carbohydrate, and fat
  // is approximately nine calories. Derived or low-confidence observations
  // receive a bounded 15-calorie allowance instead of an unbounded percentage.
  const roundingTolerance = input.directlyReported && input.confidence === 'high'
    ? 9
    : input.directlyReported
      ? 10
      : 15;
  const nearZeroTolerance = Math.max(input.calories, estimatedCalories) <= 10 ? roundingTolerance : 0;
  const tolerance = Math.round(Math.max(roundingTolerance, nearZeroTolerance, proportionalTolerance) * 10) / 10;
  const roundedEstimate = Math.round(estimatedCalories * 10) / 10;
  const roundedDiscrepancy = Math.round(discrepancy * 10) / 10;
  const accepted = discrepancy <= tolerance;
  const formula = `4×protein + 4×(carbohydrate−fiber) + 2×fiber + 9×fat`;
  const reason = `macro_energy_${accepted ? 'accepted' : 'rejected'}: reported ${input.calories} kcal, estimated ${roundedEstimate} kcal, discrepancy ${roundedDiscrepancy} kcal, tolerance ${tolerance} kcal (${Math.round(proportionalRate * 100)}% proportional plus bounded rounding allowance); ${formula}.`;
  return {
    reportedCalories: input.calories,
    estimatedCalories: roundedEstimate,
    discrepancy: roundedDiscrepancy,
    tolerance,
    proportionalTolerance: Math.round(proportionalTolerance * 10) / 10,
    roundingTolerance,
    accepted,
    formula,
    reason
  };
}

function basicPlausibility(observation: NutrientObservation): void {
  if (!Number.isFinite(observation.value)) addFlag(observation, 'non_finite_value');
  if (observation.value < 0) addFlag(observation, 'impossible_negative_value');
  if (observation.unit !== STANDARD_UNITS[observation.nutrient]) addFlag(observation, 'incompatible_nutrient_unit');
  if (observation.basis === 'unknown') addFlag(observation, 'unknown_nutrient_basis');
  if (observation.basis === 'per_serving' && !metricServing(observation.servingQuantity, observation.servingUnit)) {
    addFlag(observation, 'missing_metric_serving_denominator');
  }
  if (observation.basis === 'per_package' && !metricServing(observation.packageQuantity, observation.packageUnit)) {
    addFlag(observation, 'missing_metric_package_denominator');
  }
  if (observation.basis === 'per_serving' && observation.packageQuantity && observation.packageUnit &&
    observation.servingQuantity && observation.servingUnit === observation.packageUnit &&
    observation.servingQuantity > observation.packageQuantity * 1.05) {
    addFlag(observation, 'serving_exceeds_package_quantity');
  }

  const denominator = observation.basis === 'per_serving'
    ? observation.servingQuantity ?? null
    : observation.basis === 'per_100g' || observation.basis === 'per_100ml'
      ? 100
      : null;
  if (denominator !== null) {
    if (observation.unit === 'g' && observation.value > denominator * 1.05 + 1) {
      addFlag(observation, 'implausible_nutrient_density');
    }
    if (observation.nutrient === 'calories' && observation.value > denominator * 10 + 50) {
      addFlag(observation, 'implausible_calorie_density');
    }
    if (observation.nutrient === 'sodium_mg' && observation.value > denominator * 500 + 50) {
      addFlag(observation, 'implausible_sodium_density');
    }
  }
  if (observation.nutrient === 'calories' && observation.value > 5_000) addFlag(observation, 'implausible_unit_magnitude');
  if (observation.unit === 'g' && observation.value > 1_000) addFlag(observation, 'implausible_unit_magnitude');
  if ((observation.nutrient === 'sodium_mg' || observation.nutrient === 'caffeine_mg') && observation.value > 100_000) {
    addFlag(observation, 'implausible_unit_magnitude');
  }
}

function observationGroupKey(observation: NutrientObservation): string {
  return [
    observation.provider,
    observation.providerRecordId ?? '',
    observation.basis,
    observation.servingQuantity ?? '',
    observation.servingUnit ?? '',
    observation.packageQuantity ?? '',
    observation.packageUnit ?? ''
  ].join('|');
}

function crossFieldPlausibility(observations: NutrientObservation[]): void {
  const groups = new Map<string, NutrientObservation[]>();
  for (const observation of observations) {
    const current = groups.get(observationGroupKey(observation)) ?? [];
    current.push(observation);
    groups.set(observationGroupKey(observation), current);
  }
  for (const group of groups.values()) {
    const nutrientItems = (nutrient: NutrientIdentifier) => group.filter((item) => item.nutrient === nutrient);
    const carbs = nutrientItems('carbs_g');
    const sugars = nutrientItems('sugar_g');
    const fibers = nutrientItems('fiber_g');
    const fats = nutrientItems('fat_g');
    const saturatedFats = nutrientItems('saturated_fat_g');
    const proteins = nutrientItems('protein_g');
    const calories = nutrientItems('calories');
    const maximumCarbs = carbs.length > 0 ? Math.max(...carbs.map((item) => item.value)) : null;
    const maximumFat = fats.length > 0 ? Math.max(...fats.map((item) => item.value)) : null;
    if (maximumCarbs !== null) {
      for (const sugar of sugars.filter((item) => item.value > maximumCarbs + 1)) addFlag(sugar, 'sugar_exceeds_total_carbohydrate');
      for (const fiber of fibers.filter((item) => item.value > maximumCarbs + 1)) addFlag(fiber, 'fiber_exceeds_total_carbohydrate');
    }
    if (maximumFat !== null) {
      for (const saturatedFat of saturatedFats.filter((item) => item.value > maximumFat + 0.5)) {
        addFlag(saturatedFat, 'saturated_fat_exceeds_total_fat');
      }
    }
    if (calories.length > 0 && proteins.length > 0 && carbs.length > 0 && fats.length > 0) {
      const safeFibers = fibers.filter((fiber) => fiber.plausibilityFlags.length === 0);
      const fiberOptions: Array<NutrientObservation | null> = safeFibers.length > 0 ? safeFibers : [null];
      const assessments = calories.flatMap((calorie) => proteins.flatMap((protein) => carbs.flatMap((carbohydrate) => (
        fats.flatMap((fat) => fiberOptions.flatMap((fiber) => {
          if (fiber && fiber.value > carbohydrate.value + 1) return [];
          const assessment = assessMacroEnergyPlausibility({
            calories: calorie.value,
            proteinG: protein.value,
            carbohydrateG: carbohydrate.value,
            fatG: fat.value,
            fiberG: fiber?.value ?? null,
            confidence: lowerConfidence([calorie.confidence, protein.confidence, carbohydrate.confidence, fat.confidence]),
            directlyReported: calorie.directlyReported && protein.directlyReported && carbohydrate.directlyReported && fat.directlyReported
          });
          return [{ calorie, protein, carbohydrate, fat, fiber, assessment }];
        }))
      ))));
      const energyObservations = [...calories, ...proteins, ...carbs, ...fats];
      for (const observation of energyObservations) {
        const relevant = assessments.filter((entry) => (
          entry.calorie === observation || entry.protein === observation ||
          entry.carbohydrate === observation || entry.fat === observation
        ));
        const accepted = relevant.find((entry) => entry.assessment.accepted);
        if (accepted) {
          addNote(observation, accepted.assessment.reason);
          continue;
        }
        const closest = [...relevant].sort((left, right) => (
          left.assessment.discrepancy - right.assessment.discrepancy ||
          left.assessment.tolerance - right.assessment.tolerance
        ))[0];
        if (closest) addNote(observation, closest.assessment.reason);
        addFlag(observation, 'macronutrient_energy_mismatch');
      }
    } else if (calories.length > 0) {
      const note = 'macro_energy_not_compared: compatible protein, carbohydrate, and fat observations were not all available; reported calories were retained without inventing missing macros.';
      for (const observation of group) addNote(observation, note);
    }
  }

  const suspiciousIds = new Set(observations.filter((observation) => observation.plausibilityFlags.length > 0).map((observation) => observation.id));
  for (const observation of observations) {
    if ((observation.derivedFrom ?? []).some((sourceId) => suspiciousIds.has(sourceId))) {
      addFlag(observation, 'derived_from_suspicious_observation');
      addNote(observation, 'Dependent conversion was excluded because its source observation failed plausibility.');
    }
  }
}

function compatibleDenominator(left: NutrientObservation, right: NutrientObservation): boolean {
  if (left.basis !== right.basis) return false;
  if (left.basis !== 'per_serving') return true;
  if (left.servingUnit !== right.servingUnit || !left.servingQuantity || !right.servingQuantity) return false;
  return Math.abs(left.servingQuantity - right.servingQuantity) <= Math.max(1, left.servingQuantity * 0.05);
}

function materiallyDifferent(nutrient: NutrientIdentifier, left: number, right: number): boolean {
  const absoluteTolerance = nutrient === 'calories' ? 15 : nutrient === 'sodium_mg' || nutrient === 'caffeine_mg' ? 30 : 1;
  if (Math.abs(left - right) <= absoluteTolerance) return false;
  const low = Math.min(Math.abs(left), Math.abs(right));
  const high = Math.max(Math.abs(left), Math.abs(right));
  return low === 0 ? high > absoluteTolerance : high / low > 1.25;
}

function rankObservation(observation: NutrientObservation): [number, number, number, number] {
  const direct = observation.directlyReported ? 1 : 0;
  const timestamp = observation.sourceTimestamp ? Date.parse(observation.sourceTimestamp) : 0;
  const freshness = Number.isFinite(timestamp) ? timestamp : 0;
  return [direct, freshness, CONFIDENCE_RANK[observation.confidence], observation.derivedFrom?.length ? 0 : 1];
}

function compareRank(left: NutrientObservation, right: NutrientObservation): number {
  const leftRank = rankObservation(left);
  const rightRank = rankObservation(right);
  for (let index = 0; index < leftRank.length; index += 1) {
    if (leftRank[index] !== rightRank[index]) return rightRank[index]! - leftRank[index]!;
  }
  return left.id.localeCompare(right.id);
}

function targetSelections(
  observations: NutrientObservation[],
  nutrient: NutrientIdentifier,
  targetBasis: NutrientSelection['targetBasis'],
  conflicts: string[]
): NutrientSelection {
  const candidates = observations.filter((observation) => observation.nutrient === nutrient && observation.basis === targetBasis);
  const safe = candidates.filter((observation) => observation.plausibilityFlags.length === 0);
  for (let leftIndex = 0; leftIndex < safe.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < safe.length; rightIndex += 1) {
      const left = safe[leftIndex]!;
      const right = safe[rightIndex]!;
      if (!compatibleDenominator(left, right) || !materiallyDifferent(nutrient, left.value, right.value)) continue;
      left.conflictStatus = 'material_conflict';
      right.conflictStatus = 'material_conflict';
      conflicts.push(`${nutrient} materially differs across compatible ${targetBasis} observations.`);
    }
  }
  const ranked = safe.filter((candidate) => candidate.conflictStatus !== 'material_conflict').sort(compareRank);
  const winner = ranked[0] ?? null;
  if (winner) {
    winner.selectedFor.push(targetBasis);
    const selection = winner.directlyReported
      ? 'Selected as the highest-ranked plausible directly reported observation with a known compatible basis.'
      : 'Selected as the highest-ranked plausible derived observation with a documented conversion.';
    winner.selectionReason = [selection, ...winner.plausibilityNotes].join(' ');
  }
  for (const candidate of candidates) {
    if (candidate === winner) continue;
    const reason = candidate.plausibilityFlags.length > 0
      ? `Rejected from ${targetBasis}: ${candidate.plausibilityFlags.join(', ')}.`
      : winner
        ? `Rejected from ${targetBasis}: a higher-ranked compatible observation was selected.`
        : `Rejected from ${targetBasis}: no safe observation was available.`;
    candidate.rejectionReasons.push(reason);
  }
  const conflictStatus: NutrientConflictStatus = candidates.some((candidate) => candidate.conflictStatus === 'suspicious')
    ? 'suspicious'
    : candidates.some((candidate) => candidate.conflictStatus === 'material_conflict')
      ? 'material_conflict'
      : candidates.length > 1
        ? 'compatible_duplicate'
        : 'none';
  return {
    nutrient,
    targetBasis,
    selectedObservationId: winner?.id ?? null,
    rejectedObservationIds: candidates.filter((candidate) => candidate !== winner).map((candidate) => candidate.id),
    selectionReason: winner?.selectionReason ?? 'No plausible observation with the requested known basis was available.',
    conflictStatus
  };
}

export function buildNutrientEvidenceLedger(
  input: NutrientObservation[],
  context?: { servingQuantity?: number | null; servingUnit?: string | null }
): NutrientEvidenceLedger {
  const observations: NutrientObservation[] = input.map((observation) => ({
    ...observation,
    derivedFrom: [...(observation.derivedFrom ?? [])],
    plausibilityFlags: [...(observation.plausibilityFlags ?? [])],
    plausibilityNotes: [...(observation.plausibilityNotes ?? [])],
    selectedFor: [],
    rejectionReasons: [...(observation.rejectionReasons ?? [])],
    conflictStatus: observation.conflictStatus ?? 'none' as NutrientConflictStatus,
    selectionReason: null
  }));
  for (const observation of observations) basicPlausibility(observation);
  const selectedServing = metricServing(context?.servingQuantity, context?.servingUnit);
  if (selectedServing) {
    for (const observation of observations.filter((item) => item.basis === 'per_serving')) {
      const sameUnit = observation.servingUnit === selectedServing.unit;
      const sameQuantity = typeof observation.servingQuantity === 'number' &&
        Math.abs(observation.servingQuantity - selectedServing.quantity) <= Math.max(1, selectedServing.quantity * 0.05);
      if (!sameUnit || !sameQuantity) addFlag(observation, 'selected_serving_context_mismatch');
    }
  }
  crossFieldPlausibility(observations);
  const conflicts: string[] = [];
  const selections = NUTRIENT_IDENTIFIERS.flatMap((nutrient) => (
    (['per_serving', 'per_100g', 'per_100ml'] as const).map((basis) => targetSelections(observations, nutrient, basis, conflicts))
  ));
  for (const observation of observations.filter((item) => item.basis === 'unknown' || item.basis === 'per_package')) {
    if (observation.rejectionReasons.length === 0) {
      observation.rejectionReasons.push(
        observation.basis === 'per_package'
          ? 'Package-basis evidence is retained but is not treated as a serving value.'
          : 'Unknown-basis evidence is retained but excluded from scoring.'
      );
    }
  }
  return {
    version: 'nutrient_evidence_v1',
    observations,
    selections,
    conflicts: [...new Set([
      ...conflicts,
      ...observations.flatMap((observation) => observation.plausibilityFlags.map((flag) => `${observation.nutrient}: ${flag}`))
    ])]
  };
}

export function selectedNutrition(
  ledger: NutrientEvidenceLedger,
  targetBasis: NutrientSelection['targetBasis']
): NormalizedProviderNutrition {
  const byId = new Map(ledger.observations.map((observation) => [observation.id, observation]));
  return Object.fromEntries(NUTRIENT_IDENTIFIERS.map((nutrient) => {
    const selection = ledger.selections.find((item) => item.nutrient === nutrient && item.targetBasis === targetBasis);
    const observation = selection?.selectedObservationId ? byId.get(selection.selectedObservationId) : null;
    return [nutrient, observation?.value ?? null];
  }));
}

export function legacyNutrientObservations(input: {
  nutrition: NormalizedProviderNutrition;
  provider: ProductEvidenceProviderId;
  providerRecordId: string | null;
  servingQuantity: number | null;
  servingUnit: string | null;
  sourceTimestamp: string | null;
  confidence: DataConfidence;
}): NutrientObservation[] {
  const serving = metricServing(input.servingQuantity, input.servingUnit);
  return NUTRIENT_IDENTIFIERS.flatMap((nutrient) => {
    const value = input.nutrition[nutrient];
    if (typeof value !== 'number' || !Number.isFinite(value)) return [];
    return [nutrientObservation({
      nutrient,
      value,
      unit: STANDARD_UNITS[nutrient],
      basis: serving ? 'per_serving' : 'unknown',
      servingQuantity: serving?.quantity ?? null,
      servingUnit: serving?.unit ?? null,
      provider: input.provider,
      providerRecordId: input.providerRecordId,
      directlyReported: true,
      derivedFrom: [],
      conversionFormula: null,
      conversionConfidence: input.confidence,
      confidence: input.confidence,
      sourceTimestamp: input.sourceTimestamp,
      rawField: nutrient,
      selectionReason: null
    })];
  });
}

export function combineNutrientEvidence(
  ledgers: Array<NutrientEvidenceLedger | null | undefined>,
  legacy: NutrientObservation[] = [],
  context?: { servingQuantity?: number | null; servingUnit?: string | null }
): NutrientEvidenceLedger {
  const observations = [...ledgers.flatMap((ledger) => ledger?.observations ?? []), ...legacy];
  const unique = observations.filter((observation, index) => observations.findIndex((candidate) => candidate.id === observation.id) === index);
  return buildNutrientEvidenceLedger(unique, context);
}

export function nutrientEvidenceConfidence(
  ledger: NutrientEvidenceLedger,
  targetBasis: NutrientSelection['targetBasis'] = 'per_serving'
): DataConfidence {
  const selected = ledger.observations.filter((observation) => observation.selectedFor.includes(targetBasis));
  if (selected.length === 0) return 'low';
  const minimum = Math.min(...selected.map((observation) => CONFIDENCE_RANK[observation.confidence]));
  const hasMaterialConflict = selected.some((observation) => observation.conflictStatus === 'material_conflict');
  if (hasMaterialConflict) return 'low';
  if (selected.length >= 5 && minimum >= CONFIDENCE_RANK.high) return 'high';
  return minimum >= CONFIDENCE_RANK.medium ? 'medium' : 'low';
}

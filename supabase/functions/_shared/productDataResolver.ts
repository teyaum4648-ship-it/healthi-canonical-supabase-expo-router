// @ts-ignore Deno Edge imports require the explicit TypeScript extension.
import { parseIngredients } from '../../../src/engines/nutrition/productScoring/ingredientParser.ts';
// @ts-ignore Deno Edge imports require the explicit TypeScript extension.
import { PRODUCT_NUTRITION_VALIDATION_VERSION, VALIDATED_NUTRIENT_FIELDS, resolveProductIdentity, validateNutritionData, type DataReliability, type NutritionValidationResult, type ProductIdentityResolution, type ProviderResolutionTrace, type ValidationIssue } from '../../../src/features/nutrition/productLookup/nutritionValidation.ts';

export type ResolverProvider = 'open_food_facts' | 'usda_food_data_central';
export type ResolverSourceStatus = 'found' | 'not_found' | 'unavailable';

export type ResolverNutrient =
  | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'saturated_fat_g'
  | 'fiber_g' | 'sugar_g' | 'added_sugar_g' | 'sodium_mg' | 'caffeine_mg';
export type ResolverNutrientBasis = 'per_serving' | 'per_100g' | 'per_100ml' | 'per_package' | 'unknown';
export type ResolverNutrientObservation = {
  id: string;
  nutrient: ResolverNutrient;
  value: number;
  unit: 'kcal' | 'g' | 'mg';
  basis: ResolverNutrientBasis;
  servingQuantity: number | null;
  servingUnit: 'g' | 'ml' | null;
  packageQuantity: number | null;
  packageUnit: 'g' | 'ml' | null;
  provider: ResolverProvider;
  providerRecordId: string | null;
  directlyReported: boolean;
  derivedFrom: string[];
  conversionFormula: string | null;
  conversionConfidence: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  sourceTimestamp: string | null;
  rawField: string;
  selectionReason: string | null;
  conflictStatus: 'none' | 'compatible_duplicate' | 'material_conflict' | 'suspicious';
  plausibilityFlags: string[];
  plausibilityNotes: string[];
  selectedFor: Array<'per_serving' | 'per_100g' | 'per_100ml'>;
  rejectionReasons: string[];
};

export type ResolverNutrientLedger = {
  version: 'nutrient_evidence_v1';
  observations: ResolverNutrientObservation[];
  selections: Array<{
    nutrient: ResolverNutrient;
    targetBasis: 'per_serving' | 'per_100g' | 'per_100ml';
    selectedObservationId: string | null;
    rejectedObservationIds: string[];
    selectionReason: string;
    conflictStatus: 'none' | 'compatible_duplicate' | 'material_conflict' | 'suspicious';
  }>;
  conflicts: string[];
};

export type ResolverProviderRecord = {
  provider: ResolverProvider;
  status: ResolverSourceStatus;
  recordId: string | null;
  updatedAt: string | null;
  fields: Record<string, unknown>;
  attempts?: number;
  httpStatuses?: number[];
  failureReason?: string | null;
};

export type ProductEvidenceLevel = 'full' | 'good' | 'partial' | 'minimum_defensible' | 'abstain';

export type ProductEvidenceSufficiency = {
  level: ProductEvidenceLevel;
  supports_bounded_interpretation: boolean;
  exact_identity_established: boolean;
  ingredient_token_count: number;
  selected_nutrient_count: number;
  metric_serving_available: boolean;
  category_context_available: boolean;
  material_conflict: boolean;
  supported_evidence_domains: string[];
  unsupported_evidence_domains: string[];
  reasons: string[];
};

export type ProductResolutionTrace = {
  version: 'product_resolution_trace_v3';
  normalized_gtin: string;
  cache: {
    attempted: boolean;
    result: 'miss' | 'invalid' | 'fresh_sufficient' | 'fresh_insufficient' | 'stale_sufficient' | 'stale_insufficient';
    sufficiency: ProductEvidenceSufficiency | null;
  };
  source_a: ProductResolutionProviderTrace;
  source_b: ProductResolutionProviderTrace & {
    invocation_reason: 'source_a_unavailable' | 'source_a_not_found' | 'source_a_materially_insufficient' | 'source_a_validation_failed' | 'not_required_source_a_sufficient' | 'not_configured';
  };
  merge: {
    attempted: boolean;
    exact_identity_compatible: boolean;
    identity_confidence: number | null;
    identity_resolution: ProductIdentityResolution | null;
    selected_fields: Record<ResolverProvider, string[]>;
    rejected_fields: Record<ResolverProvider, string[]>;
    conflicts: string[];
  };
  sufficiency_before_source_b: ProductEvidenceSufficiency | null;
  sufficiency_after_source_b: ProductEvidenceSufficiency | null;
  final_scoring_scope: 'overall' | 'supported_evidence' | 'none';
  final_result_state: 'resolved' | 'more_data_needed' | 'identity_unresolved' | 'provider_unavailable';
  abstention_reason: string | null;
};

export type ProductResolutionProviderTrace = {
  provider: ResolverProvider;
  attempted: boolean;
  result: 'skipped' | ResolverSourceStatus;
  selected_fields: string[];
  rejected_fields: string[];
  attempt_count: number;
  http_statuses: number[];
  failure_reason: string | null;
};

export type ProductDataResolution =
  | {
      status: 'resolved';
      canonicalGtin: string;
      product: Record<string, unknown>;
      sources: Array<{ provider: ResolverProvider; status: ResolverSourceStatus; record_id: string | null; source_timestamp?: string | null }>;
      cache?: ProductCacheDisclosure;
      trace?: ProductResolutionTrace;
    }
  | {
      status: 'identity_unresolved' | 'provider_unavailable';
      canonicalGtin: string | null;
      message: string;
      sources: Array<{ provider: ResolverProvider; status: ResolverSourceStatus; record_id: string | null; source_timestamp?: string | null }>;
      trace?: ProductResolutionTrace;
    };

export type ProductCacheDisclosure = {
  status: 'fresh' | 'stale' | 'refreshed' | 'miss';
  fetched_at: string | null;
  resolver_version: string;
};

export type CanonicalProductCacheRecord = {
  canonicalGtin: string;
  resolution: Extract<ProductDataResolution, { status: 'resolved' }>;
  providerProvenance: unknown;
  providerConflicts: unknown;
  sourceTimestamps: Record<string, string | null>;
  resolverVersion: string;
  fetchedAt: string;
  freshUntil: string;
  lastSuccessfulProviderAt: string;
  payloadBytes: number;
};

export type CanonicalProductCacheStore = {
  get(canonicalGtin: string): Promise<CanonicalProductCacheRecord | null>;
  put(record: CanonicalProductCacheRecord): Promise<void>;
};

const RESOLVER_VERSION = 'product_data_resolver_v3';
const MAX_CACHE_PAYLOAD_BYTES = 262_144;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDER_MINIMUM_INTERVAL_MS: Record<ResolverProvider, number> = {
  open_food_facts: 4_100,
  usda_food_data_central: 1_000
};

type ResolverProviderRequestState = {
  tails: Map<ResolverProvider, Promise<void>>;
  nextAllowedAt: Map<ResolverProvider, number>;
};

type ResolverRuntime = typeof globalThis & {
  __healthiResolverProviderRequestState?: ResolverProviderRequestState;
};

const resolverRuntime = globalThis as ResolverRuntime;
const resolverProviderRequestState = resolverRuntime.__healthiResolverProviderRequestState ?? {
  tails: new Map<ResolverProvider, Promise<void>>(),
  nextAllowedAt: new Map<ResolverProvider, number>()
};
resolverRuntime.__healthiResolverProviderRequestState = resolverProviderRequestState;

async function scheduledProviderRequest<T>(
  provider: ResolverProvider,
  waiter: (milliseconds: number) => Promise<void>,
  request: () => Promise<T>
): Promise<T> {
  const previous = resolverProviderRequestState.tails.get(provider) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  resolverProviderRequestState.tails.set(provider, previous.catch(() => undefined).then(() => next));
  await previous.catch(() => undefined);
  try {
    const delay = Math.max(0, (resolverProviderRequestState.nextAllowedAt.get(provider) ?? 0) - Date.now());
    if (delay > 0) await waiter(delay);
    resolverProviderRequestState.nextAllowedAt.set(provider, Date.now() + PROVIDER_MINIMUM_INTERVAL_MS[provider]);
    return await request();
  } finally {
    release();
  }
}

function providerRetryAfterMilliseconds(value: string | null, now = Date.now()): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

function finite(value: unknown): number | null {
  const result = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(result) && result >= 0 ? Math.round(result * 10) / 10 : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const sanitized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return sanitized ? sanitized.slice(0, 20_000) : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function validGtin(value: string): string | null {
  const gtin = value.trim().replace(/[\s-]+/g, '');
  if (!/^\d{8}$|^\d{12,14}$/.test(gtin)) return null;
  const digits = [...gtin].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  if ((10 - sum % 10) % 10 !== check) return null;
  if (gtin.length === 14 && gtin.startsWith('00')) return gtin.slice(2);
  if (gtin.length === 13 && gtin.startsWith('0')) return gtin.slice(1);
  return gtin;
}

function tagList(value: unknown): string[] {
  return list(value).flatMap((item) => {
    if (typeof item !== 'string') return [];
    const normalized = item.replace(/^[a-z]{2}:/i, '').replace(/-/g, ' ').trim();
    return normalized && !/^(undefined|null|unknown|n\/?a|none)$/i.test(normalized) ? [normalized] : [];
  });
}

function offNutrientObservations(
  nutrients: Record<string, unknown>,
  providerRecordId: string | null,
  updatedAt: string | null,
  serving: { quantity: number; unit: 'g' | 'ml' } | null,
  packageMetric: { quantity: number; unit: 'g' | 'ml' } | null
): ResolverNutrientObservation[] {
  const specs: Array<{ nutrient: ResolverNutrient; keys: string[]; unit: 'kcal' | 'g' | 'mg'; multiplier: number }> = [
    { nutrient: 'calories', keys: ['energy-kcal', 'energy_kcal'], unit: 'kcal', multiplier: 1 },
    { nutrient: 'protein_g', keys: ['proteins'], unit: 'g', multiplier: 1 },
    { nutrient: 'carbs_g', keys: ['carbohydrates'], unit: 'g', multiplier: 1 },
    { nutrient: 'fat_g', keys: ['fat'], unit: 'g', multiplier: 1 },
    { nutrient: 'saturated_fat_g', keys: ['saturated-fat'], unit: 'g', multiplier: 1 },
    { nutrient: 'fiber_g', keys: ['fiber'], unit: 'g', multiplier: 1 },
    { nutrient: 'sugar_g', keys: ['sugars'], unit: 'g', multiplier: 1 },
    { nutrient: 'added_sugar_g', keys: ['added-sugars'], unit: 'g', multiplier: 1 },
    { nutrient: 'sodium_mg', keys: ['sodium_mg'], unit: 'mg', multiplier: 1 },
    { nutrient: 'sodium_mg', keys: ['sodium'], unit: 'mg', multiplier: 1_000 },
    { nutrient: 'sodium_mg', keys: ['salt'], unit: 'mg', multiplier: 400 },
    { nutrient: 'caffeine_mg', keys: ['caffeine_mg'], unit: 'mg', multiplier: 1 },
    { nutrient: 'caffeine_mg', keys: ['caffeine'], unit: 'mg', multiplier: 1_000 }
  ];
  const observations: ResolverNutrientObservation[] = [];
  for (const spec of specs) for (const key of spec.keys) for (const suffix of ['serving', '100g', '100ml', 'package'] as const) {
    const rawField = `${key}_${suffix}`;
    const rawValue = signed(nutrients[rawField]);
    if (rawValue === null) continue;
    const basis: ResolverNutrientBasis = suffix === 'serving'
      ? serving ? 'per_serving' : 'unknown'
      : suffix === '100g'
        ? 'per_100g'
        : suffix === '100ml'
          ? 'per_100ml'
          : 'per_package';
    const observation = resolverObservation({
      nutrient: spec.nutrient, value: rawValue * spec.multiplier, unit: spec.unit, basis,
      servingQuantity: suffix === 'serving' ? serving?.quantity ?? null : null,
      servingUnit: suffix === 'serving' ? serving?.unit ?? null : null,
      packageQuantity: packageMetric?.quantity ?? null, packageUnit: packageMetric?.unit ?? null,
      provider: 'open_food_facts', providerRecordId, directlyReported: true, derivedFrom: [],
      conversionFormula: spec.multiplier === 1 ? null : `${rawField} × ${spec.multiplier}`,
      conversionConfidence: 'high', confidence: basis === 'unknown' ? 'low' : 'medium',
      sourceTimestamp: updatedAt, rawField, selectionReason: null
    });
    observations.push(observation);
    if (serving && (basis === 'per_100g' || basis === 'per_100ml')) {
      const derived = resolverDerivedObservation(observation, serving);
      if (derived) observations.push(derived);
    }
  }
  return observations;
}

function normalizeOff(payload: unknown, gtin: string): ResolverProviderRecord {
  const body = record(payload);
  const product = record(body.product);
  if (finite(body.status) !== 1 || Object.keys(product).length === 0) {
    return { provider: 'open_food_facts', status: 'not_found', recordId: null, updatedAt: null, fields: {} };
  }
  const code = validGtin(text(product.code) ?? '');
  if (code !== gtin) return { provider: 'open_food_facts', status: 'not_found', recordId: null, updatedAt: null, fields: {} };
  const nutrients = record(product.nutriments);
  const servingSize = text(product.serving_size);
  const serving = metricFromText(servingSize);
  const packageMetric = metricFromText(product.quantity);
  const updatedAt = text(product.last_modified_datetime);
  const observations = offNutrientObservations(nutrients, text(product.code), updatedAt, serving, packageMetric);
  const nutrientLedger = resolverLedger(observations, serving);
  const selectedServing = selectedResolverNutrition(nutrientLedger, 'per_serving');
  const selectedPer100g = selectedResolverNutrition(nutrientLedger, 'per_100g');
  const selectedPer100ml = selectedResolverNutrition(nutrientLedger, 'per_100ml');
  return {
    provider: 'open_food_facts',
    status: 'found',
    recordId: text(product.code),
    updatedAt,
    fields: {
      canonical_gtin: gtin,
      name: text(product.product_name) ?? text(product.generic_name),
      brand: text(product.brands)?.split(',')[0]?.trim() ?? null,
      variant: text(product.abbreviated_product_name),
      quantity: text(product.quantity),
      ingredients_text: text(product.ingredients_text_en) ?? text(product.ingredients_text),
      serving_size: servingSize,
      serving_quantity: serving?.quantity ?? null,
      serving_unit: serving?.unit ?? null,
      reported_serving_quantity: signed(product.serving_quantity),
      servings_per_container: signed(product.servings),
      package_quantity: packageMetric?.quantity ?? null,
      package_unit: packageMetric?.unit ?? null,
      ...selectedServing,
      nutrient_observations: nutrientLedger.observations,
      nutrient_evidence: nutrientLedger,
      nutriments_per_100g: selectedPer100g,
      nutriments_per_100ml: selectedPer100ml,
      categories: tagList(product.categories_tags),
      labels: tagList(product.labels_tags),
      packaging: tagList(product.packaging_tags)
    }
  };
}

function usdaNutrientRecord(food: Record<string, unknown>, names: string[]): Record<string, unknown> | null {
  return list(food.foodNutrients).map(record).find((item) => {
    const name = (text(item.nutrientName) ?? text(record(item.nutrient).name) ?? '').toLowerCase();
    return names.some((candidate) => name === candidate || name.includes(candidate));
  }) ?? null;
}

function explicitUsdaBasis(food: Record<string, unknown>, nutrient: Record<string, unknown>): ResolverNutrientBasis {
  const value = (text(nutrient.basis) ?? text(food.nutrientBasis) ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (value === 'perserving') return 'per_serving';
  if (value === 'per100g') return 'per_100g';
  if (value === 'per100ml') return 'per_100ml';
  if (value === 'perpackage') return 'per_package';
  // FoodData Central standardizes Global Branded Foods nutrients to a 100-unit basis. The
  // declared serving unit identifies whether that unit is grams or milliliters; any other
  // declaration remains unknown rather than assuming a density or basis.
  if ((text(food.dataType) ?? '').toLowerCase() === 'branded') {
    const servingUnit = (text(food.servingSizeUnit) ?? '').toLowerCase();
    if (servingUnit === 'g' || servingUnit === 'grm') return 'per_100g';
    if (servingUnit === 'ml' || servingUnit === 'mlt') return 'per_100ml';
  }
  return 'unknown';
}

function usdaNutrientObservations(
  food: Record<string, unknown>,
  providerRecordId: string | null,
  updatedAt: string | null,
  serving: { quantity: number; unit: 'g' | 'ml' } | null,
  packageMetric: { quantity: number; unit: 'g' | 'ml' } | null
): ResolverNutrientObservation[] {
  const specs: Array<{ nutrient: ResolverNutrient; names: string[]; unit: 'kcal' | 'g' | 'mg' }> = [
    { nutrient: 'calories', names: ['energy'], unit: 'kcal' },
    { nutrient: 'protein_g', names: ['protein'], unit: 'g' },
    { nutrient: 'carbs_g', names: ['carbohydrate'], unit: 'g' },
    { nutrient: 'fat_g', names: ['total lipid', 'total fat'], unit: 'g' },
    { nutrient: 'saturated_fat_g', names: ['fatty acids, total saturated', 'saturated fat'], unit: 'g' },
    { nutrient: 'fiber_g', names: ['fiber'], unit: 'g' },
    { nutrient: 'sugar_g', names: ['sugars, total', 'total sugars'], unit: 'g' },
    { nutrient: 'added_sugar_g', names: ['sugars, added', 'added sugars'], unit: 'g' },
    { nutrient: 'sodium_mg', names: ['sodium'], unit: 'mg' },
    { nutrient: 'caffeine_mg', names: ['caffeine'], unit: 'mg' }
  ];
  const observations: ResolverNutrientObservation[] = [];
  for (const spec of specs) {
    const nutrient = usdaNutrientRecord(food, spec.names);
    if (!nutrient) continue;
    const rawValue = signed(nutrient.value ?? nutrient.amount);
    if (rawValue === null) continue;
    const reportedUnit = (text(nutrient.unitName) ?? text(record(nutrient.nutrient).unitName) ?? spec.unit).toLowerCase();
    const multiplier = spec.unit === 'mg' && reportedUnit === 'g' ? 1_000
      : spec.unit === 'g' && reportedUnit === 'mg' ? 0.001
        : 1;
    const basis = explicitUsdaBasis(food, nutrient);
    const observation = resolverObservation({
      nutrient: spec.nutrient, value: rawValue * multiplier, unit: spec.unit, basis,
      servingQuantity: basis === 'per_serving' ? serving?.quantity ?? null : null,
      servingUnit: basis === 'per_serving' ? serving?.unit ?? null : null,
      packageQuantity: packageMetric?.quantity ?? null, packageUnit: packageMetric?.unit ?? null,
      provider: 'usda_food_data_central', providerRecordId, directlyReported: true, derivedFrom: [],
      conversionFormula: multiplier === 1 ? null : `${text(nutrient.nutrientName) ?? spec.nutrient} × ${multiplier}`,
      conversionConfidence: basis === 'unknown' ? 'low' : 'medium', confidence: basis === 'unknown' ? 'low' : 'medium',
      sourceTimestamp: updatedAt, rawField: text(nutrient.nutrientName) ?? spec.nutrient, selectionReason: null
    });
    observations.push(observation);
    if (serving && (basis === 'per_100g' || basis === 'per_100ml')) {
      const derived = resolverDerivedObservation(observation, serving);
      if (derived) observations.push(derived);
    }
  }
  return observations;
}

function normalizeUsda(payload: unknown, gtin: string): ResolverProviderRecord {
  const body = record(payload);
  const food = list(body.foods).map(record).find((candidate) => validGtin(text(candidate.gtinUpc) ?? '') === gtin);
  if (!food) return { provider: 'usda_food_data_central', status: 'not_found', recordId: null, updatedAt: null, fields: {} };
  const serving = metric(food.servingSize, food.servingSizeUnit);
  const packageMetric = metricFromText(food.packageWeight ?? food.packageSize);
  const recordId = text(food.fdcId) ?? (typeof food.fdcId === 'number' ? String(food.fdcId) : null);
  const updatedAt = text(food.publicationDate) ?? text(food.modifiedDate);
  const observations = usdaNutrientObservations(food, recordId, updatedAt, serving, packageMetric);
  const nutrientLedger = resolverLedger(observations, serving);
  const selectedServing = selectedResolverNutrition(nutrientLedger, 'per_serving');
  const selectedPer100g = selectedResolverNutrition(nutrientLedger, 'per_100g');
  const selectedPer100ml = selectedResolverNutrition(nutrientLedger, 'per_100ml');
  return {
    provider: 'usda_food_data_central',
    status: 'found',
    recordId,
    updatedAt,
    fields: {
      canonical_gtin: gtin,
      name: text(food.description),
      brand: text(food.brandOwner) ?? text(food.brandName),
      ingredients_text: text(food.ingredients),
      serving_size: text(food.householdServingFullText) ?? (serving ? `${serving.quantity} ${serving.unit}` : null),
      serving_quantity: serving?.quantity ?? null,
      serving_unit: serving?.unit ?? null,
      reported_serving_quantity: serving?.quantity ?? null,
      servings_per_container: signed(food.numberOfServings),
      package_quantity: packageMetric?.quantity ?? null,
      package_unit: packageMetric?.unit ?? null,
      ...selectedServing,
      nutrient_observations: nutrientLedger.observations,
      nutrient_evidence: nutrientLedger,
      nutriments_per_100g: selectedPer100g,
      nutriments_per_100ml: selectedPer100ml,
      categories: [text(food.brandedFoodCategory)].filter((value): value is string => Boolean(value)),
      labels: [],
      packaging: []
    }
  };
}

const NUTRIENT_FIELDS = [
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'saturated_fat_g', 'fiber_g', 'sugar_g', 'added_sugar_g', 'sodium_mg', 'caffeine_mg'
] as const;

const RESOLVER_NUTRIENT_UNITS: Record<ResolverNutrient, ResolverNutrientObservation['unit']> = {
  calories: 'kcal', protein_g: 'g', carbs_g: 'g', fat_g: 'g', saturated_fat_g: 'g', fiber_g: 'g',
  sugar_g: 'g', added_sugar_g: 'g', sodium_mg: 'mg', caffeine_mg: 'mg'
};

function signed(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedMetricUnit(value: unknown): 'g' | 'ml' | null {
  const unit = text(value)?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  if (['g', 'gr', 'grm', 'gram', 'grams'].includes(unit)) return 'g';
  if (['ml', 'mlt', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(unit)) return 'ml';
  return null;
}

function metric(value: unknown, unit: unknown): { quantity: number; unit: 'g' | 'ml' } | null {
  const quantity = signed(value);
  const normalizedUnit = normalizedMetricUnit(unit);
  return quantity !== null && quantity > 0 && normalizedUnit
    ? { quantity, unit: normalizedUnit }
    : null;
}

function metricFromText(value: unknown): { quantity: number; unit: 'g' | 'ml' } | null {
  const source = text(value);
  const matches = [...(source?.matchAll(/([\d.]+)\s*(fl\s*oz|oz|lb|kg|l|ml|g)\b/ig) ?? [])];
  const match = matches.at(-1);
  const quantity = signed(match?.[1]);
  const unit = text(match?.[2])?.toLowerCase().replace(/\s+/g, '');
  if (quantity === null || quantity <= 0 || !unit) return null;
  if (unit === 'g' || unit === 'ml') return { quantity, unit };
  if (unit === 'kg') return { quantity: quantity * 1_000, unit: 'g' };
  if (unit === 'lb') return { quantity: quantity * 453.59237, unit: 'g' };
  if (unit === 'oz') return { quantity: quantity * 28.349523125, unit: 'g' };
  if (unit === 'l') return { quantity: quantity * 1_000, unit: 'ml' };
  if (unit === 'floz') return { quantity: quantity * 29.5735295625, unit: 'ml' };
  return null;
}

function resolverObservation(input: Omit<ResolverNutrientObservation,
  'id' | 'conflictStatus' | 'plausibilityFlags' | 'plausibilityNotes' | 'selectedFor' | 'rejectionReasons'
>): ResolverNutrientObservation {
  const id = [input.provider, input.providerRecordId ?? 'none', input.nutrient, input.basis, input.rawField, input.value]
    .join(':').toLowerCase().replace(/[^a-z0-9:._-]+/g, '_');
  return {
    ...input,
    id,
    value: Math.round(input.value * 10) / 10,
    conflictStatus: 'none',
    plausibilityFlags: [],
    plausibilityNotes: [],
    selectedFor: [],
    rejectionReasons: []
  };
}

function resolverDerivedObservation(
  source: ResolverNutrientObservation,
  serving: { quantity: number; unit: 'g' | 'ml' }
): ResolverNutrientObservation | null {
  const compatible = source.basis === 'per_100g' && serving.unit === 'g' || source.basis === 'per_100ml' && serving.unit === 'ml';
  if (!compatible) return null;
  return resolverObservation({
    ...source,
    value: source.value * serving.quantity / 100,
    basis: 'per_serving',
    servingQuantity: serving.quantity,
    servingUnit: serving.unit,
    directlyReported: false,
    derivedFrom: [source.id],
    conversionFormula: `${source.id} × ${serving.quantity} ${serving.unit} ÷ 100 ${serving.unit}`,
    rawField: source.rawField,
    selectionReason: null
  });
}

function observationFlag(observation: ResolverNutrientObservation, flag: string): void {
  if (!observation.plausibilityFlags.includes(flag)) observation.plausibilityFlags.push(flag);
  observation.conflictStatus = 'suspicious';
  observation.confidence = 'low';
}

function observationNote(observation: ResolverNutrientObservation, note: string): void {
  if (!observation.plausibilityNotes.includes(note)) observation.plausibilityNotes.push(note);
}

type ResolverMacroEnergyAssessment = {
  discrepancy: number;
  tolerance: number;
  accepted: boolean;
  reason: string;
};

function resolverLowerConfidence(values: Array<'high' | 'medium' | 'low'>): 'high' | 'medium' | 'low' {
  const rank = { low: 0, medium: 1, high: 2 } as const;
  return values.reduce((lowest, value) => rank[value] < rank[lowest] ? value : lowest, 'high' as 'high' | 'medium' | 'low');
}

function resolverMacroEnergyAssessment(input: {
  calories: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number | null;
  confidence: 'high' | 'medium' | 'low';
  directlyReported: boolean;
}): ResolverMacroEnergyAssessment {
  const fiber = input.fiberG ?? 0;
  const digestibleCarbohydrate = Math.max(0, input.carbohydrateG - fiber);
  const estimated = input.proteinG * 4 + digestibleCarbohydrate * 4 + fiber * 2 + input.fatG * 9;
  const discrepancy = Math.abs(input.calories - estimated);
  const proportionalRate = !input.directlyReported || input.confidence === 'low'
    ? 0.3
    : input.confidence === 'high'
      ? 0.15
      : 0.2;
  const roundingTolerance = input.directlyReported && input.confidence === 'high' ? 9 : input.directlyReported ? 10 : 15;
  const tolerance = Math.round(Math.max(roundingTolerance, estimated * proportionalRate) * 10) / 10;
  const roundedEstimate = Math.round(estimated * 10) / 10;
  const roundedDiscrepancy = Math.round(discrepancy * 10) / 10;
  const accepted = discrepancy <= tolerance;
  return {
    discrepancy: roundedDiscrepancy,
    tolerance,
    accepted,
    reason: `macro_energy_${accepted ? 'accepted' : 'rejected'}: reported ${input.calories} kcal, estimated ${roundedEstimate} kcal, discrepancy ${roundedDiscrepancy} kcal, tolerance ${tolerance} kcal (${Math.round(proportionalRate * 100)}% proportional plus bounded rounding allowance); 4×protein + 4×(carbohydrate−fiber) + 2×fiber + 9×fat.`
  };
}

function resolverPlausibility(observations: ResolverNutrientObservation[], selectedServing?: { quantity: number; unit: 'g' | 'ml' } | null): void {
  for (const observation of observations) {
    if (!Number.isFinite(observation.value)) observationFlag(observation, 'non_finite_value');
    if (observation.value < 0) observationFlag(observation, 'impossible_negative_value');
    if (observation.unit !== RESOLVER_NUTRIENT_UNITS[observation.nutrient]) observationFlag(observation, 'incompatible_nutrient_unit');
    if (observation.basis === 'unknown') observationFlag(observation, 'unknown_nutrient_basis');
    if (observation.basis === 'per_serving' && !metric(observation.servingQuantity, observation.servingUnit)) {
      observationFlag(observation, 'missing_metric_serving_denominator');
    }
    if (observation.basis === 'per_package' && !metric(observation.packageQuantity, observation.packageUnit)) {
      observationFlag(observation, 'missing_metric_package_denominator');
    }
    if (selectedServing && observation.basis === 'per_serving' && (
      observation.servingUnit !== selectedServing.unit || !observation.servingQuantity ||
      Math.abs(observation.servingQuantity - selectedServing.quantity) > Math.max(1, selectedServing.quantity * 0.05)
    )) observationFlag(observation, 'selected_serving_context_mismatch');
    if (observation.servingQuantity && observation.packageQuantity && observation.servingUnit === observation.packageUnit &&
      observation.servingQuantity > observation.packageQuantity * 1.05) observationFlag(observation, 'serving_exceeds_package_quantity');
    const denominator = observation.basis === 'per_serving' ? observation.servingQuantity
      : observation.basis === 'per_100g' || observation.basis === 'per_100ml' ? 100 : null;
    if (denominator) {
      if (observation.unit === 'g' && observation.value > denominator * 1.05 + 1) observationFlag(observation, 'implausible_nutrient_density');
      if (observation.nutrient === 'calories' && observation.value > denominator * 10 + 50) observationFlag(observation, 'implausible_calorie_density');
      if (observation.nutrient === 'sodium_mg' && observation.value > denominator * 500 + 50) observationFlag(observation, 'implausible_sodium_density');
    }
    if (observation.nutrient === 'calories' && observation.value > 5_000) observationFlag(observation, 'implausible_unit_magnitude');
    if (observation.unit === 'g' && observation.value > 1_000) observationFlag(observation, 'implausible_unit_magnitude');
    if ((observation.nutrient === 'sodium_mg' || observation.nutrient === 'caffeine_mg') && observation.value > 100_000) {
      observationFlag(observation, 'implausible_unit_magnitude');
    }
  }
  const groups = new Map<string, ResolverNutrientObservation[]>();
  for (const observation of observations) {
    const key = [observation.provider, observation.providerRecordId, observation.basis, observation.servingQuantity, observation.servingUnit].join('|');
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  for (const group of groups.values()) {
    const nutrientItems = (nutrient: ResolverNutrient) => group.filter((item) => item.nutrient === nutrient);
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
      for (const sugar of sugars.filter((item) => item.value > maximumCarbs + 1)) observationFlag(sugar, 'sugar_exceeds_total_carbohydrate');
      for (const fiber of fibers.filter((item) => item.value > maximumCarbs + 1)) observationFlag(fiber, 'fiber_exceeds_total_carbohydrate');
    }
    if (maximumFat !== null) {
      for (const saturated of saturatedFats.filter((item) => item.value > maximumFat + 0.5)) {
        observationFlag(saturated, 'saturated_fat_exceeds_total_fat');
      }
    }
    if (calories.length > 0 && proteins.length > 0 && carbs.length > 0 && fats.length > 0) {
      const safeFibers = fibers.filter((fiber) => fiber.plausibilityFlags.length === 0);
      const fiberOptions: Array<ResolverNutrientObservation | null> = safeFibers.length > 0 ? safeFibers : [null];
      const assessments = calories.flatMap((calorie) => proteins.flatMap((protein) => carbs.flatMap((carbohydrate) => (
        fats.flatMap((fat) => fiberOptions.flatMap((fiber) => {
          if (fiber && fiber.value > carbohydrate.value + 1) return [];
          const assessment = resolverMacroEnergyAssessment({
            calories: calorie.value,
            proteinG: protein.value,
            carbohydrateG: carbohydrate.value,
            fatG: fat.value,
            fiberG: fiber?.value ?? null,
            confidence: resolverLowerConfidence([calorie.confidence, protein.confidence, carbohydrate.confidence, fat.confidence]),
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
          observationNote(observation, accepted.assessment.reason);
          continue;
        }
        const closest = [...relevant].sort((left, right) => (
          left.assessment.discrepancy - right.assessment.discrepancy ||
          left.assessment.tolerance - right.assessment.tolerance
        ))[0];
        if (closest) observationNote(observation, closest.assessment.reason);
        observationFlag(observation, 'macronutrient_energy_mismatch');
      }
    } else if (calories.length > 0) {
      const note = 'macro_energy_not_compared: compatible protein, carbohydrate, and fat observations were not all available; reported calories were retained without inventing missing macros.';
      for (const observation of group) observationNote(observation, note);
    }
  }

  const suspiciousIds = new Set(observations.filter((observation) => observation.plausibilityFlags.length > 0).map((observation) => observation.id));
  for (const observation of observations) {
    if (observation.derivedFrom.some((sourceId) => suspiciousIds.has(sourceId))) {
      observationFlag(observation, 'derived_from_suspicious_observation');
      observationNote(observation, 'Dependent conversion was excluded because its source observation failed plausibility.');
    }
  }
}

function resolverMaterialDifference(nutrient: ResolverNutrient, left: number, right: number): boolean {
  const tolerance = nutrient === 'calories' ? 15 : nutrient === 'sodium_mg' || nutrient === 'caffeine_mg' ? 30 : 1;
  if (Math.abs(left - right) <= tolerance) return false;
  const low = Math.min(Math.abs(left), Math.abs(right));
  const high = Math.max(Math.abs(left), Math.abs(right));
  return low === 0 ? high > tolerance : high / low > 1.25;
}

function resolverLedger(input: ResolverNutrientObservation[], selectedServing?: { quantity: number; unit: 'g' | 'ml' } | null): ResolverNutrientLedger {
  const observations: ResolverNutrientObservation[] = input.map((observation) => ({
    ...observation,
    derivedFrom: [...observation.derivedFrom],
    plausibilityFlags: [...(observation.plausibilityFlags ?? [])],
    plausibilityNotes: [...(observation.plausibilityNotes ?? [])],
    selectedFor: [],
    rejectionReasons: [...(observation.rejectionReasons ?? [])],
    conflictStatus: observation.conflictStatus ?? 'none',
    selectionReason: null
  }));
  resolverPlausibility(observations, selectedServing);
  const conflicts: string[] = [];
  const selections = NUTRIENT_FIELDS.flatMap((nutrient) => (['per_serving', 'per_100g', 'per_100ml'] as const).map((targetBasis) => {
    const candidates = observations.filter((observation) => observation.nutrient === nutrient && observation.basis === targetBasis);
    const safe = candidates.filter((observation) => observation.plausibilityFlags.length === 0);
    for (let leftIndex = 0; leftIndex < safe.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < safe.length; rightIndex += 1) {
        const left = safe[leftIndex]!;
        const right = safe[rightIndex]!;
        const compatibleServing = targetBasis !== 'per_serving' || left.servingUnit === right.servingUnit &&
          Boolean(left.servingQuantity && right.servingQuantity) &&
          Math.abs(left.servingQuantity! - right.servingQuantity!) <= Math.max(1, left.servingQuantity! * 0.05);
        if (compatibleServing && resolverMaterialDifference(nutrient, left.value, right.value)) {
          left.conflictStatus = 'material_conflict';
          right.conflictStatus = 'material_conflict';
          conflicts.push(`${nutrient} materially differs across compatible ${targetBasis} observations.`);
        }
      }
    }
    const confidenceRank = { low: 0, medium: 1, high: 2 } as const;
    const ranked = safe.filter((candidate) => candidate.conflictStatus !== 'material_conflict').sort((left, right) => (
      Number(right.directlyReported) - Number(left.directlyReported) ||
      freshness(right.sourceTimestamp) - freshness(left.sourceTimestamp) ||
      confidenceRank[right.confidence] - confidenceRank[left.confidence] ||
      left.id.localeCompare(right.id)
    ));
    const winner = ranked[0] ?? null;
    if (winner) {
      winner.selectedFor.push(targetBasis);
      const selection = winner.directlyReported
        ? 'Selected plausible direct observation with known basis, compatible serving context, and highest freshness/confidence.'
        : 'Selected plausible derived observation with a documented compatible conversion.';
      winner.selectionReason = [selection, ...winner.plausibilityNotes].join(' ');
    }
    for (const candidate of candidates.filter((candidate) => candidate !== winner)) {
      candidate.rejectionReasons.push(candidate.plausibilityFlags.length
        ? `Rejected from ${targetBasis}: ${candidate.plausibilityFlags.join(', ')}.`
        : 'Rejected because a higher-ranked compatible observation was selected.');
    }
    const conflictStatus = candidates.some((candidate) => candidate.conflictStatus === 'suspicious') ? 'suspicious' as const
      : candidates.some((candidate) => candidate.conflictStatus === 'material_conflict') ? 'material_conflict' as const
        : candidates.length > 1 ? 'compatible_duplicate' as const : 'none' as const;
    return {
      nutrient,
      targetBasis,
      selectedObservationId: winner?.id ?? null,
      rejectedObservationIds: candidates.filter((candidate) => candidate !== winner).map((candidate) => candidate.id),
      selectionReason: winner?.selectionReason ?? 'No plausible observation with the requested known basis was available.',
      conflictStatus
    };
  }));
  for (const observation of observations.filter((item) => item.basis === 'unknown' || item.basis === 'per_package')) {
    if (observation.rejectionReasons.length === 0) {
      observation.rejectionReasons.push(observation.basis === 'per_package'
        ? 'Package-basis evidence is retained but is not treated as a serving value.'
        : 'Unknown-basis evidence is retained but excluded from scoring.');
    }
  }
  return {
    version: 'nutrient_evidence_v1', observations, selections,
    conflicts: [...new Set([...conflicts, ...observations.flatMap((observation) => observation.plausibilityFlags.map((flag) => `${observation.nutrient}: ${flag}`))])]
  };
}

function selectedResolverNutrition(ledger: ResolverNutrientLedger, basis: 'per_serving' | 'per_100g' | 'per_100ml'): Record<ResolverNutrient, number | null> {
  const byId = new Map(ledger.observations.map((observation) => [observation.id, observation]));
  return Object.fromEntries(NUTRIENT_FIELDS.map((nutrient) => {
    const selection = ledger.selections.find((item) => item.nutrient === nutrient && item.targetBasis === basis);
    const observation = selection?.selectedObservationId ? byId.get(selection.selectedObservationId) : null;
    return [nutrient, observation?.value ?? null];
  })) as Record<ResolverNutrient, number | null>;
}

function observationsFromRecord(recordValue: ResolverProviderRecord): ResolverNutrientObservation[] {
  const existing = list(recordValue.fields.nutrient_observations).filter((item): item is ResolverNutrientObservation => (
    Boolean(item && typeof item === 'object' && !Array.isArray(item))
  ));
  if (existing.length > 0) return existing;
  const serving = metric(recordValue.fields.serving_quantity, recordValue.fields.serving_unit);
  return NUTRIENT_FIELDS.flatMap((nutrient) => {
    const value = signed(recordValue.fields[nutrient]);
    if (value === null) return [];
    return [resolverObservation({
      nutrient, value, unit: RESOLVER_NUTRIENT_UNITS[nutrient], basis: serving ? 'per_serving' : 'unknown',
      servingQuantity: serving?.quantity ?? null, servingUnit: serving?.unit ?? null,
      packageQuantity: null, packageUnit: null, provider: recordValue.provider, providerRecordId: recordValue.recordId,
      directlyReported: true, derivedFrom: [], conversionFormula: null, conversionConfidence: 'medium', confidence: 'medium',
      sourceTimestamp: recordValue.updatedAt, rawField: nutrient, selectionReason: null
    })];
  });
}

function reliabilityRequiresFallback(value: unknown): boolean {
  return value === 'MISSING' || value === 'CONFLICTED' || value === 'UNRELIABLE';
}

const OBSERVATION_ISSUE_CODES: Record<string, string> = {
  non_finite_value: 'INVALID_NUMERIC_VALUE',
  impossible_negative_value: 'IMPOSSIBLE_NEGATIVE_VALUE',
  incompatible_nutrient_unit: 'NUTRIENT_UNIT_CONFLICT',
  unknown_nutrient_basis: 'UNKNOWN_NUTRIENT_BASIS',
  missing_metric_serving_denominator: 'INVALID_SERVING_SIZE',
  missing_metric_package_denominator: 'INVALID_PACKAGE_SIZE',
  selected_serving_context_mismatch: 'SERVING_100G_CONFLICT',
  serving_exceeds_package_quantity: 'SERVING_EXCEEDS_PACKAGE',
  implausible_nutrient_density: 'NUTRIENT_EXCEEDS_FOOD_MASS',
  implausible_calorie_density: 'IMPLAUSIBLE_CALORIE_DENSITY',
  implausible_sodium_density: 'IMPLAUSIBLE_SODIUM_DENSITY',
  implausible_unit_magnitude: 'NUTRIENT_UNIT_CONFLICT',
  sugar_exceeds_total_carbohydrate: 'SUGAR_EXCEEDS_TOTAL_CARBOHYDRATE',
  fiber_exceeds_total_carbohydrate: 'FIBER_EXCEEDS_TOTAL_CARBOHYDRATE',
  saturated_fat_exceeds_total_fat: 'SATURATED_FAT_EXCEEDS_TOTAL_FAT',
  macronutrient_energy_mismatch: 'ENERGY_MACRO_CONFLICT',
  derived_from_suspicious_observation: 'DERIVED_FROM_UNRELIABLE_VALUE',
  provider_validation_rejected: 'PROVIDER_FIELD_VALIDATION_REJECTED',
  serving_validation_rejected: 'INVALID_SERVING_SIZE'
};

function issuesFromLedger(ledger: ResolverNutrientLedger, source: string): ValidationIssue[] {
  return ledger.observations.flatMap((observation) => observation.plausibilityFlags.map((flag) => ({
    code: OBSERVATION_ISSUE_CODES[flag] ?? flag.toUpperCase(),
    severity: flag === 'implausible_nutrient_density' ? 'CRITICAL' as const : 'ERROR' as const,
    field: observation.nutrient,
    source,
    observed: observation.value,
    expected: 'a plausible value on a compatible declared basis',
    message: `The ${observation.nutrient} observation was rejected: ${flag.replaceAll('_', ' ')}.`
  })));
}

function uniqueIssues(values: ValidationIssue[]): ValidationIssue[] {
  return values.filter((value, index) => values.findIndex((candidate) => (
    candidate.code === value.code && candidate.field === value.field && candidate.source === value.source &&
    JSON.stringify(candidate.observed) === JSON.stringify(value.observed)
  )) === index);
}

function validateProviderRecord(recordValue: ResolverProviderRecord): ResolverProviderRecord {
  if (recordValue.status !== 'found') return recordValue;
  const fields = recordValue.fields;
  const originalServing = metric(fields.serving_quantity, fields.serving_unit);
  const validation = validateNutritionData({
    source: recordValue.provider,
    values: Object.fromEntries(NUTRIENT_FIELDS.map((field) => [field, fields[field]])),
    basis: 'PER_SERVING',
    servingQuantity: fields.serving_quantity,
    servingUnit: text(fields.serving_unit),
    servingDescription: text(fields.serving_size),
    reportedServingQuantity: fields.reported_serving_quantity,
    packageQuantity: fields.package_quantity,
    packageUnit: text(fields.package_unit),
    servingsPerContainer: fields.servings_per_container,
    per100g: record(fields.nutriments_per_100g),
    per100ml: record(fields.nutriments_per_100ml),
    ingredientsText: text(fields.ingredients_text),
    categoryAvailable: tagList(fields.categories).length > 0,
    categories: tagList(fields.categories)
  });
  const observations = observationsFromRecord(recordValue).map((observation) => ({
    ...observation,
    derivedFrom: [...observation.derivedFrom],
    plausibilityFlags: [...observation.plausibilityFlags],
    plausibilityNotes: [...observation.plausibilityNotes],
    selectedFor: [],
    rejectionReasons: [...observation.rejectionReasons]
  }));
  for (const observation of observations.filter((item) => item.basis === 'per_serving')) {
    const field = validation.nutrients[observation.nutrient];
    if (validation.serving.reliability === 'CONFLICTED' || validation.serving.reliability === 'UNRELIABLE') {
      observationFlag(observation, 'serving_validation_rejected');
    }
    if (field.reliability === 'CONFLICTED' || field.reliability === 'UNRELIABLE') {
      observationFlag(observation, 'provider_validation_rejected');
      for (const validationIssue of field.validationIssues) observationNote(observation, validationIssue.code);
    } else if (field.reliability === 'ESTIMATED' && field.value !== null && resolverMaterialDifference(
      observation.nutrient, observation.value, field.value
    )) {
      observationFlag(observation, 'provider_validation_rejected');
      observationNote(observation, 'A redundant representation supplied the selected unit-corrected value.');
    }
  }
  const validServing = validation.serving.reliability === 'KNOWN' ? originalServing : null;
  const ledger = resolverLedger(observations, validServing);
  const nutrition = selectedResolverNutrition(ledger, 'per_serving');
  const ledgerIssues = issuesFromLedger(ledger, recordValue.provider);
  const validationIssues = uniqueIssues([...validation.validationIssues, ...ledgerIssues]);
  const fieldReliability = Object.fromEntries(NUTRIENT_FIELDS.map((field) => {
    const selected = nutrition[field];
    const candidates = ledger.observations.filter((item) => item.nutrient === field && item.basis === 'per_serving');
    const selectedObservation = candidates.find((item) => item.selectedFor.includes('per_serving'));
    const reliability: DataReliability = selected === null
      ? candidates.length === 0 ? 'MISSING'
        : candidates.some((item) => item.conflictStatus === 'material_conflict') ? 'CONFLICTED'
          : 'UNRELIABLE'
      : selectedObservation?.directlyReported ? 'KNOWN' : 'ESTIMATED';
    return [field, reliability];
  }));
  const fallbackReasons = [...new Set([
    ...validation.fallbackReasons,
    ...NUTRIENT_FIELDS.filter((field) => reliabilityRequiresFallback(fieldReliability[field]) &&
      ['protein_g', 'saturated_fat_g', 'fiber_g', 'sugar_g', 'added_sugar_g', 'sodium_mg'].includes(field))
      .map((field) => `${field}:${String(fieldReliability[field]).toLowerCase()}`)
  ])];
  const normalizedValidation: NutritionValidationResult = {
    ...validation,
    nutrients: Object.fromEntries(VALIDATED_NUTRIENT_FIELDS.map((field) => [field, {
      ...validation.nutrients[field],
      value: nutrition[field],
      reliability: fieldReliability[field] as DataReliability,
      derived: fieldReliability[field] === 'ESTIMATED',
      validationIssues: validationIssues.filter((item) => item.field === field)
    }])) as NutritionValidationResult['nutrients'],
    serving: {
      ...validation.serving,
      value: validServing?.quantity ?? null,
      unit: validServing?.unit ?? null
    },
    validationIssues,
    requiresFallback: fallbackReasons.length > 0,
    fallbackReasons
  };
  return {
    ...recordValue,
    fields: {
      ...fields,
      ...nutrition,
      serving_quantity: validServing?.quantity ?? null,
      serving_unit: validServing?.unit ?? null,
      nutrient_observations: ledger.observations,
      nutrient_evidence: ledger,
      nutrition_validation: normalizedValidation,
      nutrition_validation_version: PRODUCT_NUTRITION_VALIDATION_VERSION,
      validation_issues: validationIssues,
      field_reliability: fieldReliability,
      validation_requires_fallback: fallbackReasons.length > 0,
      validation_fallback_reasons: fallbackReasons
    }
  };
}

function freshness(value: string | null): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Healthi must exhaust safe exact-product resolution and evidence-degradation routes before
 * returning no Product Quality result. Provider, category, corroboration, and optional evidence
 * failures cannot independently suppress a bounded interpretation when direct evidence supports it.
 * Exact identity or meaningful direct evidence is never fabricated to avoid abstention.
 */
export function evaluateProductEvidenceSufficiency(product: Record<string, unknown>): ProductEvidenceSufficiency {
  const exactIdentity = Boolean(text(product.canonical_barcode) && text(product.name));
  const ingredients = text(product.ingredients_text);
  const ingredientTokens = ingredients ? parseIngredients(ingredients, 'complete').flatTokens : [];
  const nutrientLedger = record(product.nutrient_evidence);
  const ledgerSelections = list(nutrientLedger.selections).map(record);
  const selectedNutrients = new Set(ledgerSelections.flatMap((selection) => (
    typeof selection.nutrient === 'string' && selection.selectedObservationId ? [selection.nutrient] : []
  )));
  if (selectedNutrients.size === 0) {
    for (const nutrient of NUTRIENT_FIELDS) if (signed(product[nutrient]) !== null) selectedNutrients.add(nutrient);
  }
  const selectedServing = metric(product.serving_quantity, product.serving_unit)
    ?? metric(product.serving_quantity_g, 'g');
  const categoryAvailable = list(product.categories_tags).some((value) => (
    typeof value === 'string' && value.trim() && !/^(undefined|null|unknown|n\/?a|none)$/i.test(value.trim())
  ));
  const conflicts = list(product.provider_conflicts).filter((value): value is string => typeof value === 'string');
  const materialConflict = conflicts.length > 0;
  const hasIngredients = Boolean(ingredients && ingredientTokens.length > 0);
  const contextualSupportCount = Number(selectedNutrients.size > 0) + Number(Boolean(selectedServing)) + Number(categoryAvailable);

  let level: ProductEvidenceLevel = 'abstain';
  if (exactIdentity && hasIngredients && selectedNutrients.size >= 5 && selectedServing && categoryAvailable && !materialConflict) {
    level = 'full';
  } else if (exactIdentity && hasIngredients && (ingredientTokens.length >= 2 || categoryAvailable) && selectedNutrients.size >= 3 && selectedServing && !materialConflict) {
    level = 'good';
  } else if (exactIdentity && hasIngredients && (
    ingredientTokens.length >= 2 ? contextualSupportCount > 0 : categoryAvailable
  )) {
    level = 'partial';
  } else if (exactIdentity && ingredientTokens.length >= 2) {
    level = 'minimum_defensible';
  }

  const supportedDomains = [
    ...(exactIdentity ? ['identity'] : []),
    ...(hasIngredients ? ['ingredients'] : []),
    ...(selectedNutrients.size > 0 ? ['nutrition'] : []),
    ...(selectedServing ? ['serving'] : []),
    ...(categoryAvailable ? ['category_context'] : [])
  ];
  const unsupportedDomains = ['identity', 'ingredients', 'nutrition', 'serving', 'category_context']
    .filter((domain) => !supportedDomains.includes(domain));
  const reasons = [
    ...(!exactIdentity ? ['exact_identity_not_established'] : []),
    ...(!hasIngredients ? ['usable_direct_ingredients_absent'] : []),
    ...(selectedNutrients.size === 0 ? ['selected_normalized_nutrition_absent'] : []),
    ...(!selectedServing ? ['metric_serving_absent'] : []),
    ...(!categoryAvailable ? ['category_context_absent_non_blocking'] : []),
    ...(materialConflict ? ['material_provider_conflict_retained'] : []),
    ...(level === 'minimum_defensible' ? ['bounded_from_direct_ingredients_only'] : []),
    ...(level === 'abstain' && exactIdentity ? ['direct_evidence_cannot_support_bounded_interpretation'] : [])
  ];

  return {
    level,
    supports_bounded_interpretation: level !== 'abstain',
    exact_identity_established: exactIdentity,
    ingredient_token_count: ingredientTokens.length,
    selected_nutrient_count: selectedNutrients.size,
    metric_serving_available: Boolean(selectedServing),
    category_context_available: categoryAvailable,
    material_conflict: materialConflict,
    supported_evidence_domains: supportedDomains,
    unsupported_evidence_domains: unsupportedDomains,
    reasons
  };
}

function providerTrace(provider: ResolverProvider, recordValue?: ResolverProviderRecord): ProductResolutionProviderTrace {
  return {
    provider,
    attempted: Boolean(recordValue),
    result: recordValue?.status ?? 'skipped',
    selected_fields: [],
    rejected_fields: [],
    attempt_count: recordValue?.attempts ?? 0,
    http_statuses: [...(recordValue?.httpStatuses ?? [])],
    failure_reason: recordValue?.failureReason ?? null
  };
}

function initialResolutionTrace(gtin: string, cacheAttempted: boolean): ProductResolutionTrace {
  return {
    version: 'product_resolution_trace_v3',
    normalized_gtin: gtin,
    cache: { attempted: cacheAttempted, result: 'miss', sufficiency: null },
    source_a: providerTrace('open_food_facts'),
    source_b: { ...providerTrace('usda_food_data_central'), invocation_reason: 'not_configured' },
    merge: {
      attempted: false,
      exact_identity_compatible: true,
      identity_confidence: null,
      identity_resolution: null,
      selected_fields: { open_food_facts: [], usda_food_data_central: [] },
      rejected_fields: { open_food_facts: [], usda_food_data_central: [] },
      conflicts: []
    },
    sufficiency_before_source_b: null,
    sufficiency_after_source_b: null,
    final_scoring_scope: 'none',
    final_result_state: 'identity_unresolved',
    abstention_reason: null
  };
}

function fieldDecisions(
  product: Record<string, unknown>,
  records: ResolverProviderRecord[]
): Pick<ProductResolutionTrace['merge'], 'selected_fields' | 'rejected_fields'> {
  const selected: Record<ResolverProvider, Set<string>> = {
    open_food_facts: new Set<string>(), usda_food_data_central: new Set<string>()
  };
  const identityResolution = record(product.product_identity_resolution);
  const rejectedSecondaryIdentity = identityResolution.accepted === false;
  const rejected: Record<ResolverProvider, Set<string>> = {
    open_food_facts: new Set<string>(), usda_food_data_central: new Set<string>()
  };
  const provenance = record(product.field_provenance);
  for (const [field, values] of Object.entries(provenance)) {
    for (const value of list(values).map(record)) {
      const provider = value.provider;
      if (provider !== 'open_food_facts' && provider !== 'usda_food_data_central') continue;
      if (value.selected === true) selected[provider].add(field);
      else rejected[provider].add(field);
    }
  }
  for (const providerRecord of records.filter((item) => item.status === 'found')) {
    if (rejectedSecondaryIdentity && providerRecord.provider === 'usda_food_data_central') {
      for (const [field, value] of Object.entries(providerRecord.fields)) {
        if (value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0)) {
          rejected[providerRecord.provider].add(field);
        }
      }
      continue;
    }
    for (const field of ['categories', 'labels', 'packaging']) {
      if (list(providerRecord.fields[field]).length > 0) selected[providerRecord.provider].add(field);
    }
  }
  return {
    selected_fields: {
      open_food_facts: [...selected.open_food_facts].sort(),
      usda_food_data_central: [...selected.usda_food_data_central].sort()
    },
    rejected_fields: {
      open_food_facts: [...rejected.open_food_facts].sort(),
      usda_food_data_central: [...rejected.usda_food_data_central].sort()
    }
  };
}

function attachResolutionTrace(resolution: ProductDataResolution, trace: ProductResolutionTrace): ProductDataResolution {
  if (resolution.status !== 'resolved') return { ...resolution, trace };
  const providerResolution = record(resolution.product.provider_resolution);
  return {
    ...resolution,
    trace,
    product: {
      ...resolution.product,
      provider_resolution: { ...providerResolution, resolution_trace: trace }
    }
  };
}

function validationRequiresFallback(resolution: ProductDataResolution): boolean {
  if (resolution.status !== 'resolved') return true;
  return record(resolution.product.nutrition_validation).requiresFallback === true;
}

export function mergeProviderRecords(
  gtin: string,
  records: ResolverProviderRecord[]
): ProductDataResolution {
  const compatibleRecords = records.map((item) => {
    if (item.status !== 'found') return item;
    const declaredGtin = text(item.fields.canonical_gtin);
    return declaredGtin && validGtin(declaredGtin) !== gtin
      ? { ...item, status: 'not_found' as const, fields: {} }
      : validateProviderRecord(item);
  });
  const sources = compatibleRecords.map((item) => ({ provider: item.provider, status: item.status, record_id: item.recordId, source_timestamp: item.updatedAt }));
  const compatibleFound = compatibleRecords.filter((item) => item.status === 'found');
  if (compatibleFound.length === 0) {
    const unavailable = compatibleRecords.some((item) => item.status === 'unavailable');
    return {
      status: unavailable ? 'provider_unavailable' : 'identity_unresolved',
      canonicalGtin: gtin,
      message: unavailable ? 'Product providers are temporarily unavailable.' : 'No exact product identity was found for this barcode.',
      sources
    };
  }

  const primary = compatibleFound.find((item) => item.provider === 'open_food_facts') ?? compatibleFound[0]!;
  const secondaryCandidate = compatibleFound.find((item) => item.provider === 'usda_food_data_central');
  const identityResolution = secondaryCandidate && secondaryCandidate !== primary
    ? resolveProductIdentity({
        barcodeMatch: true,
        primaryBrand: text(primary.fields.brand),
        secondaryBrand: text(secondaryCandidate.fields.brand),
        primaryName: text(primary.fields.name),
        secondaryName: text(secondaryCandidate.fields.name),
        primaryPackageQuantity: signed(primary.fields.package_quantity),
        primaryPackageUnit: text(primary.fields.package_unit),
        secondaryPackageQuantity: signed(secondaryCandidate.fields.package_quantity),
        secondaryPackageUnit: text(secondaryCandidate.fields.package_unit),
        primaryIngredients: text(primary.fields.ingredients_text),
        secondaryIngredients: text(secondaryCandidate.fields.ingredients_text)
      })
    : null;
  const secondary = secondaryCandidate && (!identityResolution || identityResolution.accepted)
    ? secondaryCandidate
    : undefined;
  const found = compatibleFound.filter((item) => item !== secondaryCandidate || item === secondary);
  const conflicts: string[] = identityResolution && !identityResolution.accepted
    ? ['Secondary provider record was rejected because product identity confidence was insufficient.']
    : [];
  const provenance: Record<string, unknown[]> = {};
  const selected = (field: string, preferred = primary) => {
    const candidates = found.filter((item) => item.fields[field] !== null && item.fields[field] !== undefined && item.fields[field] !== '');
    if (candidates.length === 0) return null;
    let winner = candidates.find((item) => item.provider === preferred.provider) ?? candidates[0]!;
    if (field === 'ingredients_text') {
      winner = [...candidates].sort((left, right) => String(right.fields[field]).length - String(left.fields[field]).length)[0]!;
    }
    provenance[field] = candidates.map((item) => ({
      provider: item.provider,
      provider_record_id: item.recordId,
      source_timestamp: item.updatedAt,
      confidence: 'medium',
      raw_field: field,
      selected: item === winner,
      selection_reason: item === winner ? 'deterministic_provider_precedence_and_completeness' : 'credible_alternate'
    }));
    const distinct = new Set(candidates.map((item) => JSON.stringify(item.fields[field])));
    if (distinct.size > 1 && ['brand', 'ingredients_text'].includes(field)) conflicts.push(`${field} differs across exact-GTIN provider records.`);
    return winner.fields[field];
  };
  const ingredients = selected('ingredients_text');
  const servingCandidates = found.flatMap((item) => {
    const serving = metric(item.fields.serving_quantity, item.fields.serving_unit);
    return serving ? [{ record: item, ...serving }] : [];
  }).sort((left, right) => freshness(right.record.updatedAt) - freshness(left.record.updatedAt) ||
    left.record.provider.localeCompare(right.record.provider));
  let selectedServing: (typeof servingCandidates)[number] | null = servingCandidates[0] ?? null;
  const servingConflict = servingCandidates.some((candidate) => selectedServing && (
    candidate.unit !== selectedServing.unit ||
    Math.abs(candidate.quantity - selectedServing.quantity) > Math.max(1, selectedServing.quantity * 0.05)
  ));
  if (servingConflict) {
    conflicts.push('Serving quantity materially differs across exact-GTIN provider records; no serving was selected.');
    selectedServing = null;
  }
  const mergedObservations = found.flatMap(observationsFromRecord);
  if (servingConflict) {
    for (const observation of mergedObservations.filter((item) => item.basis === 'per_serving')) {
      observationFlag(observation, 'serving_validation_rejected');
    }
  }
  const nutrientLedger = resolverLedger(mergedObservations, selectedServing);
  const nutrition = selectedResolverNutrition(nutrientLedger, 'per_serving');
  const per100g = selectedResolverNutrition(nutrientLedger, 'per_100g');
  const per100ml = selectedResolverNutrition(nutrientLedger, 'per_100ml');
  conflicts.push(...nutrientLedger.conflicts);
  for (const field of NUTRIENT_FIELDS) {
    const observations = nutrientLedger.observations.filter((observation) => observation.nutrient === field);
    provenance[field] = observations.map((observation) => ({
      provider: observation.provider,
      provider_record_id: observation.providerRecordId,
      source_timestamp: observation.sourceTimestamp,
      confidence: observation.confidence,
      raw_field: observation.rawField,
      selected: observation.selectedFor.length > 0,
      selection_reason: observation.selectedFor.length > 0
        ? observation.selectionReason
        : observation.rejectionReasons.join(' ') || 'Retained as an unselected nutrient observation.'
    }));
  }
  const categories = [...new Set(found.flatMap((item) => list(item.fields.categories).filter((value): value is string => typeof value === 'string')))];
  const name = selected('name');
  if (!name) {
    return { status: 'identity_unresolved', canonicalGtin: gtin, message: 'The exact barcode record has no usable product name.', sources };
  }
  const missing = [
    ...(!ingredients ? ['ingredients'] : []),
    ...NUTRIENT_FIELDS.filter((field) => !nutrientLedger.selections.some((selection) => (
      selection.nutrient === field && selection.selectedObservationId !== null
    ))),
    ...(categories.length === 0 ? ['category'] : [])
  ];
  const ingredientTokens = typeof ingredients === 'string'
    ? parseIngredients(ingredients, 'complete').flatTokens
    : [];
  const additiveSignals = typeof ingredients === 'string'
    ? [
        /\b(natural flavors?|artificial flavors?)\b/i.test(ingredients) ? 'flavor_system' : null,
        /\b(xanthan gum|guar gum|carrageenan|cellulose gum|lecithin)\b/i.test(ingredients) ? 'texture_system' : null,
        /\b(red 40|yellow 5|yellow 6|blue 1|artificial colors?)\b/i.test(ingredients) ? 'color_system' : null,
        /\b(sucralose|aspartame|acesulfame potassium|saccharin)\b/i.test(ingredients) ? 'synthetic_sweetener_system' : null
      ].filter((value): value is string => Boolean(value))
    : [];
  const selectedNutrientObservations = nutrientLedger.observations.filter((observation) => observation.selectedFor.length > 0);
  const selectedNutrientConflict = selectedNutrientObservations.some((observation) => (
    observation.conflictStatus === 'material_conflict' || observation.conflictStatus === 'suspicious'
  ));
  const nutritionConfidence = nutrientLedger.conflicts.length > 0 || selectedNutrientConflict
    ? 'low'
    : selectedNutrientObservations.length === 0
    ? 'low'
      : selectedNutrientObservations.length >= 5
        ? 'high'
        : 'medium';
  const nutrientFieldReliability = Object.fromEntries(NUTRIENT_FIELDS.map((field) => {
    const candidates = nutrientLedger.observations.filter((observation) => (
      observation.nutrient === field && observation.basis === 'per_serving'
    ));
    const selectedObservation = candidates.find((observation) => observation.selectedFor.includes('per_serving'));
    const reliability: DataReliability = selectedObservation
      ? selectedObservation.directlyReported ? 'KNOWN' : 'ESTIMATED'
      : candidates.length === 0
        ? 'MISSING'
        : candidates.some((observation) => observation.conflictStatus === 'material_conflict')
          ? 'CONFLICTED'
          : 'UNRELIABLE';
    return [field, reliability];
  })) as Record<ResolverNutrient, DataReliability>;
  const crossProviderIssues = NUTRIENT_FIELDS.flatMap((field) => (
    nutrientFieldReliability[field] === 'CONFLICTED'
      ? [{
          code: 'PROVIDER_NUTRIENT_CONFLICT', severity: 'ERROR' as const, field, source: 'provider_merge',
          observed: nutrientLedger.observations.filter((observation) => (
            observation.nutrient === field && observation.basis === 'per_serving'
          )).map((observation) => ({ source: observation.provider, value: observation.value })),
          expected: 'compatible observations for the same product, nutrient, serving, and basis',
          message: `Provider observations for ${field} materially disagree; no value was selected.`
        }]
      : []
  ));
  const providerValidationIssues = found.flatMap((providerRecord) => (
    list(providerRecord.fields.validation_issues).filter((value): value is ValidationIssue => (
      Boolean(value && typeof value === 'object' && !Array.isArray(value))
    ))
  ));
  const mergedValidationBase = validateNutritionData({
    source: 'provider_merge',
    values: nutrition,
    basis: 'PER_SERVING',
    servingQuantity: selectedServing?.quantity ?? null,
    servingUnit: selectedServing?.unit ?? null,
    servingDescription: text(selectedServing?.record.fields.serving_size),
    packageQuantity: selectedServing?.record.fields.package_quantity,
    packageUnit: text(selectedServing?.record.fields.package_unit),
    servingsPerContainer: selectedServing?.record.fields.servings_per_container,
    per100g,
    per100ml,
    ingredientsText: typeof ingredients === 'string' ? ingredients : null,
    categoryAvailable: categories.length > 0,
    categories
  });
  const validationIssues = uniqueIssues([
    ...providerValidationIssues,
    ...mergedValidationBase.validationIssues,
    ...crossProviderIssues
  ]);
  const validationFallbackReasons = [...new Set([
    ...mergedValidationBase.fallbackReasons,
    ...NUTRIENT_FIELDS.filter((field) => reliabilityRequiresFallback(nutrientFieldReliability[field]) &&
      ['protein_g', 'saturated_fat_g', 'fiber_g', 'sugar_g', 'added_sugar_g', 'sodium_mg'].includes(field))
      .map((field) => `${field}:${nutrientFieldReliability[field].toLowerCase()}`),
    ...(identityResolution && !identityResolution.accepted ? ['secondary_identity:insufficient_confidence'] : [])
  ])];
  const nutritionValidation: NutritionValidationResult = {
    ...mergedValidationBase,
    nutrients: Object.fromEntries(VALIDATED_NUTRIENT_FIELDS.map((field) => [field, {
      ...mergedValidationBase.nutrients[field],
      value: nutrition[field],
      reliability: nutrientFieldReliability[field],
      derived: nutrientFieldReliability[field] === 'ESTIMATED',
      validationIssues: validationIssues.filter((value) => value.field === field)
    }])) as NutritionValidationResult['nutrients'],
    categoryResolution: {
      category: categories[0] ?? null,
      confidence: categories.length === 0 ? 0 : found.length > 1 ? 0.85 : 0.7,
      source: found.filter((providerRecord) => tagList(providerRecord.fields.categories).length > 0)
        .map((providerRecord) => providerRecord.provider)
    },
    validationIssues,
    requiresFallback: validationFallbackReasons.length > 0,
    fallbackReasons: validationFallbackReasons
  };
  const providerResolutionTrace: ProviderResolutionTrace[] = [
    ...NUTRIENT_FIELDS.map((field): ProviderResolutionTrace => {
      const candidates = nutrientLedger.observations.filter((observation) => (
        observation.nutrient === field && observation.basis === 'per_serving'
      ));
      const selectedObservation = candidates.find((observation) => observation.selectedFor.includes('per_serving'));
      return {
        field,
        candidates: candidates.map((observation) => ({
          source: observation.provider,
          value: observation.value,
          reliability: observation.plausibilityFlags.length > 0
            ? 'UNRELIABLE'
            : observation.conflictStatus === 'material_conflict'
              ? 'CONFLICTED'
              : observation.directlyReported ? 'KNOWN' : 'ESTIMATED'
        })),
        selectedSource: selectedObservation?.provider ?? null,
        selectedValue: selectedObservation?.value ?? null,
        reason: nutrientLedger.selections.find((selection) => (
          selection.nutrient === field && selection.targetBasis === 'per_serving'
        ))?.selectionReason ?? 'No reliable per-serving observation was available.'
      };
    }),
    {
      field: 'serving',
      candidates: found.map((providerRecord) => ({
        source: providerRecord.provider,
        value: metric(providerRecord.fields.serving_quantity, providerRecord.fields.serving_unit),
        reliability: metric(providerRecord.fields.serving_quantity, providerRecord.fields.serving_unit) ? 'KNOWN' : 'MISSING'
      })),
      selectedSource: selectedServing?.record.provider ?? null,
      selectedValue: selectedServing ? { quantity: selectedServing.quantity, unit: selectedServing.unit } : null,
      reason: selectedServing ? 'Selected the freshest validated metric serving.' : 'No reliable metric serving was available.'
    },
    {
      field: 'ingredients_text',
      candidates: found.map((providerRecord) => ({
        source: providerRecord.provider,
        value: text(providerRecord.fields.ingredients_text),
        reliability: text(providerRecord.fields.ingredients_text) ? 'KNOWN' : 'MISSING'
      })),
      selectedSource: provenance.ingredients_text?.find((value) => record(value).selected === true)
        ? text(record(provenance.ingredients_text.find((value) => record(value).selected === true)).provider)
        : null,
      selectedValue: ingredients,
      reason: ingredients ? 'Selected the most complete accepted ingredient declaration.' : 'No ingredient declaration was available.'
    },
    {
      field: 'category',
      candidates: found.map((providerRecord) => ({
        source: providerRecord.provider,
        value: tagList(providerRecord.fields.categories),
        reliability: tagList(providerRecord.fields.categories).length > 0 ? 'KNOWN' : 'MISSING'
      })),
      selectedSource: categories.length > 0 ? 'provider_merge' : null,
      selectedValue: categories,
      reason: categories.length > 0 ? 'Combined accepted provider category evidence.' : 'No category evidence was available.'
    }
  ];
  return {
    status: 'resolved',
    canonicalGtin: gtin,
    sources,
    product: {
      barcode: gtin,
      canonical_barcode: gtin,
      provider: primary.provider,
      provider_product_id: primary.recordId ?? secondary?.recordId ?? gtin,
      name,
      brand: selected('brand'),
      variant: selected('variant'),
      quantity: selected('quantity'),
      serving_size: selectedServing?.record.fields.serving_size ?? selected('serving_size', secondary ?? primary),
      serving_quantity_g: selectedServing?.unit === 'g' ? selectedServing.quantity : null,
      serving_quantity: selectedServing?.quantity ?? null,
      serving_unit: selectedServing?.unit ?? null,
      serving_equivalent: selectedServing?.record.fields.serving_size ?? selected('serving_size', secondary ?? primary),
      ingredients_text: ingredients,
      ingredient_evidence: {
        resolved_text: ingredients,
        raw_text: ingredients,
        source_field: ingredients ? 'provider_merge' : null,
        language: null,
        structured_ingredients: [],
        status: ingredients ? 'complete' : 'absent',
        confidence: ingredients ? 'medium' : 'low',
        reconstructed: false,
        conflicts: conflicts.filter((item) => item.startsWith('ingredients_text'))
      },
      ingredient_tokens: ingredientTokens,
      additive_signals: additiveSignals,
      ...nutrition,
      calories_per_serving: nutrition.calories,
      nutriments_per_100g: per100g,
      nutriments_per_100ml: per100ml,
      nutrient_evidence: nutrientLedger,
      categories_tags: categories,
      labels: [...new Set(found.flatMap((item) => list(item.fields.labels).filter((value): value is string => typeof value === 'string')))],
      packaging_tags: [...new Set(found.flatMap((item) => list(item.fields.packaging).filter((value): value is string => typeof value === 'string')))],
      field_provenance: provenance,
      provider_conflicts: [...new Set(conflicts)],
      provider_missing_fields: missing,
      nutrition_validation: nutritionValidation,
      validation_issues: validationIssues,
      provider_resolution_trace: providerResolutionTrace,
      product_identity_resolution: identityResolution,
      provider_resolution: {
        version: RESOLVER_VERSION,
        requested_barcode: gtin,
        canonical_gtin: gtin,
        terminal_state: 'resolved',
        sources
      },
      evidence_confidence: {
        identity: 'high',
        ingredients: ingredients ? 'medium' : 'low',
        nutrition: nutritionConfidence,
        serving: selectedServing ? 'high' : 'low',
        category: categories.length > 0 ? 'medium' : 'low',
        product_form: 'low',
        provider: found.length === 2 ? 'high' : 'medium',
        overall: conflicts.length > 0 ? 'medium' : found.length === 2 ? 'high' : 'medium'
      },
      provider_updated_at: found.map((item) => item.updatedAt).filter(Boolean).sort().at(-1) ?? null,
      provider_completeness: Math.round((1 - missing.length / 12) * 100) / 100,
      provider_quality_tags: [],
      quality_flags: [],
      confidence: conflicts.length > 0 ? 'medium' : found.length === 2 ? 'high' : 'medium',
      reason_codes: ['product_label_data']
    }
  };
}

export async function resolveProductData(params: {
  barcode: string;
  usdaApiKey?: string | null;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  cache?: CanonicalProductCacheStore | null;
  cacheTtlMs?: number;
  now?: () => Date;
  waiter?: (milliseconds: number) => Promise<void>;
}): Promise<ProductDataResolution> {
  const gtin = validGtin(params.barcode);
  if (!gtin) return { status: 'identity_unresolved', canonicalGtin: null, message: 'A valid GTIN barcode is required.', sources: [] };
  const now = params.now ?? (() => new Date());
  const cacheTtlMs = params.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const trace = initialResolutionTrace(gtin, Boolean(params.cache));
  const cached = params.cache ? await params.cache.get(gtin).catch(() => null) : null;
  const validCached = cached?.canonicalGtin === gtin &&
    cached.resolverVersion === RESOLVER_VERSION &&
    cached.resolution.status === 'resolved'
    ? cached
    : null;
  const cachedSufficiency = validCached ? evaluateProductEvidenceSufficiency(validCached.resolution.product) : null;
  trace.cache = {
    attempted: Boolean(params.cache),
    result: !cached
      ? 'miss'
      : !validCached
        ? 'invalid'
        : `${Date.parse(validCached.freshUntil) > now().getTime() ? 'fresh' : 'stale'}_${cachedSufficiency?.supports_bounded_interpretation ? 'sufficient' : 'insufficient'}` as ProductResolutionTrace['cache']['result'],
    sufficiency: cachedSufficiency
  };
  const cacheResolution = (
    cachedRecord: CanonicalProductCacheRecord,
    status: ProductCacheDisclosure['status'],
    activeTrace: ProductResolutionTrace
  ): ProductDataResolution => {
    const resolution = JSON.parse(JSON.stringify(cachedRecord.resolution)) as Extract<ProductDataResolution, { status: 'resolved' }>;
    const providerResolution = cachedRecord.resolution.product.provider_resolution;
    resolution.product.provider_resolution = {
      ...(providerResolution && typeof providerResolution === 'object' ? providerResolution as Record<string, unknown> : {}),
      cache_freshness: status,
      cache_fetched_at: cachedRecord.fetchedAt,
      resolver_version: cachedRecord.resolverVersion
    };
    resolution.cache = { status, fetched_at: cachedRecord.fetchedAt, resolver_version: cachedRecord.resolverVersion };
    const sufficiency = evaluateProductEvidenceSufficiency(resolution.product);
    activeTrace.sufficiency_after_source_b = sufficiency;
    activeTrace.final_scoring_scope = sufficiency.level === 'full' || sufficiency.level === 'good' ? 'overall' : 'supported_evidence';
    activeTrace.final_result_state = 'resolved';
    activeTrace.abstention_reason = null;
    return attachResolutionTrace(resolution, activeTrace);
  };
  if (validCached && cachedSufficiency?.supports_bounded_interpretation && Date.parse(validCached.freshUntil) > now().getTime()) {
    return cacheResolution(validCached, 'fresh', trace);
  }
  const fetcher = params.fetcher ?? fetch;
  const timeoutMs = params.timeoutMs ?? 6_000;
  const waiter = params.waiter ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const get = async (provider: ResolverProvider, url: string, normalizer: (value: unknown, gtin: string) => ResolverProviderRecord) => {
    const httpStatuses: number[] = [];
    const diagnosed = (value: ResolverProviderRecord, attempts: number, failureReason: string | null = null): ResolverProviderRecord => ({
      ...value,
      attempts,
      httpStatuses: [...httpStatuses],
      failureReason
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      try {
        const request = () => {
          const controller = new AbortController();
          timeout = setTimeout(() => controller.abort(), timeoutMs);
          return fetcher(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json', 'User-Agent': 'Healthi/1.0' }
          });
        };
        const response = params.fetcher
          ? await request()
          : await scheduledProviderRequest(provider, waiter, request);
        httpStatuses.push(response.status);
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!response.ok) {
          if (retryable && attempt === 0) {
            const retryAfterMs = providerRetryAfterMilliseconds(response.headers.get('retry-after'));
            if (retryAfterMs > 0) {
              if (params.fetcher) await waiter(retryAfterMs);
              else resolverProviderRequestState.nextAllowedAt.set(
                provider,
                Math.max(resolverProviderRequestState.nextAllowedAt.get(provider) ?? 0, Date.now() + retryAfterMs)
              );
            }
            continue;
          }
          if (response.status === 404) {
            return diagnosed({ provider, status: 'not_found', recordId: null, updatedAt: null, fields: {} }, attempt + 1, 'http_404');
          }
          return diagnosed({ provider, status: 'unavailable', recordId: null, updatedAt: null, fields: {} }, attempt + 1, `http_${response.status}`);
        }
        const declaredSize = Number(response.headers.get('content-length') ?? 0);
        if (declaredSize > 2_000_000) {
          return diagnosed({ provider, status: 'unavailable', recordId: null, updatedAt: null, fields: {} }, attempt + 1, 'response_too_large');
        }
        const responseText = await response.text();
        if (responseText.length > 2_000_000) {
          return diagnosed({ provider, status: 'unavailable', recordId: null, updatedAt: null, fields: {} }, attempt + 1, 'response_too_large');
        }
        const normalized = normalizer(JSON.parse(responseText), gtin);
        return diagnosed(normalized, attempt + 1, normalized.status === 'not_found' ? 'exact_record_not_found' : null);
      } catch {
        if (attempt === 0) continue;
        return diagnosed({ provider, status: 'unavailable', recordId: null, updatedAt: null, fields: {} }, attempt + 1, 'network_timeout_or_malformed_response');
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
    return diagnosed({ provider, status: 'unavailable', recordId: null, updatedAt: null, fields: {} }, 2, 'provider_attempts_exhausted');
  };
  const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(gtin)}.json?fields=code,product_name,generic_name,brands,abbreviated_product_name,quantity,serving_size,serving_quantity,servings,ingredients_text,ingredients_text_en,nutriments,categories_tags,labels_tags,packaging_tags,last_modified_datetime`;
  const offRecord = await get('open_food_facts', offUrl, normalizeOff);
  trace.source_a = providerTrace('open_food_facts', offRecord);
  const sourceAResolution = mergeProviderRecords(gtin, [offRecord]);
  const sourceASufficiency = sourceAResolution.status === 'resolved'
    ? evaluateProductEvidenceSufficiency(sourceAResolution.product)
    : null;
  trace.sufficiency_before_source_b = sourceASufficiency;

  let usdaRecord: ResolverProviderRecord | null = null;
  const sourceAValidationFailed = validationRequiresFallback(sourceAResolution);
  const sourceBRequired = offRecord.status !== 'found' || sourceAValidationFailed || !sourceASufficiency?.supports_bounded_interpretation;
  const invocationReason: ProductResolutionTrace['source_b']['invocation_reason'] = offRecord.status === 'unavailable'
    ? 'source_a_unavailable'
    : offRecord.status === 'not_found'
      ? 'source_a_not_found'
      : sourceAValidationFailed
        ? 'source_a_validation_failed'
      : sourceBRequired
        ? 'source_a_materially_insufficient'
        : 'not_required_source_a_sufficient';
  if (sourceBRequired && params.usdaApiKey) {
    const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(params.usdaApiKey)}&query=${encodeURIComponent(gtin)}&pageSize=10&dataType=Branded`;
    usdaRecord = await get('usda_food_data_central', usdaUrl, normalizeUsda);
    trace.source_b = { ...providerTrace('usda_food_data_central', usdaRecord), invocation_reason: invocationReason };
  } else {
    trace.source_b = {
      ...providerTrace('usda_food_data_central'),
      invocation_reason: sourceBRequired ? 'not_configured' : 'not_required_source_a_sufficient'
    };
  }
  const providerRecords = usdaRecord ? [offRecord, usdaRecord] : [offRecord];
  let providerResolution = mergeProviderRecords(gtin, providerRecords);
  if (
    sourceBRequired &&
    !params.usdaApiKey &&
    offRecord.status === 'not_found' &&
    providerResolution.status === 'identity_unresolved'
  ) {
    providerResolution = {
      status: 'provider_unavailable',
      canonicalGtin: gtin,
      message: 'Exact product identity resolution is temporarily incomplete because the required secondary provider is not configured.',
      sources: providerResolution.sources
    };
  }
  trace.merge.attempted = providerRecords.filter((item) => item.status === 'found').length > 1;
  trace.merge.exact_identity_compatible = !providerRecords.some((item) => (
    item.status === 'found' && text(item.fields.canonical_gtin) && validGtin(text(item.fields.canonical_gtin) ?? '') !== gtin
  ));
  if (providerResolution.status === 'resolved') {
    const sufficiency = evaluateProductEvidenceSufficiency(providerResolution.product);
    trace.sufficiency_after_source_b = sufficiency;
    const identityResolution = record(providerResolution.product.product_identity_resolution) as ProductIdentityResolution;
    trace.merge.identity_resolution = typeof identityResolution.confidence === 'number' ? identityResolution : null;
    trace.merge.identity_confidence = typeof identityResolution.confidence === 'number' ? identityResolution.confidence : null;
    trace.merge.conflicts = list(providerResolution.product.provider_conflicts).filter((value): value is string => typeof value === 'string');
    const decisions = fieldDecisions(providerResolution.product, providerRecords);
    trace.merge.selected_fields = decisions.selected_fields;
    trace.merge.rejected_fields = decisions.rejected_fields;
    trace.source_a.selected_fields = decisions.selected_fields.open_food_facts;
    trace.source_a.rejected_fields = decisions.rejected_fields.open_food_facts;
    trace.source_b.selected_fields = decisions.selected_fields.usda_food_data_central;
    trace.source_b.rejected_fields = decisions.rejected_fields.usda_food_data_central;
    trace.final_scoring_scope = sufficiency.supports_bounded_interpretation
      ? sufficiency.level === 'full' || sufficiency.level === 'good' ? 'overall' : 'supported_evidence'
      : 'none';
    trace.final_result_state = sufficiency.supports_bounded_interpretation ? 'resolved' : 'more_data_needed';
    trace.abstention_reason = sufficiency.supports_bounded_interpretation
      ? null
      : 'Exact identity was resolved, but collective direct evidence remained below the minimum defensible level after applicable routes were exhausted.';
    providerResolution = attachResolutionTrace(providerResolution, trace);
  } else {
    trace.sufficiency_after_source_b = null;
    trace.final_scoring_scope = 'none';
    trace.final_result_state = providerResolution.status;
    trace.abstention_reason = providerResolution.message;
    providerResolution = attachResolutionTrace(providerResolution, trace);
  }
  if (providerResolution.status !== 'resolved') {
    return validCached && cachedSufficiency?.supports_bounded_interpretation
      ? cacheResolution(validCached, 'stale', trace)
      : providerResolution;
  }
  if (!trace.sufficiency_after_source_b?.supports_bounded_interpretation && validCached && cachedSufficiency?.supports_bounded_interpretation) {
    return cacheResolution(validCached, 'stale', trace);
  }

  const fetchedAt = now().toISOString();
  const snapshotForCache: Extract<ProductDataResolution, { status: 'resolved' }> = {
    ...providerResolution,
    cache: { status: validCached ? 'refreshed' : 'miss', fetched_at: fetchedAt, resolver_version: RESOLVER_VERSION }
  };
  const serialized = JSON.stringify(snapshotForCache);
  const payloadBytes = new TextEncoder().encode(serialized).length;
  if (payloadBytes <= MAX_CACHE_PAYLOAD_BYTES && params.cache) {
    const sourceTimestamps = Object.fromEntries(snapshotForCache.sources.map((source) => [source.provider, source.source_timestamp ?? null]));
    const provenance = providerResolution.product.field_provenance ?? [];
    const conflicts = providerResolution.product.provider_conflicts ?? [];
    const record: CanonicalProductCacheRecord = {
      canonicalGtin: gtin,
      resolution: snapshotForCache,
      providerProvenance: provenance,
      providerConflicts: conflicts,
      sourceTimestamps,
      resolverVersion: RESOLVER_VERSION,
      fetchedAt,
      freshUntil: new Date(now().getTime() + cacheTtlMs).toISOString(),
      lastSuccessfulProviderAt: fetchedAt,
      payloadBytes
    };
    await params.cache.put(record).catch(() => undefined);
  }
  return snapshotForCache;
}

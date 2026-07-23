import type { DataConfidence, FoodQualityFlag, NutritionReasonCode } from '../../engines/nutrition';
import type { JsonValue } from './persistence';
import type { HealthiProductSnapshot, ProductProvider, ProductQualitySnapshot } from './productLookup/productLookupTypes';
import { canonicalBarcodeIdentity } from './productLookup/barcodeUtils';
import { mergeProductSnapshots } from './productLookup/mergeProductEvidence';

export type UserFoodProductSource = 'open_food_facts' | 'manual' | 'demo' | 'scanner';
export type ProductQualityLabel = ProductQualitySnapshot['label'];

export type UserFoodProductPersistenceInput = HealthiProductSnapshot & {
  quality: ProductQualitySnapshot;
  is_saved?: boolean;
  last_used_at?: string | null;
  last_scanned_at?: string | null;
  source?: UserFoodProductSource;
  source_confidence?: DataConfidence;
};

export type UserFoodProductInsert = {
  user_id: string;
  barcode: string | null;
  provider: ProductProvider;
  provider_product_id: string | null;
  name: string;
  brand: string | null;
  serving_size: string | null;
  serving_quantity_g: number | null;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
  ingredients_text: string | null;
  quality_label: ProductQualityLabel;
  quality_score: number | null;
  quality_confidence: DataConfidence;
  quality_flags: FoodQualityFlag[];
  quality_reason_codes: NutritionReasonCode[];
  quality_snapshot: JsonValue;
  lab_evidence_state?: JsonValue;
  is_saved: boolean;
  last_used_at: string | null;
  last_scanned_at: string | null;
  source: UserFoodProductSource;
  source_confidence: DataConfidence;
};

export type UserFoodProductUpdate = Partial<Omit<UserFoodProductInsert, 'user_id'>>;

export type UserFoodProductRow = UserFoodProductInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

type QueryError = { message?: string };
type QueryResponse<T> = { data: T | null; error: QueryError | null };
type InsertQuery<TRow> = { select(columns: string): { single(): Promise<QueryResponse<TRow>> } };
type SelectQuery<TRow> = {
  eq(column: string, value: string | boolean): SelectQuery<TRow>;
  order(column: string, options: { ascending: boolean }): SelectQuery<TRow>;
  limit(count: number): Promise<QueryResponse<TRow[]>>;
};
type UpdateQuery<TRow> = {
  eq(column: string, value: string): UpdateQuery<TRow>;
  select(columns: string): { single(): Promise<QueryResponse<TRow>> };
};
type TableQuery = {
  insert(payload: UserFoodProductInsert): InsertQuery<UserFoodProductRow>;
  select(columns: string): SelectQuery<UserFoodProductRow>;
  update(payload: UserFoodProductUpdate): UpdateQuery<UserFoodProductRow>;
};

export type ProductLibrarySupabaseClient = {
  from(table: 'user_food_products'): TableQuery;
};

function raiseSupabaseError(error: QueryError): never {
  throw new Error(error.message ?? 'Product library request failed.');
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function productSource(snapshot: HealthiProductSnapshot, source?: UserFoodProductSource): UserFoodProductSource {
  if (source) return source;
  if (snapshot.provider === 'open_food_facts') return 'open_food_facts';
  return snapshot.provider;
}

export function productSnapshotValue(product: Partial<HealthiProductSnapshot>, quality: ProductQualitySnapshot): JsonValue {
  return {
    score: quality.score,
    label: quality.label,
    summary: quality.summary,
    positives: [...quality.positives],
    considerations: [...quality.considerations],
    confidence: quality.confidence,
    reason_codes: [...quality.reason_codes],
    letter_grade: quality.letter_grade ?? null,
    grade_band: quality.grade_band ?? 'calibrating',
    grade_label: quality.grade_label ?? 'Calibrating',
    absolute_score: quality.absolute_score ?? null,
    category_score: quality.category_score ?? null,
    category_id: quality.category_id ?? null,
    category_label: quality.category_label ?? null,
    category_comparison_available: quality.category_comparison_available ?? false,
    product_form: quality.product_form ?? null,
    prepared_use: quality.prepared_use ?? null,
    nutrient_basis: quality.nutrient_basis ? { ...quality.nutrient_basis } : null,
    macro_context: quality.macro_context ? {
      summary: quality.macro_context.summary,
      highlights: [...quality.macro_context.highlights]
    } : null,
    top_drivers: (quality.top_drivers ?? []).map((factor) => ({
      id: factor.id,
      label: factor.label,
      points: factor.points,
      rawPoints: factor.rawPoints,
      severity: factor.severity,
      matched: [...factor.matched],
      explanation: factor.explanation,
      evidence_refs: [...(factor.evidence_refs ?? [])]
    })),
    source_confidence: quality.source_confidence ?? quality.confidence,
    interpretation_confidence: quality.interpretation_confidence ?? 'low',
    processing_tier: quality.processing_tier ?? null,
    processing_tier_label: quality.processing_tier_label ?? null,
    factors: (quality.factors ?? []).map((factor) => ({
      id: factor.id,
      label: factor.label,
      points: factor.points,
      rawPoints: factor.rawPoints,
      severity: factor.severity,
      matched: [...factor.matched],
      explanation: factor.explanation,
      evidence_refs: [...(factor.evidence_refs ?? [])]
    })),
    limiting_factor: quality.limiting_factor ?? null,
    scoring_reason_codes: [...(quality.scoring_reason_codes ?? [])],
    better_options: (quality.better_options ?? []).map((option) => ({
      title: option.title,
      summary: option.summary,
      criteria: [...option.criteria],
      reason_codes: [...option.reason_codes]
    })),
    evidence_refs: (quality.evidence_refs ?? []).map((reference) => ({
      id: reference.id,
      title: reference.title,
      source: reference.source,
      year: reference.year ?? null,
      url: reference.url ?? null,
      summary: reference.summary
    })),
    result_state: quality.result_state ?? 'more_data_needed',
    estimated_grade_range: quality.estimated_grade_range ? [...quality.estimated_grade_range] : null,
    missing_evidence: [...(quality.missing_evidence ?? [])],
    evidence_confidence: quality.evidence_confidence ? { ...quality.evidence_confidence } : null,
    product_evidence: {
      canonical_barcode: product.canonical_barcode ?? canonicalBarcodeIdentity(product.barcode ?? ''),
      variant: product.variant ?? null,
      quantity: product.quantity ?? null,
      ingredient_evidence: product.ingredient_evidence ? JSON.parse(JSON.stringify(product.ingredient_evidence)) as JsonValue : null,
      evidence_confidence: product.evidence_confidence ? { ...product.evidence_confidence } : null,
      provider_updated_at: product.provider_updated_at ?? null,
      provider_completeness: product.provider_completeness ?? null,
      provider_quality_tags: [...(product.provider_quality_tags ?? [])],
      field_provenance: product.field_provenance ? JSON.parse(JSON.stringify(product.field_provenance)) as JsonValue : null,
      provider_conflicts: [...(product.provider_conflicts ?? [])],
      labels: [...(product.labels ?? [])],
      categories_tags: [...(product.categories_tags ?? [])],
      packaging_tags: [...(product.packaging_tags ?? [])],
      nutriments_per_100g: product.nutriments_per_100g ? { ...product.nutriments_per_100g } : null
    }
  };
}

function evidenceRank(snapshot: HealthiProductSnapshot): number {
  const status = snapshot.ingredient_evidence?.status ?? (snapshot.ingredients_text ? 'partial' : 'absent');
  return status === 'complete' ? 3 : status === 'reconstructed' ? 2 : status === 'partial' ? 1 : 0;
}

function storedSnapshot(row: UserFoodProductRow): HealthiProductSnapshot {
  const envelope = row.quality_snapshot && typeof row.quality_snapshot === 'object' && !Array.isArray(row.quality_snapshot)
    ? row.quality_snapshot as Record<string, JsonValue>
    : {};
  const evidence = envelope.product_evidence && typeof envelope.product_evidence === 'object' && !Array.isArray(envelope.product_evidence)
    ? envelope.product_evidence as Record<string, JsonValue>
    : {};
  return {
    barcode: row.barcode ?? '', canonical_barcode: typeof evidence.canonical_barcode === 'string' ? evidence.canonical_barcode : canonicalBarcodeIdentity(row.barcode ?? ''),
    provider: row.provider, provider_product_id: row.provider_product_id, name: row.name, brand: row.brand,
    serving_size: row.serving_size, serving_quantity_g: row.serving_quantity_g, calories_per_serving: row.calories_per_serving,
    protein_g: row.protein_g, carbs_g: row.carbs_g, fat_g: row.fat_g, fiber_g: row.fiber_g, sugar_g: row.sugar_g,
    sodium_mg: row.sodium_mg, saturated_fat_g: row.saturated_fat_g, ingredients_text: row.ingredients_text,
    ingredient_evidence: evidence.ingredient_evidence && typeof evidence.ingredient_evidence === 'object'
      ? evidence.ingredient_evidence as unknown as HealthiProductSnapshot['ingredient_evidence'] : undefined,
    evidence_confidence: evidence.evidence_confidence && typeof evidence.evidence_confidence === 'object'
      ? evidence.evidence_confidence as unknown as HealthiProductSnapshot['evidence_confidence'] : undefined,
    lab_evidence_reference: row.lab_evidence_state && typeof row.lab_evidence_state === 'object'
      ? row.lab_evidence_state as unknown as HealthiProductSnapshot['lab_evidence_reference'] : undefined,
    provider_updated_at: typeof evidence.provider_updated_at === 'string' ? evidence.provider_updated_at : null,
    quality_flags: [...row.quality_flags], confidence: row.source_confidence, reason_codes: [...row.quality_reason_codes]
  };
}

export function shouldRefreshCachedProduct(row: UserFoodProductRow, now = Date.now(), completeTtlMs = 7 * 24 * 60 * 60 * 1000): boolean {
  const snapshot = storedSnapshot(row);
  if (evidenceRank(snapshot) < 3) return true;
  const providerTime = snapshot.provider_updated_at ? new Date(snapshot.provider_updated_at).getTime() : NaN;
  const storedTime = new Date(row.updated_at).getTime();
  const freshnessTime = Number.isFinite(providerTime) ? providerTime : storedTime;
  return !Number.isFinite(freshnessTime) || now - freshnessTime > completeTtlMs;
}

function protectStrongStoredEvidence(existing: UserFoodProductRow, incoming: UserFoodProductPersistenceInput): UserFoodProductPersistenceInput {
  const stored = storedSnapshot(existing);
  const merged = mergeProductSnapshots(stored, incoming);
  return { ...incoming, ...merged.snapshot };
}

export function toUserFoodProductInsert(
  product: UserFoodProductPersistenceInput,
  userId: string
): UserFoodProductInsert {
  return {
    user_id: userId,
    barcode: nullableText(product.canonical_barcode ?? canonicalBarcodeIdentity(product.barcode)),
    provider: product.provider,
    provider_product_id: nullableText(product.provider_product_id),
    name: product.name.trim() || 'Manual food',
    brand: nullableText(product.brand),
    serving_size: nullableText(product.serving_size),
    serving_quantity_g: product.serving_quantity_g ?? null,
    calories_per_serving: product.calories_per_serving ?? null,
    protein_g: product.protein_g ?? null,
    carbs_g: product.carbs_g ?? null,
    fat_g: product.fat_g ?? null,
    fiber_g: product.fiber_g ?? null,
    sugar_g: product.sugar_g ?? null,
    sodium_mg: product.sodium_mg ?? null,
    saturated_fat_g: product.saturated_fat_g ?? null,
    ingredients_text: nullableText(product.ingredients_text),
    quality_label: product.quality.label,
    quality_score: product.quality.score,
    quality_confidence: product.quality.confidence,
    quality_flags: [...product.quality_flags],
    quality_reason_codes: [...product.quality.reason_codes],
    quality_snapshot: productSnapshotValue(product, product.quality),
    lab_evidence_state: product.lab_evidence_reference
      ? JSON.parse(JSON.stringify(product.lab_evidence_reference)) as JsonValue
      : null,
    is_saved: product.is_saved ?? false,
    last_used_at: product.last_used_at ?? null,
    last_scanned_at: product.last_scanned_at ?? null,
    source: productSource(product, product.source),
    source_confidence: product.source_confidence ?? product.confidence
  };
}

export function toUserFoodProductUpdate(
  product: Partial<UserFoodProductPersistenceInput>
): UserFoodProductUpdate {
  const update: UserFoodProductUpdate = {};
  if (product.barcode !== undefined) update.barcode = nullableText(product.barcode);
  if (product.provider !== undefined) update.provider = product.provider;
  if (product.provider_product_id !== undefined) update.provider_product_id = nullableText(product.provider_product_id);
  if (product.name !== undefined) update.name = product.name.trim() || 'Manual food';
  if (product.brand !== undefined) update.brand = nullableText(product.brand);
  if (product.serving_size !== undefined) update.serving_size = nullableText(product.serving_size);
  if (product.serving_quantity_g !== undefined) update.serving_quantity_g = product.serving_quantity_g;
  if (product.calories_per_serving !== undefined) update.calories_per_serving = product.calories_per_serving;
  if (product.protein_g !== undefined) update.protein_g = product.protein_g;
  if (product.carbs_g !== undefined) update.carbs_g = product.carbs_g;
  if (product.fat_g !== undefined) update.fat_g = product.fat_g;
  if (product.fiber_g !== undefined) update.fiber_g = product.fiber_g;
  if (product.sugar_g !== undefined) update.sugar_g = product.sugar_g;
  if (product.sodium_mg !== undefined) update.sodium_mg = product.sodium_mg;
  if (product.saturated_fat_g !== undefined) update.saturated_fat_g = product.saturated_fat_g;
  if (product.ingredients_text !== undefined) update.ingredients_text = nullableText(product.ingredients_text);
  if (product.quality !== undefined) {
    update.quality_label = product.quality.label;
    update.quality_score = product.quality.score;
    update.quality_confidence = product.quality.confidence;
    update.quality_flags = [...(product.quality_flags ?? [])];
    update.quality_reason_codes = [...product.quality.reason_codes];
    update.quality_snapshot = productSnapshotValue(product, product.quality);
  }
  if (product.lab_evidence_reference !== undefined) {
    update.lab_evidence_state = product.lab_evidence_reference
      ? JSON.parse(JSON.stringify(product.lab_evidence_reference)) as JsonValue
      : null;
  }
  if (product.is_saved !== undefined) update.is_saved = product.is_saved;
  if (product.last_used_at !== undefined) update.last_used_at = product.last_used_at;
  if (product.last_scanned_at !== undefined) update.last_scanned_at = product.last_scanned_at;
  if (product.source !== undefined) update.source = product.source;
  if (product.source_confidence !== undefined) update.source_confidence = product.source_confidence;
  return update;
}

export async function saveUserFoodProduct(
  client: ProductLibrarySupabaseClient,
  userId: string,
  product: UserFoodProductPersistenceInput
): Promise<UserFoodProductRow> {
  const { data, error } = await client.from('user_food_products').insert(toUserFoodProductInsert(product, userId)).select('*').single();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error('Product save returned no data.');
  return data;
}

export async function updateUserFoodProduct(
  client: ProductLibrarySupabaseClient,
  userId: string,
  productId: string,
  product: Partial<UserFoodProductPersistenceInput>
): Promise<UserFoodProductRow> {
  const { data, error } = await client
    .from('user_food_products')
    .update(toUserFoodProductUpdate(product))
    .eq('id', productId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error('Product update returned no data.');
  return data;
}

export async function getUserFoodProductByBarcode(
  client: ProductLibrarySupabaseClient,
  userId: string,
  barcode: string
): Promise<UserFoodProductRow | null> {
  const { data, error } = await client
    .from('user_food_products')
    .select('*')
    .eq('user_id', userId)
    .eq('barcode', canonicalBarcodeIdentity(barcode))
    .limit(1);
  if (error) raiseSupabaseError(error);
  return data?.[0] ?? null;
}

export async function getRecentUserFoodProducts(
  client: ProductLibrarySupabaseClient,
  userId: string,
  limit = 12
): Promise<UserFoodProductRow[]> {
  const { data, error } = await client
    .from('user_food_products')
    .select('*')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function getSavedUserFoodProducts(
  client: ProductLibrarySupabaseClient,
  userId: string,
  limit = 30
): Promise<UserFoodProductRow[]> {
  const { data, error } = await client
    .from('user_food_products')
    .select('*')
    .eq('user_id', userId)
    .eq('is_saved', true)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function markUserFoodProductSaved(
  client: ProductLibrarySupabaseClient,
  userId: string,
  productId: string,
  isSaved: boolean
): Promise<UserFoodProductRow> {
  return updateUserFoodProduct(client, userId, productId, { is_saved: isSaved });
}

export async function updateUserFoodProductLastUsed(
  client: ProductLibrarySupabaseClient,
  userId: string,
  productId: string,
  usedAt = new Date().toISOString()
): Promise<UserFoodProductRow> {
  return updateUserFoodProduct(client, userId, productId, { last_used_at: usedAt });
}

export async function upsertUserFoodProductFromSnapshot(
  client: ProductLibrarySupabaseClient,
  userId: string,
  product: UserFoodProductPersistenceInput
): Promise<UserFoodProductRow> {
  const barcode = canonicalBarcodeIdentity(product.canonical_barcode ?? product.barcode);
  const existing = barcode ? await getUserFoodProductByBarcode(client, userId, barcode) : null;

  if (existing) {
    const protectedProduct = protectStrongStoredEvidence(existing, { ...product, barcode, canonical_barcode: barcode });
    return updateUserFoodProduct(client, userId, existing.id, {
      ...protectedProduct,
      is_saved: product.is_saved ?? existing.is_saved,
      last_used_at: product.last_used_at ?? existing.last_used_at,
      last_scanned_at: product.last_scanned_at ?? existing.last_scanned_at
    });
  }

  return saveUserFoodProduct(client, userId, product);
}

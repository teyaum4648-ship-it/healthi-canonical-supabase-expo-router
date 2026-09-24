import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FoodPatternProfile, MealLog } from '../../engines/nutrition';
import type { PostMealResponseLogRow } from './foodPersonalizationPersistence';
import type { MealLogItemRow } from './mealItemPersistence';
import { findMisfiledMealLogs, repairMisfiledMealLogs, type MisfiledMealLog } from './misfiledMealLogs';
import type { UserFoodProductRow } from './productLibraryPersistence';

export const demoNutritionMealLogsKey = 'healthi:demo:nutrition:mealLogs';
export const demoNutritionPostMealResponsesKey = 'healthi:demo:nutrition:postMealResponses';
export const demoNutritionFoodPatternProfileKey = 'healthi:demo:nutrition:foodPatternProfile';
export const demoNutritionUserFoodProductsKey = 'healthi:demo:nutrition:userFoodProducts';
export const demoNutritionMealLogItemsKey = 'healthi:demo:nutrition:mealLogItems';

export type LocalDemoNutritionState = {
  mealLogs: MealLog[];
  postMealResponses: PostMealResponseLogRow[];
  foodPatternProfile: FoodPatternProfile | null;
  userFoodProducts: UserFoodProductRow[];
  mealLogItems: MealLogItemRow[];
};

const emptyDemoNutritionState: LocalDemoNutritionState = {
  mealLogs: [],
  postMealResponses: [],
  foodPatternProfile: null,
  userFoodProducts: [],
  mealLogItems: []
};

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseJson(value: string | null): unknown {
  if (!value) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isDemoMealLog(value: unknown): value is MealLog {
  return (
    isRecord(value) &&
    typeof value.logged_at === 'string' &&
    typeof value.meal_type === 'string' &&
    typeof value.name === 'string' &&
    typeof value.source === 'string' &&
    typeof value.source_confidence === 'string' &&
    typeof value.created_at === 'string' &&
    isStringArray(value.quality_flags) &&
    isStringArray(value.reason_codes)
  );
}

function isDemoPostMealResponse(value: unknown): value is PostMealResponseLogRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.responded_at === 'string' &&
    typeof value.overall_score === 'number' &&
    typeof value.confidence === 'string' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    isStringArray(value.reason_codes)
  );
}

function isDemoFoodPatternProfile(value: unknown): value is FoodPatternProfile {
  return (
    isRecord(value) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    typeof value.source === 'string' &&
    typeof value.confidence === 'string' &&
    typeof value.pattern_label === 'string' &&
    isRecord(value.scores) &&
    isRecord(value.macro_tendency) &&
    isRecord(value.meal_timing_tendency) &&
    isRecord(value.response_tendencies) &&
    isStringArray(value.reason_codes)
  );
}

function isDemoUserFoodProduct(value: unknown): value is UserFoodProductRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.provider === 'string' &&
    typeof value.name === 'string' &&
    typeof value.quality_confidence === 'string' &&
    typeof value.source === 'string' &&
    typeof value.source_confidence === 'string' &&
    typeof value.is_saved === 'boolean' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    isStringArray(value.quality_flags) &&
    isStringArray(value.quality_reason_codes)
  );
}

function isDemoMealLogItem(value: unknown): value is MealLogItemRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.logged_at === 'string' &&
    typeof value.meal_type === 'string' &&
    typeof value.name === 'string' &&
    typeof value.servings === 'number' &&
    typeof value.source === 'string' &&
    typeof value.source_confidence === 'string' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    isStringArray(value.reason_codes)
  );
}

export function serializeDemoMealLogs(mealLogs: MealLog[]): string {
  return JSON.stringify(mealLogs.map((mealLog) => cloneSerializable(mealLog)));
}

export function deserializeDemoMealLogs(value: string | null): MealLog[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isDemoMealLog).map((mealLog) => cloneSerializable(mealLog));
}

export function serializeDemoPostMealResponses(responses: PostMealResponseLogRow[]): string {
  return JSON.stringify(responses.map((response) => cloneSerializable(response)));
}

export function deserializeDemoPostMealResponses(value: string | null): PostMealResponseLogRow[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isDemoPostMealResponse).map((response) => cloneSerializable(response));
}

export function serializeDemoFoodPatternProfile(profile: FoodPatternProfile | null): string {
  return JSON.stringify(profile ? cloneSerializable(profile) : null);
}

export function deserializeDemoFoodPatternProfile(value: string | null): FoodPatternProfile | null {
  const parsed = parseJson(value);
  if (!isDemoFoodPatternProfile(parsed)) return null;

  return cloneSerializable(parsed);
}

export function serializeDemoUserFoodProducts(products: UserFoodProductRow[]): string {
  return JSON.stringify(products.map((product) => cloneSerializable(product)));
}

export function deserializeDemoUserFoodProducts(value: string | null): UserFoodProductRow[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isDemoUserFoodProduct).map((product) => cloneSerializable(product));
}

export function serializeDemoMealLogItems(items: MealLogItemRow[]): string {
  return JSON.stringify(items.map((item) => cloneSerializable(item)));
}

export function deserializeDemoMealLogItems(value: string | null): MealLogItemRow[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isDemoMealLogItem).map((item) => cloneSerializable(item));
}

export function toLocalDemoMealLog(mealLog: MealLog): MealLog {
  return cloneSerializable(mealLog);
}

export async function getLocalDemoNutritionState(): Promise<LocalDemoNutritionState> {
  await recoverMealEdit();
  const [mealLogs, postMealResponses, foodPatternProfile, userFoodProducts, mealLogItems] = await Promise.all([
    AsyncStorage.getItem(demoNutritionMealLogsKey),
    AsyncStorage.getItem(demoNutritionPostMealResponsesKey),
    AsyncStorage.getItem(demoNutritionFoodPatternProfileKey),
    AsyncStorage.getItem(demoNutritionUserFoodProductsKey),
    AsyncStorage.getItem(demoNutritionMealLogItemsKey)
  ]);

  return {
    mealLogs: deserializeDemoMealLogs(mealLogs),
    postMealResponses: deserializeDemoPostMealResponses(postMealResponses),
    foodPatternProfile: deserializeDemoFoodPatternProfile(foodPatternProfile),
    userFoodProducts: deserializeDemoUserFoodProducts(userFoodProducts),
    mealLogItems: deserializeDemoMealLogItems(mealLogItems)
  };
}

const mealEditJournalKey = 'healthi:demo:nutrition:mealEditJournal';
async function recoverMealEdit() {
  const raw = await AsyncStorage.getItem(mealEditJournalKey);
  if (!raw) return;
  const journal = JSON.parse(raw) as { meals: MealLog[]; items: MealLogItemRow[] };
  if (!Array.isArray(journal.meals) || !Array.isArray(journal.items)) throw new Error('Meal edit needs recovery.');
  await AsyncStorage.setItem(demoNutritionMealLogsKey, serializeDemoMealLogs(journal.meals));
  await AsyncStorage.setItem(demoNutritionMealLogItemsKey, serializeDemoMealLogItems(journal.items));
  await AsyncStorage.removeItem(mealEditJournalKey);
}

export async function replaceLocalDemoMealItems(meal: MealLog, items: MealLogItemRow[]) {
  const current = await getLocalDemoNutritionState();
  if (!current.mealLogs.some(row => row.id === meal.id)) throw new Error('This meal is no longer in your diary.');
  const meals = current.mealLogs.map(row => row.id === meal.id ? meal : row);
  const nextItems = [...current.mealLogItems.filter(row => row.meal_log_id !== meal.id), ...items];
  // A single durable journal write is the commit point; interrupted materialization
  // is replayed before any reader sees the aggregate or its foods.
  await AsyncStorage.setItem(mealEditJournalKey, JSON.stringify({ meals, items: nextItems }));
  await recoverMealEdit().catch(() => undefined);
  return { meals, items: nextItems };
}

export async function saveLocalDemoMealLogs(mealLogs: MealLog[]): Promise<void> {
  await AsyncStorage.setItem(demoNutritionMealLogsKey, serializeDemoMealLogs(mealLogs));
}

/**
 * Attach a post-meal response to one stored meal.
 *
 * The response screen used to build the whole collection from React state and write that
 * over storage. When the demo load had failed, that state was an empty array and saving a
 * response erased every meal the person had ever logged — a failed read turning into a
 * destructive write. Reading the stored collection first means a write can only ever change
 * the one meal it names.
 */
/**
 * Replace one stored meal with an edited version.
 *
 * Read-then-write for the same reason as the response path: a screen's copy of the diary is
 * never the authority on what is stored, so a write starts from storage and changes one row.
 */
export async function replaceLocalDemoMealLog(meal: MealLog): Promise<MealLog[]> {
  const current = await getLocalDemoNutritionState();
  if (!current.mealLogs.some((row) => row.id === meal.id)) throw new Error('This meal is no longer available. Refresh the diary.');
  const next = current.mealLogs.map((row) => (row.id === meal.id ? meal : row));
  await saveLocalDemoMealLogs(next);
  return next;
}

export async function applyLocalDemoMealResponse(
  mealLogId: string | null,
  userResponse: MealLog['user_response']
): Promise<MealLog[]> {
  const current = await getLocalDemoNutritionState();
  /* A response can be logged without naming a meal. There is then nothing to attach it to. */
  if (!mealLogId) return current.mealLogs;
  const next = current.mealLogs.map((meal) => (meal.id === mealLogId ? { ...meal, user_response: userResponse } : meal));
  await saveLocalDemoMealLogs(next);
  return next;
}

/** What the diary currently holds that the manual form filed under the wrong day. */
export async function findLocalDemoMisfiledMealLogs(): Promise<MisfiledMealLog[]> {
  return findMisfiledMealLogs((await getLocalDemoNutritionState()).mealLogs);
}

/** Move the named entries onto the day they were entered on, and say how many moved. */
export async function repairLocalDemoMealLogs(ids: readonly string[]): Promise<{ moved: number; remaining: MisfiledMealLog[] }> {
  const current = await getLocalDemoNutritionState();
  const repaired = repairMisfiledMealLogs(current.mealLogs, ids);
  const moved = repaired.filter((meal, index) => meal !== current.mealLogs[index]).length;
  /* Writing an unchanged diary back would be a pointless risk, so it is skipped. */
  if (moved > 0) await saveLocalDemoMealLogs(repaired);
  return { moved, remaining: findMisfiledMealLogs(repaired) };
}

export async function appendLocalDemoMealLog(mealLog: MealLog): Promise<MealLog[]> {
  const current = await getLocalDemoNutritionState();
  const nextMealLog = toLocalDemoMealLog(mealLog);
  const nextMealLogs = [nextMealLog, ...current.mealLogs.filter((item) => item.id !== nextMealLog.id)];
  await saveLocalDemoMealLogs(nextMealLogs);
  return nextMealLogs;
}

export async function saveLocalDemoPostMealResponses(responses: PostMealResponseLogRow[]): Promise<void> {
  await AsyncStorage.setItem(demoNutritionPostMealResponsesKey, serializeDemoPostMealResponses(responses));
}

export async function appendLocalDemoPostMealResponse(response: PostMealResponseLogRow): Promise<PostMealResponseLogRow[]> {
  const current = await getLocalDemoNutritionState();
  const nextResponse = cloneSerializable(response);
  const nextResponses = [nextResponse, ...current.postMealResponses.filter((item) => item.id !== nextResponse.id)];
  await saveLocalDemoPostMealResponses(nextResponses);
  return nextResponses;
}

export async function saveLocalDemoFoodPatternProfile(profile: FoodPatternProfile | null): Promise<void> {
  await AsyncStorage.setItem(demoNutritionFoodPatternProfileKey, serializeDemoFoodPatternProfile(profile));
}

export async function saveLocalDemoUserFoodProducts(products: UserFoodProductRow[]): Promise<void> {
  await AsyncStorage.setItem(demoNutritionUserFoodProductsKey, serializeDemoUserFoodProducts(products));
}

export async function cacheLocalDemoUserFoodProduct(product: UserFoodProductRow): Promise<UserFoodProductRow[]> {
  const current = await getLocalDemoNutritionState();
  const nextProduct = cloneSerializable(product);
  const nextProducts = [
    nextProduct,
    ...current.userFoodProducts.filter((item) => item.id !== nextProduct.id && (!nextProduct.barcode || item.barcode !== nextProduct.barcode))
  ];
  await saveLocalDemoUserFoodProducts(nextProducts);
  return nextProducts;
}

export async function updateLocalDemoUserFoodProduct(
  productId: string,
  update: Partial<UserFoodProductRow>
): Promise<UserFoodProductRow[]> {
  const current = await getLocalDemoNutritionState();
  const nextProducts = current.userFoodProducts.map((product) =>
    product.id === productId
      ? cloneSerializable({ ...product, ...update, id: product.id, user_id: product.user_id, updated_at: new Date().toISOString() })
      : product
  );
  await saveLocalDemoUserFoodProducts(nextProducts);
  return nextProducts;
}

export async function getRecentLocalDemoUserFoodProducts(limit = 12): Promise<UserFoodProductRow[]> {
  const { userFoodProducts } = await getLocalDemoNutritionState();
  return [...userFoodProducts]
    .sort((left, right) => (right.last_used_at ?? right.updated_at).localeCompare(left.last_used_at ?? left.updated_at))
    .slice(0, limit);
}

export async function getSavedLocalDemoUserFoodProducts(limit = 30): Promise<UserFoodProductRow[]> {
  const { userFoodProducts } = await getLocalDemoNutritionState();
  return userFoodProducts.filter((product) => product.is_saved).slice(0, limit);
}

export async function saveLocalDemoMealLogItems(items: MealLogItemRow[]): Promise<void> {
  await AsyncStorage.setItem(demoNutritionMealLogItemsKey, serializeDemoMealLogItems(items));
}

export async function appendLocalDemoMealLogItems(items: MealLogItemRow[]): Promise<MealLogItemRow[]> {
  const current = await getLocalDemoNutritionState();
  const ids = new Set(items.map((item) => item.id));
  const nextItems = [...items.map((item) => cloneSerializable(item)), ...current.mealLogItems.filter((item) => !ids.has(item.id))];
  await saveLocalDemoMealLogItems(nextItems);
  return nextItems;
}

export async function deleteLocalDemoMealLogItem(itemId: string): Promise<MealLogItemRow[]> {
  const current = await getLocalDemoNutritionState();
  const nextItems = current.mealLogItems.filter((item) => item.id !== itemId);
  await saveLocalDemoMealLogItems(nextItems);
  return nextItems;
}

export function createEmptyLocalDemoNutritionState(): LocalDemoNutritionState {
  return cloneSerializable(emptyDemoNutritionState);
}

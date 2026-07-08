import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FoodPatternProfile, MealLog } from '../../engines/nutrition';
import type { PostMealResponseLogRow } from './foodPersonalizationPersistence';

export const demoNutritionMealLogsKey = 'healthi:demo:nutrition:mealLogs';
export const demoNutritionPostMealResponsesKey = 'healthi:demo:nutrition:postMealResponses';
export const demoNutritionFoodPatternProfileKey = 'healthi:demo:nutrition:foodPatternProfile';

export type LocalDemoNutritionState = {
  mealLogs: MealLog[];
  postMealResponses: PostMealResponseLogRow[];
  foodPatternProfile: FoodPatternProfile | null;
};

const emptyDemoNutritionState: LocalDemoNutritionState = {
  mealLogs: [],
  postMealResponses: [],
  foodPatternProfile: null
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

export function toLocalDemoMealLog(mealLog: MealLog): MealLog {
  return cloneSerializable(mealLog);
}

export async function getLocalDemoNutritionState(): Promise<LocalDemoNutritionState> {
  const [mealLogs, postMealResponses, foodPatternProfile] = await Promise.all([
    AsyncStorage.getItem(demoNutritionMealLogsKey),
    AsyncStorage.getItem(demoNutritionPostMealResponsesKey),
    AsyncStorage.getItem(demoNutritionFoodPatternProfileKey)
  ]);

  return {
    mealLogs: deserializeDemoMealLogs(mealLogs),
    postMealResponses: deserializeDemoPostMealResponses(postMealResponses),
    foodPatternProfile: deserializeDemoFoodPatternProfile(foodPatternProfile)
  };
}

export async function saveLocalDemoMealLogs(mealLogs: MealLog[]): Promise<void> {
  await AsyncStorage.setItem(demoNutritionMealLogsKey, serializeDemoMealLogs(mealLogs));
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

export function createEmptyLocalDemoNutritionState(): LocalDemoNutritionState {
  return cloneSerializable(emptyDemoNutritionState);
}

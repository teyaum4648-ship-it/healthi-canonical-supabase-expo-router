import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EveningCloseoutAnswers, EveningCloseoutResult } from './eveningCloseoutTypes';

/**
 * Local persistence for evening closeout records. Same V1 boundary rationale as
 * the daily protocol store: no dedicated remote table exists, so records are
 * stored locally per user scope. The `EveningCloseoutStore` interface is the
 * clean boundary a future Supabase implementation can drop into.
 */

const STORAGE_KEY = 'healthi:coachingLoop:closeout:v1';

export type EveningCloseoutRecord = {
  answers: EveningCloseoutAnswers;
  result: EveningCloseoutResult;
  saved_at: string;
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

function isCloseoutRecord(value: unknown): value is EveningCloseoutRecord {
  return isRecord(value) && isRecord(value.result) && typeof (value.result as { date?: unknown }).date === 'string';
}

type ScopeMap = Record<string, Record<string, EveningCloseoutRecord>>;

async function readAll(): Promise<ScopeMap> {
  try {
    const parsed = parseJson(await AsyncStorage.getItem(STORAGE_KEY));
    if (!isRecord(parsed)) return {};
    return parsed as ScopeMap;
  } catch {
    return {};
  }
}

async function writeAll(map: ScopeMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort in V1; never surface a crash to the closeout flow.
  }
}

export type EveningCloseoutStore = {
  read(scope: string, date: string): Promise<EveningCloseoutRecord | null>;
  write(scope: string, record: EveningCloseoutRecord): Promise<void>;
  clear(scope: string, date: string): Promise<void>;
};

export const localEveningCloseoutStore: EveningCloseoutStore = {
  async read(scope, date) {
    const all = await readAll();
    const candidate = all[scope]?.[date.slice(0, 10)];
    return isCloseoutRecord(candidate) ? cloneSerializable(candidate) : null;
  },
  async write(scope, record) {
    const all = await readAll();
    const date = record.result.date.slice(0, 10);
    all[scope] = { ...(all[scope] ?? {}), [date]: cloneSerializable(record) };
    await writeAll(all);
  },
  async clear(scope, date) {
    const all = await readAll();
    const key = date.slice(0, 10);
    if (all[scope]) {
      const { [key]: _removed, ...rest } = all[scope];
      all[scope] = rest;
      await writeAll(all);
    }
  }
};

/** Deferred remote boundary — safe and inert until a dedicated table exists. */
export const remoteEveningCloseoutStoreUnavailable: EveningCloseoutStore = {
  async read() {
    return null;
  },
  async write() {
    /* deferred until a safe remote table exists */
  },
  async clear() {
    /* deferred until a safe remote table exists */
  }
};

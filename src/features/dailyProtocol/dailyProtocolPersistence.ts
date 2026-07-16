import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyProtocol, ProtocolActionStatus } from '../../engines/protocol';

/**
 * Persistence boundary for the daily protocol.
 *
 * V1 note: there is no dedicated remote table for daily protocol / adherence
 * (the existing `daily_checkins` table is a morning check-in shape and does not
 * match action-level pending/done/skipped/deferred state). To avoid deploying a
 * migration, protocol state is persisted locally per user scope. The
 * `DailyProtocolStore` interface below is the clean boundary a future Supabase
 * implementation can drop into; `remoteDailyProtocolStoreUnavailable` documents
 * that the remote path is intentionally deferred and stays safe (never throws,
 * never exposes another user's data).
 */

const STORAGE_KEY = 'healthi:coachingLoop:protocol:v1';

const isUuid = (value: string | null | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

/** User-scoped storage key segment. Signed-in users are keyed by id; demo/local stays 'demo'. */
export function protocolScope(userId: string | null | undefined): string {
  return isUuid(userId) ? userId : 'demo';
}

const VALID_STATUSES: ProtocolActionStatus[] = ['pending', 'done', 'skipped', 'deferred'];

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

function isStoredProtocol(value: unknown): value is DailyProtocol {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    Array.isArray(value.actions)
  );
}

type ScopeMap = Record<string, Record<string, DailyProtocol>>;

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
    // Storage is best-effort in V1; never surface a crash to the coaching loop.
  }
}

/** Overlay stored per-action statuses onto a freshly generated protocol (pure, testable). */
export function reconcileProtocolStatuses(fresh: DailyProtocol, stored: DailyProtocol | null): DailyProtocol {
  if (!stored) return fresh;
  const storedStatus = new Map(stored.actions.map((action) => [action.id, action.status]));
  return {
    ...fresh,
    actions: fresh.actions.map((action) => {
      const previous = storedStatus.get(action.id);
      return previous && VALID_STATUSES.includes(previous) ? { ...action, status: previous } : action;
    })
  };
}

export type DailyProtocolStore = {
  read(scope: string, date: string): Promise<DailyProtocol | null>;
  write(scope: string, protocol: DailyProtocol): Promise<void>;
  setActionStatus(
    scope: string,
    date: string,
    actionId: string,
    status: ProtocolActionStatus
  ): Promise<DailyProtocol | null>;
  clear(scope: string, date: string): Promise<void>;
};

export const localDailyProtocolStore: DailyProtocolStore = {
  async read(scope, date) {
    const all = await readAll();
    const candidate = all[scope]?.[date.slice(0, 10)];
    return isStoredProtocol(candidate) ? cloneSerializable(candidate) : null;
  },
  async write(scope, protocol) {
    const all = await readAll();
    const date = protocol.date.slice(0, 10);
    all[scope] = { ...(all[scope] ?? {}), [date]: cloneSerializable(protocol) };
    await writeAll(all);
  },
  async setActionStatus(scope, date, actionId, status) {
    if (!VALID_STATUSES.includes(status)) return null;
    const all = await readAll();
    const key = date.slice(0, 10);
    const current = all[scope]?.[key];
    if (!isStoredProtocol(current)) return null;
    const next: DailyProtocol = {
      ...current,
      actions: current.actions.map((action) =>
        action.id === actionId ? { ...action, status } : action
      )
    };
    all[scope] = { ...(all[scope] ?? {}), [key]: next };
    await writeAll(all);
    return cloneSerializable(next);
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

/**
 * Boundary placeholder for a future remote (Supabase) protocol store. It stays
 * safe and inert until a dedicated table + RLS policy exist — reads return null
 * (which surfaces a calibrating/setup state) and writes are no-ops. Nothing here
 * exposes another user's data.
 */
export const remoteDailyProtocolStoreUnavailable: DailyProtocolStore = {
  async read() {
    return null;
  },
  async write() {
    /* deferred until a safe remote table exists */
  },
  async setActionStatus() {
    return null;
  },
  async clear() {
    /* deferred until a safe remote table exists */
  }
};

/**
 * Read the stored protocol, overlay statuses onto the freshly generated one,
 * persist the reconciled result, and return it. Used by Home to keep action
 * state stable across regenerations within the same day.
 */
export async function persistReconciledProtocol(
  scope: string,
  fresh: DailyProtocol,
  store: DailyProtocolStore = localDailyProtocolStore
): Promise<DailyProtocol> {
  const stored = await store.read(scope, fresh.date);
  const reconciled = reconcileProtocolStatuses(fresh, stored);
  await store.write(scope, reconciled);
  return reconciled;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Append-only per-user logs on the device.
 *
 * Four features on the Mood tab needed the same thing — read my rows, add a row, keep
 * them namespaced by user, survive a corrupt or missing value, and do not grow without
 * bound. That was already written once for breathing sessions; writing it three more
 * times is how four subtly different bugs get introduced.
 *
 * Every store validates on the way out rather than trusting what it wrote earlier. A
 * shipped app changes its own record shapes, and a row written by an older build has to
 * be dropped rather than crash a screen. The same reason nothing here throws: a blocked
 * or full storage is a degraded feature, not a broken tab.
 *
 * This is still the V1 boundary. There is no remote table for any of it yet, so scope is
 * a local namespace and this interface is the seam a Supabase implementation drops into.
 */

export type ScopedLogStore<T> = {
  read(scope: string): Promise<T[]>;
  append(scope: string, row: T): Promise<T[]>;
  replace(scope: string, rows: T[]): Promise<T[]>;
};

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function createScopedLogStore<T>({
  key,
  isRow,
  cap = 400
}: {
  key: string;
  /** Applied on every read, so a row from an older build is dropped rather than trusted. */
  isRow: (value: unknown) => value is T;
  cap?: number;
}): ScopedLogStore<T> {
  type ScopeMap = Record<string, T[]>;

  async function readAll(): Promise<ScopeMap> {
    try {
      const parsed = parseJson(await AsyncStorage.getItem(key));
      return isRecord(parsed) ? (parsed as ScopeMap) : {};
    } catch {
      return {};
    }
  }

  function rowsFor(all: ScopeMap, scope: string): T[] {
    const rows = all[scope];
    return Array.isArray(rows) ? rows.filter(isRow) : [];
  }

  async function commit(all: ScopeMap, scope: string, next: T[]): Promise<T[]> {
    /* Newest last, oldest dropped first. */
    const capped = next.slice(-cap);
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ ...all, [scope]: capped }));
    } catch {
      /* Caller keeps its optimistic state; losing the write must not lose the screen. */
    }
    return capped;
  }

  return {
    async read(scope) {
      return rowsFor(await readAll(), scope);
    },

    async append(scope, row) {
      const all = await readAll();
      return commit(all, scope, [...rowsFor(all, scope), row]);
    },

    async replace(scope, rows) {
      const all = await readAll();
      return commit(all, scope, rows.filter(isRow));
    }
  };
}

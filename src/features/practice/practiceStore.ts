import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PracticeSession } from './practiceModel';

/**
 * Local persistence for breathing sessions.
 *
 * Same V1 boundary as the evening closeout store: there is no remote table for this
 * yet, so records live locally per user scope and this interface is the seam a Supabase
 * implementation drops into later.
 */

const STORAGE_KEY = 'healthi:practice:breath:v1';

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

function isSession(value: unknown): value is PracticeSession {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.date === 'string'
    && typeof value.rhythmId === 'string'
    && typeof value.seconds === 'number'
    && typeof value.finishedAt === 'string';
}

type ScopeMap = Record<string, PracticeSession[]>;

async function readAll(): Promise<ScopeMap> {
  try {
    const parsed = parseJson(await AsyncStorage.getItem(STORAGE_KEY));
    return isRecord(parsed) ? parsed as ScopeMap : {};
  } catch {
    return {};
  }
}

export const localPracticeStore = {
  async read(scope: string): Promise<PracticeSession[]> {
    const all = await readAll();
    const rows = all[scope];
    return Array.isArray(rows) ? rows.filter(isSession) : [];
  },

  async append(scope: string, session: PracticeSession): Promise<PracticeSession[]> {
    const all = await readAll();
    const rows = (Array.isArray(all[scope]) ? all[scope].filter(isSession) : []);
    /* Newest last, and capped so a long-running demo cannot grow without bound. */
    const next = [...rows, session].slice(-400);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [scope]: next }));
    } catch {
      /* A blocked or full store must not lose the session from this screen's state. */
    }
    return next;
  }
};

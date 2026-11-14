import { useSyncExternalStore } from 'react';

import type { DailyReadinessDriver } from '../../engines/readiness';
import type { DataConfidence } from '../../types/common';
import type { ZoneTone } from '../../styles/mobileTheme';
import type { ReadinessHistoryEntry } from '../trends/readinessHistoryStore';
import type { PillarReading } from './premium/pillarRingModel';

/**
 * What Today showed for readiness, held so the Readiness detail screen opens on exactly
 * the same number, words and breakdown instead of recomputing a second, possibly
 * different, estimate. Home writes it whenever its reading changes; nothing is stored.
 */
export type ReadinessSnapshot = {
  date: string;
  score: number | null;
  zone: ZoneTone;
  word: string;
  insight: string;
  confidence: DataConfidence;
  /** How many of the inputs had a signal, out of how many there are. */
  signals: { present: number; total: number };
  pillars: readonly PillarReading[];
  drivers: DailyReadinessDriver[];
  history: ReadinessHistoryEntry[];
  sleep: { minutes: number | null; needMinutes: number; detail: string };
  restingHeartRate: { bpm: number | null; detail: string };
  training: { value: string; detail: string };
};

let current: ReadinessSnapshot | null = null;
const listeners = new Set<() => void>();

let currentKey = '';

/** Replaces the snapshot only when something in it changed, so listeners are not woken for nothing. */
export function setReadinessSnapshot(next: ReadinessSnapshot): void {
  const key = JSON.stringify(next);
  if (key === currentKey) return;
  currentKey = key;
  current = next;
  listeners.forEach((listener) => listener());
}

export function getReadinessSnapshot(): ReadinessSnapshot | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useReadinessSnapshot(): ReadinessSnapshot | null {
  return useSyncExternalStore(subscribe, getReadinessSnapshot, getReadinessSnapshot);
}

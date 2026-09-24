import type { DataConfidence } from '../../types/common';
import { createScopedLogStore, isRecord } from '../practice/scopedLogStore';

/**
 * One reading of the day's readiness estimate, kept so Trends has something to average.
 *
 * Readiness was computed on Home every time it opened and never written anywhere, so the
 * Trends card for it said "Calibrating" forever. This keeps the day's latest estimate —
 * one row per day, replaced as the day's logs fill in — and only when the estimate had
 * enough to go on: a day that was still calibrating is left out rather than recorded as
 * the baseline 70, which would read as a finding when it is an absence.
 *
 * It lives on the device, like the Mood logs. The account table for readiness wants
 * load and vitality figures this app does not calculate, and filling them with
 * placeholders to satisfy the schema would store numbers nobody measured.
 */
export type ReadinessHistoryEntry = {
  date: string;
  score: number;
  label: string;
  confidence: DataConfidence;
  recordedAt: string;
};

function isEntry(value: unknown): value is ReadinessHistoryEntry {
  return isRecord(value)
    && typeof value.date === 'string'
    && typeof value.score === 'number'
    && Number.isFinite(value.score)
    && typeof value.label === 'string'
    && typeof value.confidence === 'string'
    && typeof value.recordedAt === 'string';
}

export const localReadinessHistoryStore = createScopedLogStore<ReadinessHistoryEntry>({
  key: 'healthi:readiness:history:v1',
  isRow: isEntry,
  cap: 60
});

/** The day's rows with this one in place of any earlier reading for the same day. */
export function withReadinessEntry(rows: ReadinessHistoryEntry[], entry: ReadinessHistoryEntry): ReadinessHistoryEntry[] {
  return [...rows.filter((row) => row.date !== entry.date), entry].sort((left, right) => left.date.localeCompare(right.date));
}

export async function recordReadiness(scope: string, entry: ReadinessHistoryEntry): Promise<void> {
  const rows = await localReadinessHistoryStore.read(scope);
  const current = rows.find((row) => row.date === entry.date);
  if (current && current.score === entry.score && current.label === entry.label && current.confidence === entry.confidence) return;
  await localReadinessHistoryStore.replace(scope, withReadinessEntry(rows, entry));
}

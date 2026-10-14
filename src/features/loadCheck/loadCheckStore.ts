import type { DataConfidence } from '../../types/common';
import {
  LOAD_ITEMS,
  scoreLoadCheck,
  type LoadAnswers,
  type LoadCheckResult,
  type LoadPoints,
  type ObservedLoadAnswers
} from '../../engines/loadCheck';
import { createScopedLogStore, isRecord } from '../practice/scopedLogStore';

/**
 * Completed load checks, on the device.
 *
 * Only the answers and the observed answers are kept; the result is scored again every
 * time it is read, so an improvement to the scoring reaches an old check rather than
 * leaving a stale number behind. Like the Mood tab's logs this is local for now, with the
 * scope as the seam a remote table would drop into.
 */

export type LoadCheckRecord = {
  id: string;
  completedAt: string;
  answers: LoadAnswers;
  observed: ObservedLoadAnswers;
};

const ITEM_IDS = new Set(LOAD_ITEMS.map((item) => item.id));
const isPoints = (value: unknown): value is LoadPoints => value === 0 || value === 1 || value === 2 || value === 3;

function isRecordRow(value: unknown): value is LoadCheckRecord {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.completedAt !== 'string') return false;
  if (!isRecord(value.answers) || !isRecord(value.observed)) return false;
  const answersOk = Object.entries(value.answers).every(([id, points]) => ITEM_IDS.has(id) && isPoints(points));
  const observedOk = Object.entries(value.observed).every(([id, entry]) =>
    ITEM_IDS.has(id) && isRecord(entry) && isPoints(entry.points) && typeof entry.basis === 'string');
  return answersOk && observedOk;
}

export const localLoadCheckStore = createScopedLogStore<LoadCheckRecord>({
  key: 'healthi:loadcheck:v1',
  isRow: isRecordRow,
  cap: 24
});

export function latestLoadCheck(rows: readonly LoadCheckRecord[]): LoadCheckRecord | null {
  return [...rows].sort((a, b) => a.completedAt.localeCompare(b.completedAt)).at(-1) ?? null;
}

export function scoreRecord(record: LoadCheckRecord): LoadCheckResult {
  return scoreLoadCheck(record.answers, record.observed);
}

/** The readiness starting point a completed check gives, or null when it cannot give one. */
export function personalBaselineFrom(record: LoadCheckRecord | null): { score: number; confidence: DataConfidence; reason_codes: string[] } | null {
  if (!record) return null;
  const result = scoreRecord(record);
  if (result.baseline === null) return null;
  return { score: result.baseline, confidence: result.confidence, reason_codes: result.reason_codes };
}

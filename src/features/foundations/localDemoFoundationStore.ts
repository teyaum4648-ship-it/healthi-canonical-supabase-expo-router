import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FoundationDomain, FoundationScore } from '../../engines/foundations/foundationTypes';
import { toStoredFoundationScore, type FoundationScoreRow, type StoredFoundationScore } from './foundationScorePersistence';

export const demoFoundationScoresKey = 'healthi:demo:foundations:scores';

/** Days kept on the device. Enough for a month's trend without the store growing forever. */
const MAX_DAYS = 45;

function isStored(value: unknown): value is StoredFoundationScore {
  return Boolean(value && typeof value === 'object' && 'confidence' in (value as object));
}

function isRow(value: unknown): value is FoundationScoreRow {
  return Boolean(value && typeof value === 'object' && typeof (value as FoundationScoreRow).score_date === 'string');
}

export async function getLocalDemoFoundationScores(): Promise<FoundationScoreRow[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(demoFoundationScoresKey)) ?? 'null');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRow).sort((left, right) => left.score_date.localeCompare(right.score_date));
  } catch {
    return [];
  }
}

/**
 * Record one pillar for one day on the device.
 *
 * Reads the stored days first and changes the one pillar of the one day, for the same
 * reason the account path updates a single column: the pillars are computed on different
 * screens, and a write built from one screen's view would drop what the others recorded.
 */
export async function saveLocalDemoFoundationScore(domain: FoundationDomain, score: FoundationScore): Promise<FoundationScoreRow[]> {
  const scoreDate = score.date.slice(0, 10);
  const value = toStoredFoundationScore(score);
  const current = await getLocalDemoFoundationScores();
  const existing = current.find((row) => row.score_date === scoreDate);
  const next = existing
    ? current.map((row) => (row.score_date === scoreDate ? { ...row, [domain]: value } : row))
    : [...current, { user_id: 'demo-user', score_date: scoreDate, recovery_rhythm: {}, nourishment: {}, movement_capacity: {}, mind_life_load: {}, [domain]: value } as FoundationScoreRow];
  const trimmed = next.sort((left, right) => left.score_date.localeCompare(right.score_date)).slice(-MAX_DAYS);
  await AsyncStorage.setItem(demoFoundationScoresKey, JSON.stringify(trimmed));
  return trimmed;
}

export { isStored as isStoredDemoFoundationScore };

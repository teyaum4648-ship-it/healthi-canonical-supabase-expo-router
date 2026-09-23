import { createScopedLogStore, isRecord } from '../practice/scopedLogStore';
import { CHRONOTYPE_QUESTIONS, type ChronotypeId } from '../../engines/circadian';

/**
 * What someone said about their clock, and what they made of the day we proposed.
 *
 * Both halves matter. The answers seed the phase estimate, and the verdict on the
 * suggested day decides whether the app may go on suggesting it — a schedule somebody
 * declined should not keep reappearing as though they had not looked at it.
 *
 * Slot overrides are kept verbatim rather than folded back into the answers, because
 * "my best thinking is actually after lunch" is a correction to a suggestion, not a
 * different answer to a question about when they wake.
 */

export type ChronotypeRecord = {
  answers: Record<string, string>;
  chronotype: ChronotypeId;
  preferredMidSleepMinutes: number;
  /** null until they have said; false means do not keep proposing it. */
  accepted: boolean | null;
  /** Slot id to start minute, for the slots they moved. */
  slotOverrides: Record<string, number>;
  savedAt: string;
};

const QUESTION_IDS = new Set(CHRONOTYPE_QUESTIONS.map((question) => question.id));
const CHRONOTYPES: ChronotypeId[] = [
  'early_clock', 'early_leaning', 'middle_clock', 'late_leaning', 'late_clock'
];

function isChronotypeRecord(value: unknown): value is ChronotypeRecord {
  if (!isRecord(value)) return false;
  if (typeof value.savedAt !== 'string') return false;
  if (typeof value.chronotype !== 'string' || !CHRONOTYPES.includes(value.chronotype as ChronotypeId)) return false;
  if (typeof value.preferredMidSleepMinutes !== 'number' || !Number.isFinite(value.preferredMidSleepMinutes)) return false;
  if (!(value.accepted === null || typeof value.accepted === 'boolean')) return false;
  if (!isRecord(value.answers) || !isRecord(value.slotOverrides)) return false;

  const answersValid = Object.entries(value.answers).every(([id, answer]) =>
    QUESTION_IDS.has(id) && typeof answer === 'string');
  const overridesValid = Object.values(value.slotOverrides).every((minutes) =>
    typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 && minutes < 1440);
  return answersValid && overridesValid;
}

const store = createScopedLogStore<ChronotypeRecord>({
  key: 'healthi.circadian.chronotype.v1',
  isRow: isChronotypeRecord,
  cap: 8
});

export const localChronotypeStore = store;

/** The latest answer set, or null before anyone has taken it. */
export async function readChronotype(scope: string): Promise<ChronotypeRecord | null> {
  const rows = await store.read(scope);
  if (rows.length === 0) return null;
  return [...rows].sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0];
}

export async function saveChronotype(
  scope: string,
  record: Omit<ChronotypeRecord, 'savedAt'>
): Promise<ChronotypeRecord> {
  const saved = { ...record, savedAt: new Date().toISOString() };
  await store.append(scope, saved);
  return saved;
}

/**
 * The prior to hand the phase estimate, or null.
 *
 * Withheld when the suggestion was declined. Someone who looked at the day we built from
 * their answers and said no has told us something about those answers, and carrying on
 * as though they had not is how an app stops feeling like it is listening.
 */
export function chronotypePrior(record: ChronotypeRecord | null): number | null {
  if (!record || record.accepted === false) return null;
  return record.preferredMidSleepMinutes;
}

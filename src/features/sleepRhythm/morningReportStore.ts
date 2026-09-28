import type { MorningReport } from '../../engines/circadian/sleepRecoveryAdapter';
import { createScopedLogStore, isRecord } from '../practice/scopedLogStore';

/**
 * This morning's answers about last night, one row per date, kept on the device.
 *
 * They only sharpen the energy prediction; the sleep window itself stays where it is.
 * Every field is optional because every question can be skipped, and a skipped question
 * lowers the prediction's confidence rather than its score.
 */
export type MorningReportRow = MorningReport & { date: string; recordedAt: string };

const optionalNumber = (value: unknown) => value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);

export function isMorningReportRow(value: unknown): value is MorningReportRow {
  return isRecord(value)
    && typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && typeof value.recordedAt === 'string'
    && optionalNumber(value.sleepLatencyMinutes)
    && optionalNumber(value.awakeningCount)
    && optionalNumber(value.awakeDuringNightMinutes)
    && (value.morningRestedness === undefined || value.morningRestedness === null || [1, 2, 3, 4, 5].includes(value.morningRestedness as number))
    && (value.timesUncertain === undefined || typeof value.timesUncertain === 'boolean');
}

export const localMorningReportStore = createScopedLogStore<MorningReportRow>({
  key: 'healthi:sleep:morning-report:v1',
  isRow: isMorningReportRow,
  cap: 120
});

/** The day's row with this change merged in; earlier days untouched. */
export function withMorningReport(rows: MorningReportRow[], date: string, patch: MorningReport, now = new Date()): MorningReportRow[] {
  const current = rows.find((row) => row.date === date);
  const next: MorningReportRow = { ...(current ?? {}), ...patch, date, recordedAt: now.toISOString() };
  return [...rows.filter((row) => row.date !== date), next].sort((left, right) => left.date.localeCompare(right.date));
}

export async function saveMorningReport(scope: string, date: string, patch: MorningReport): Promise<MorningReportRow[]> {
  const rows = await localMorningReportStore.read(scope);
  return localMorningReportStore.replace(scope, withMorningReport(rows, date, patch));
}

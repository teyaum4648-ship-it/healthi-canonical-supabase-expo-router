import {
  BIOMARKER_SPECS,
  validateBiomarker,
  type BiomarkerKind,
  type BiomarkerReading,
  type BiomarkerSource
} from '../../engines/biomarkers';
import { createScopedLogStore, isRecord } from '../practice/scopedLogStore';

/**
 * Biomarker readings, kept on the device like the Mood logs.
 *
 * Nothing here is sample data: a row exists only because someone typed a reading from
 * their own watch or ring, or because a connected health app delivered one. When the
 * Apple Health and Health Connect modules are added, their readings land in this store
 * with their own source, alongside the typed ones.
 */
const kinds = Object.keys(BIOMARKER_SPECS) as BiomarkerKind[];
const sources: BiomarkerSource[] = ['manual', 'apple_health', 'health_connect'];

export function isBiomarkerReading(value: unknown): value is BiomarkerReading {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.kind === 'string' && kinds.includes(value.kind as BiomarkerKind)
    && typeof value.value === 'number' && validateBiomarker(value.kind as BiomarkerKind, value.value).ok
    && typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && typeof value.recorded_at === 'string'
    && typeof value.source === 'string' && sources.includes(value.source as BiomarkerSource);
}

export const localBiomarkerStore = createScopedLogStore<BiomarkerReading>({
  key: 'healthi:biomarkers:v1',
  isRow: isBiomarkerReading,
  cap: 400
});

/**
 * A typed reading for one day. Entering the same kind again for the same day replaces
 * the earlier manual entry, so a correction does not leave two values behind; readings
 * from a connected app are never overwritten by hand.
 */
export function withManualReading(rows: BiomarkerReading[], reading: BiomarkerReading): BiomarkerReading[] {
  return [
    ...rows.filter((row) => !(row.kind === reading.kind && row.date === reading.date && row.source === 'manual')),
    reading
  ];
}

export async function saveManualReading(scope: string, input: { kind: BiomarkerKind; value: number; date: string; now?: Date }): Promise<BiomarkerReading[]> {
  const check = validateBiomarker(input.kind, input.value);
  if (!check.ok) throw new Error(check.error);
  const now = input.now ?? new Date();
  const reading: BiomarkerReading = {
    id: `manual-${input.kind}-${input.date}-${now.getTime()}`,
    kind: input.kind,
    value: input.value,
    date: input.date,
    recorded_at: now.toISOString(),
    source: 'manual'
  };
  const rows = await localBiomarkerStore.read(scope);
  return localBiomarkerStore.replace(scope, withManualReading(rows, reading));
}

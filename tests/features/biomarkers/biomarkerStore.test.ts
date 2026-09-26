import { describe, expect, it } from 'vitest';

import type { BiomarkerReading } from '../../../src/engines/biomarkers';
import { isBiomarkerReading, withManualReading } from '../../../src/features/biomarkers/biomarkerStore';

const row = (overrides: Partial<BiomarkerReading> = {}): BiomarkerReading => ({
  id: 'r1',
  kind: 'resting_heart_rate',
  value: 58,
  date: '2026-09-26',
  recorded_at: '2026-09-26T07:00:00.000Z',
  source: 'manual',
  ...overrides
});

describe('isBiomarkerReading', () => {
  it('accepts a well-formed reading', () => {
    expect(isBiomarkerReading(row())).toBe(true);
  });

  it('drops rows an older build or a bad write could leave behind', () => {
    expect(isBiomarkerReading(row({ kind: 'blood_pressure' as never }))).toBe(false);
    expect(isBiomarkerReading(row({ value: 400 }))).toBe(false);
    expect(isBiomarkerReading(row({ date: '26/09/2026' }))).toBe(false);
    expect(isBiomarkerReading(row({ source: 'guess' as never }))).toBe(false);
    expect(isBiomarkerReading(null)).toBe(false);
  });
});

describe('withManualReading', () => {
  it('replaces an earlier typed reading of the same kind and day', () => {
    const next = withManualReading([row({ id: 'old', value: 61 })], row({ id: 'new', value: 58 }));
    expect(next.map((reading) => reading.id)).toEqual(['new']);
  });

  it('never overwrites a reading that came from a connected app', () => {
    const imported = row({ id: 'health', source: 'apple_health', value: 60 });
    const next = withManualReading([imported], row({ id: 'typed', value: 58 }));
    expect(next.map((reading) => reading.id)).toEqual(['health', 'typed']);
  });

  it('keeps other kinds and days', () => {
    const hrv = row({ id: 'hrv', kind: 'heart_rate_variability', value: 64 });
    const yesterday = row({ id: 'y', date: '2026-09-25' });
    expect(withManualReading([hrv, yesterday], row({ id: 't' })).map((reading) => reading.id)).toEqual(['hrv', 'y', 't']);
  });
});

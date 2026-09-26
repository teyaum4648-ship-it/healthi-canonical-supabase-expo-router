import { describe, expect, it } from 'vitest';

import {
  BIOMARKER_KINDS,
  biomarkerSeries,
  summarizeBiomarker,
  validateBiomarker,
  type BiomarkerKind,
  type BiomarkerReading
} from '../../../src/engines/biomarkers';

const today = '2026-09-26';

function reading(kind: BiomarkerKind, date: string, value: number, recordedAt = `${date}T07:00:00.000Z`): BiomarkerReading {
  return { id: `${kind}-${date}-${recordedAt}`, kind, value, date, recorded_at: recordedAt, source: 'manual' };
}

function week(kind: BiomarkerKind, values: (number | null)[]): BiomarkerReading[] {
  // values[6] is today, values[0] six days ago.
  return values.flatMap((value, index) => {
    if (value === null) return [];
    const date = new Date(Date.UTC(2026, 8, 20 + index, 12)).toISOString().slice(0, 10);
    return [reading(kind, date, value)];
  });
}

describe('validateBiomarker', () => {
  it('accepts plausible readings and names the range when it refuses one', () => {
    expect(validateBiomarker('resting_heart_rate', 58)).toEqual({ ok: true });
    expect(validateBiomarker('heart_rate_variability', 64)).toEqual({ ok: true });
    expect(validateBiomarker('respiratory_rate', 14.5)).toEqual({ ok: true });
    const low = validateBiomarker('resting_heart_rate', 12);
    expect(low.ok).toBe(false);
    expect(!low.ok && low.error).toContain('between 30 and 120 bpm');
    expect(validateBiomarker('heart_rate_variability', Number.NaN).ok).toBe(false);
  });
});

describe('biomarkerSeries', () => {
  it('gives seven days oldest first, with gaps as null rather than zero', () => {
    const series = biomarkerSeries(week('resting_heart_rate', [58, null, 57, null, null, 60, 59]), 'resting_heart_rate', today);
    expect(series.map((day) => day.date)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']);
    expect(series.map((day) => day.value)).toEqual([58, null, 57, null, null, 60, 59]);
  });

  it('keeps the latest reading of a day and ignores other kinds', () => {
    const rows = [
      reading('resting_heart_rate', today, 61, `${today}T06:00:00.000Z`),
      reading('resting_heart_rate', today, 58, `${today}T08:00:00.000Z`),
      reading('heart_rate_variability', today, 70)
    ];
    expect(biomarkerSeries(rows, 'resting_heart_rate', today).at(-1)).toEqual({ date: today, value: 58 });
  });
});

describe('summarizeBiomarker', () => {
  it('says there is no reading rather than inventing one', () => {
    const summary = summarizeBiomarker([], 'resting_heart_rate', today);
    expect(summary.latest).toBeNull();
    expect(summary.zone).toBe('neutral');
    expect(summary.status).toBe('No reading yet');
    expect(summary.confidence).toBe('low');
    expect(summary.reason_codes).toEqual(['resting_hr_no_data']);
  });

  it('calibrates until three other days exist, and makes no comparison meanwhile', () => {
    const summary = summarizeBiomarker(week('resting_heart_rate', [null, null, null, null, 58, 57, 70]), 'resting_heart_rate', today);
    expect(summary.latest).toEqual({ date: today, value: 70 });
    expect(summary.baseline).toBeNull();
    expect(summary.delta).toBeNull();
    expect(summary.zone).toBe('neutral');
    expect(summary.status).toBe('Calibrating to your usual');
    expect(summary.reason_codes).toContain('resting_hr_calibrating');
  });

  it('reads a resting heart rate at the usual level as optimal', () => {
    const summary = summarizeBiomarker(week('resting_heart_rate', [58, 57, 59, 58, 57, 58, 59]), 'resting_heart_rate', today);
    expect(summary.baseline).toBeCloseTo(57.8, 1);
    expect(summary.zone).toBe('optimal');
    expect(summary.status).toBe('Within your usual range');
    expect(summary.deltaLabel).toBe('+1 bpm vs usual');
    expect(summary.confidence).toBe('high');
  });

  it('flags a raised resting heart rate in two steps, and a lower one not at all', () => {
    const small = summarizeBiomarker(week('resting_heart_rate', [58, 58, 58, 58, 58, 58, 62]), 'resting_heart_rate', today);
    expect(small.zone).toBe('warning');
    expect(small.status).toBe('A little above your usual');
    const large = summarizeBiomarker(week('resting_heart_rate', [58, 58, 58, 58, 58, 58, 66]), 'resting_heart_rate', today);
    expect(large.zone).toBe('critical');
    expect(large.status).toBe('Well above your usual');
    const lower = summarizeBiomarker(week('resting_heart_rate', [58, 58, 58, 58, 58, 58, 50]), 'resting_heart_rate', today);
    expect(lower.zone).toBe('optimal');
  });

  it('compares HRV in percent and only minds a drop', () => {
    const drop = summarizeBiomarker(week('heart_rate_variability', [60, 60, 60, 60, 60, 60, 51]), 'heart_rate_variability', today);
    expect(drop.delta).toBe(-15);
    expect(drop.zone).toBe('warning');
    expect(drop.deltaLabel).toBe('−15% vs usual');
    expect(drop.status).toBe('A little below your usual');
    const rise = summarizeBiomarker(week('heart_rate_variability', [60, 60, 60, 60, 60, 60, 80]), 'heart_rate_variability', today);
    expect(rise.zone).toBe('optimal');
  });

  it('treats respiratory rate as best when steady, in either direction', () => {
    const up = summarizeBiomarker(week('respiratory_rate', [14, 14, 14, 14, 14, 14, 16.5]), 'respiratory_rate', today);
    expect(up.zone).toBe('critical');
    expect(up.status).toBe('Further off your usual');
    const down = summarizeBiomarker(week('respiratory_rate', [14, 14, 14, 14, 14, 14, 12.6]), 'respiratory_rate', today);
    expect(down.zone).toBe('warning');
    expect(down.deltaLabel).toBe('−1.4 br/min vs usual');
  });

  it('lowers confidence when the latest reading is not from today', () => {
    const summary = summarizeBiomarker(week('resting_heart_rate', [58, 57, 59, 58, 57, 58, null]), 'resting_heart_rate', today);
    expect(summary.latest?.date).toBe('2026-09-25');
    expect(summary.confidence).toBe('medium');
    expect(summary.reason_codes).toContain('resting_hr_latest_not_today');
  });

  it('never uses diagnosis-like language in what it says', () => {
    const forbidden = /diagnos|treat|cure|prescri|disease|illness|infection|abnormal|clinical|guarantee/i;
    for (const kind of BIOMARKER_KINDS) {
      for (const values of [[], [60, 60, 60, 60, 60, 60, 60], [60, 60, 60, 60, 60, 60, 75], [60, 60, 60, 60, 60, 60, 40]]) {
        const summary = summarizeBiomarker(week(kind, values.length ? values : [null]), kind, today);
        expect(summary.status).not.toMatch(forbidden);
        expect(summary.deltaLabel ?? '').not.toMatch(forbidden);
      }
    }
  });
});

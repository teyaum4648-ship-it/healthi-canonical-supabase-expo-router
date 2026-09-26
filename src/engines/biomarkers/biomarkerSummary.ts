import type { DataConfidence } from '../../types/common';

/** A reading's zone, which the screen draws as a green, yellow or red wash, or none. */
export type WellnessZone = 'optimal' | 'warning' | 'critical' | 'neutral';

/**
 * Overnight biomarkers a watch or ring reports: resting heart rate, heart rate
 * variability and respiratory rate.
 *
 * Healthi does not measure any of these. A reading arrives from a connected health app or
 * is typed in by the person from their own device, and each one is compared only with the
 * same person's recent average, never with a population norm. The comparison is general
 * wellness context: it flags a change worth noticing, not what caused it.
 */
export type BiomarkerKind = 'resting_heart_rate' | 'heart_rate_variability' | 'respiratory_rate';
export type BiomarkerSource = 'manual' | 'apple_health' | 'health_connect';

export type BiomarkerReading = {
  id: string;
  kind: BiomarkerKind;
  value: number;
  /** The local day the reading describes, YYYY-MM-DD: the morning after the night it covers. */
  date: string;
  recorded_at: string;
  source: BiomarkerSource;
};

type BiomarkerSpec = {
  label: string;
  shortLabel: string;
  unit: string;
  min: number;
  max: number;
  decimals: number;
  /** Which way a change reads as better. Respiratory rate is best when it holds steady. */
  better: 'lower' | 'higher' | 'steady';
  /** How far from the usual counts as a small change, then a larger one. */
  watch: number;
  attention: number;
  deltaMode: 'absolute' | 'percent';
};

export const BIOMARKER_SPECS: Record<BiomarkerKind, BiomarkerSpec> = {
  resting_heart_rate: {
    label: 'Resting heart rate', shortLabel: 'Resting HR', unit: 'bpm',
    min: 30, max: 120, decimals: 0, better: 'lower', watch: 3, attention: 7, deltaMode: 'absolute'
  },
  heart_rate_variability: {
    label: 'Heart rate variability', shortLabel: 'HRV', unit: 'ms',
    min: 5, max: 250, decimals: 0, better: 'higher', watch: 10, attention: 20, deltaMode: 'percent'
  },
  respiratory_rate: {
    label: 'Respiratory rate', shortLabel: 'Resp. rate', unit: 'br/min',
    min: 6, max: 30, decimals: 1, better: 'steady', watch: 1, attention: 2, deltaMode: 'absolute'
  }
};

export const BIOMARKER_KINDS: BiomarkerKind[] = ['heart_rate_variability', 'resting_heart_rate', 'respiratory_rate'];

/** Days of readings needed before a comparison is shown; until then the row says it is calibrating. */
export const BIOMARKER_BASELINE_MIN_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function shiftDay(date: string, days: number): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function formatBiomarkerValue(kind: BiomarkerKind, value: number): string {
  return value.toFixed(BIOMARKER_SPECS[kind].decimals);
}

/** A plausible reading for the kind, or a sentence saying what range is accepted. */
export function validateBiomarker(kind: BiomarkerKind, value: number): { ok: true } | { ok: false; error: string } {
  const spec = BIOMARKER_SPECS[kind];
  if (!Number.isFinite(value)) return { ok: false, error: `Enter a number for ${spec.label.toLowerCase()}.` };
  if (value < spec.min || value > spec.max) {
    return { ok: false, error: `${spec.label} is accepted between ${spec.min} and ${spec.max} ${spec.unit}.` };
  }
  return { ok: true };
}

export type BiomarkerDay = { date: string; value: number | null };

/** One value per day for the window ending on `endDate`, oldest first; the day's latest reading wins. */
export function biomarkerSeries(readings: BiomarkerReading[], kind: BiomarkerKind, endDate: string, days = 7): BiomarkerDay[] {
  const latestByDay = new Map<string, BiomarkerReading>();
  for (const reading of readings) {
    if (reading.kind !== kind || !Number.isFinite(reading.value)) continue;
    const current = latestByDay.get(reading.date);
    if (!current || reading.recorded_at > current.recorded_at) latestByDay.set(reading.date, reading);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = shiftDay(endDate, index - (days - 1));
    return { date, value: latestByDay.get(date)?.value ?? null };
  });
}

export type BiomarkerSummary = {
  kind: BiomarkerKind;
  label: string;
  unit: string;
  latest: { date: string; value: number } | null;
  /** The mean of the other days in the window, or null while calibrating. */
  baseline: number | null;
  /** Latest minus baseline, in the unit, or in percent for HRV. */
  delta: number | null;
  deltaLabel: string | null;
  zone: WellnessZone;
  status: string;
  confidence: DataConfidence;
  days_with_data: number;
  series: BiomarkerDay[];
  reason_codes: string[];
};

const kindCode: Record<BiomarkerKind, string> = {
  resting_heart_rate: 'resting_hr',
  heart_rate_variability: 'hrv',
  respiratory_rate: 'respiratory_rate'
};

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function statusFor(kind: BiomarkerKind, level: 'usual' | 'small' | 'large', direction: 'up' | 'down'): string {
  if (level === 'usual') return 'Within your usual range';
  const spec = BIOMARKER_SPECS[kind];
  const size = level === 'small' ? 'A little' : 'Well';
  if (spec.better === 'steady') return level === 'small' ? 'A little off your usual' : 'Further off your usual';
  return `${size} ${direction === 'up' ? 'above' : 'below'} your usual`;
}

/**
 * One value against a usual level: the difference in the measure's own terms (percent for
 * HRV), and how far that is in the direction that matters. A lower resting heart rate or
 * a higher HRV is never flagged; respiratory rate is flagged either way.
 */
export function compareToUsual(kind: BiomarkerKind, value: number, baseline: number): { delta: number; level: 'usual' | 'small' | 'large'; zone: WellnessZone } {
  const spec = BIOMARKER_SPECS[kind];
  const raw = spec.deltaMode === 'percent' ? ((value - baseline) / baseline) * 100 : value - baseline;
  /* Rounded the way the value itself is shown, so a row and a tile never disagree. */
  const delta = round(raw, spec.deltaMode === 'percent' ? 0 : spec.decimals);
  const magnitude = Math.abs(delta);
  const unwelcome = spec.better === 'steady' || (spec.better === 'lower' ? delta > 0 : delta < 0);
  const level = !unwelcome || magnitude < spec.watch ? 'usual' : magnitude < spec.attention ? 'small' : 'large';
  return { delta, level, zone: level === 'usual' ? 'optimal' : level === 'small' ? 'warning' : 'critical' };
}

/**
 * The latest reading against the person's own recent average.
 *
 * Missing days lower confidence and never count as a value. With fewer than three other
 * days to average, there is no comparison at all: the row shows the reading and says it
 * is calibrating, rather than judging it against a baseline of one or two nights.
 */
export function summarizeBiomarker(readings: BiomarkerReading[], kind: BiomarkerKind, today: string, days = 7): BiomarkerSummary {
  const spec = BIOMARKER_SPECS[kind];
  const code = kindCode[kind];
  const series = biomarkerSeries(readings, kind, today, days);
  const present = series.filter((day): day is { date: string; value: number } => day.value !== null);
  const base = { kind, label: spec.label, unit: spec.unit, series, days_with_data: present.length };

  if (!present.length) {
    return {
      ...base, latest: null, baseline: null, delta: null, deltaLabel: null, zone: 'neutral',
      status: 'No reading yet', confidence: 'low', reason_codes: [`${code}_no_data`]
    };
  }

  const latest = present[present.length - 1]!;
  const others = present.slice(0, -1).map((day) => day.value);
  const reasons: string[] = [];
  if (latest.date !== today) reasons.push(`${code}_latest_not_today`);

  if (others.length < BIOMARKER_BASELINE_MIN_DAYS) {
    return {
      ...base, latest, baseline: null, delta: null, deltaLabel: null, zone: 'neutral',
      status: 'Calibrating to your usual', confidence: 'low',
      reason_codes: [...reasons, `${code}_calibrating`]
    };
  }

  const baseline = round(mean(others), spec.decimals + 1);
  const { delta, level, zone } = compareToUsual(kind, latest.value, baseline);
  const magnitude = Math.abs(delta);
  const direction = delta >= 0 ? 'up' : 'down';
  reasons.push(level === 'usual' ? `${code}_within_usual` : level === 'small' ? `${code}_small_change` : `${code}_larger_change`);

  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  const deltaLabel = spec.deltaMode === 'percent'
    ? `${sign}${magnitude.toFixed(0)}% vs usual`
    : `${sign}${magnitude.toFixed(spec.decimals === 0 ? 0 : 1)} ${spec.unit} vs usual`;
  const confidence: DataConfidence = latest.date === today && others.length >= 5 ? 'high' : 'medium';

  return {
    ...base, latest, baseline, delta, deltaLabel, zone,
    status: statusFor(kind, level, direction), confidence, reason_codes: reasons
  };
}

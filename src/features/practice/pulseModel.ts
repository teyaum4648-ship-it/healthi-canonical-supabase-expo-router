import { createScopedLogStore, isRecord } from './scopedLogStore';

/**
 * Heart rate check-ins, and what a single reading is allowed to mean.
 *
 * A pulse count on its own says almost nothing. 72 is unremarkable for most people and
 * alarming for someone who normally sits at 52, so the only honest reading is a
 * comparison against the person's own history — which is the same argument the readiness
 * score rests on, applied to one number.
 *
 * Two deliberate constraints.
 *
 * **The baseline is built from resting readings only.** A count taken after climbing
 * stairs or after coffee is real data about that moment and useless as a reference point.
 * Those readings are still logged and still compared against the baseline; they just do
 * not get a vote in what "usual" means. This is the "assess, don't guess" rule: ask what
 * the person was doing, then use the answer, rather than averaging everything and calling
 * the mush a baseline.
 *
 * **Median and median-absolute-deviation, not mean and standard deviation.** One reading
 * taken while sprinting for a bus would drag a mean for weeks and inflate an SD enough to
 * make everything afterwards look "normal". The median barely moves and the MAD barely
 * widens, which is exactly the behaviour wanted from a baseline built out of whatever a
 * person happened to log.
 *
 * Nothing here is a medical assessment. It reports a number and its distance from that
 * person's own usual range, and it never names a cause.
 */

export type PulseContext = 'waking' | 'sitting' | 'after_moving' | 'after_caffeine' | 'wound_up';

/** How the number arrived, because a tapped count and a typed one are not equal. */
export type PulseMethod = 'counted' | 'entered';

export type PulseReading = {
  id: string;
  /** YYYY-MM-DD in local time. */
  date: string;
  bpm: number;
  context: PulseContext;
  method: PulseMethod;
  takenAt: string;
};

export const PULSE_CONTEXTS: Array<{
  id: PulseContext;
  label: string;
  /** Whether a reading in this state may inform the baseline. */
  resting: boolean;
  note: string;
}> = [
  {
    id: 'waking',
    label: 'Just woke up',
    resting: true,
    note: 'The steadiest reading you can take. Before sitting up, before your phone.'
  },
  {
    id: 'sitting',
    label: 'Sitting quietly',
    resting: true,
    note: 'Five minutes still, nothing in the last half hour. The everyday reference point.'
  },
  {
    id: 'after_moving',
    label: 'Just moved',
    resting: false,
    note: 'Stairs, a walk, standing up quickly. Logged, but kept out of your usual range.'
  },
  {
    id: 'after_caffeine',
    label: 'Had caffeine',
    resting: false,
    note: 'Caffeine lifts heart rate for hours. Worth recording, not worth averaging in.'
  },
  {
    id: 'wound_up',
    label: 'Wound up',
    resting: false,
    note: 'Mid-moment. This is the reading the comparison below is actually useful for.'
  }
];

/** Outside this range a manual count is far more likely a typo than a pulse. */
export const PULSE_MIN = 30;
export const PULSE_MAX = 220;

export function isPlausibleBpm(bpm: number): boolean {
  return Number.isFinite(bpm) && Number.isInteger(bpm) && bpm >= PULSE_MIN && bpm <= PULSE_MAX;
}

export function pulseContext(id: PulseContext) {
  return PULSE_CONTEXTS.find((entry) => entry.id === id) ?? PULSE_CONTEXTS[1];
}

export function isRestingContext(id: PulseContext): boolean {
  return pulseContext(id).resting;
}

/** The counting window offered in the UI. Fifteen seconds, times four. */
export const COUNT_WINDOW_SECONDS = 15;

export function bpmFromCount(beats: number, windowSeconds = COUNT_WINDOW_SECONDS): number {
  return Math.round((beats * 60) / windowSeconds);
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * How much a baseline has earned the right to be trusted.
 *
 * A thin baseline still gets used — refusing to say anything until a person has logged
 * fifteen readings is the "no score" failure the rest of the app avoids. It gets stated
 * as thin instead.
 */
export type PulseConfidence = 'thin' | 'building' | 'settled';

export type PulseBaseline = {
  median: number;
  /** Median absolute deviation, floored so identical readings do not imply zero spread. */
  spread: number;
  sampleSize: number;
  confidence: PulseConfidence;
};

/** Identical readings would otherwise make every later reading look extraordinary. */
const MIN_SPREAD = 2;

export function pulseBaseline(readings: PulseReading[]): PulseBaseline | null {
  const resting = readings.filter((reading) => isRestingContext(reading.context));
  if (resting.length === 0) return null;

  const values = resting.map((reading) => reading.bpm);
  const mid = median(values);
  const spread = Math.max(MIN_SPREAD, median(values.map((value) => Math.abs(value - mid))));

  return {
    median: Math.round(mid),
    spread: Math.round(spread),
    sampleSize: resting.length,
    confidence: resting.length >= 15 ? 'settled' : resting.length >= 5 ? 'building' : 'thin'
  };
}

export type PulseBand = 'well_below' | 'below' | 'typical' | 'above' | 'well_above';

export type PulseComparison = {
  band: PulseBand;
  /** Signed difference from the baseline median, in bpm. */
  delta: number;
  headline: string;
  detail: string;
};

export function comparePulse(bpm: number, baseline: PulseBaseline): PulseComparison {
  const delta = bpm - baseline.median;
  const magnitude = Math.abs(delta);

  const band: PulseBand = magnitude <= baseline.spread
    ? 'typical'
    : magnitude <= baseline.spread * 2
      ? (delta > 0 ? 'above' : 'below')
      : (delta > 0 ? 'well_above' : 'well_below');

  const away = `${magnitude} bpm ${delta > 0 ? 'above' : 'below'} your usual ${baseline.median}`;

  const headline = band === 'typical'
    ? 'In your usual range'
    : band === 'above'
      ? 'A little above your usual'
      : band === 'well_above'
        ? 'Well above your usual'
        : band === 'below'
          ? 'A little below your usual'
          : 'Well below your usual';

  /*
   * The detail names the arithmetic and stops. It does not say why, because a single
   * pulse count cannot distinguish a hard week from a cold coming on from a bad night,
   * and guessing between those is the line between a wellness reading and a diagnosis.
   */
  const detail = band === 'typical'
    ? `${bpm} bpm, within ${baseline.spread} of your usual ${baseline.median}.`
    : `${bpm} bpm — ${away}.`;

  const hedge = baseline.confidence === 'thin'
    ? ` Your usual range is still being built from ${baseline.sampleSize} ${baseline.sampleSize === 1 ? 'reading' : 'readings'}, so treat this loosely.`
    : '';

  return { band, delta, headline, detail: detail + hedge };
}

export type PulseDay = {
  readings: PulseReading[];
  latest: PulseReading | null;
};

export function summarisePulseDay(readings: PulseReading[], date: string): PulseDay {
  const today = readings
    .filter((reading) => reading.date === date)
    .sort((left, right) => left.takenAt.localeCompare(right.takenAt));
  return { readings: today, latest: today.length > 0 ? today[today.length - 1] : null };
}

function isReading(value: unknown): value is PulseReading {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.date === 'string'
    && typeof value.bpm === 'number'
    && typeof value.context === 'string'
    && typeof value.method === 'string'
    && typeof value.takenAt === 'string';
}

export const localPulseStore = createScopedLogStore<PulseReading>({
  key: 'healthi:practice:pulse:v1',
  isRow: isReading
});

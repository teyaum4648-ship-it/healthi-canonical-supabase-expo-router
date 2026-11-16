import type { CircadianBriefing, CircadianPhase, EnergyZoneLevel } from '../../engines/circadian';
import { wallClockMinute } from '../dashboard/dayThreadInput';
import { clock, threadRange } from '../dashboard/dayThreadModel';
import type { SleepProtocolItem } from './sleepPresentation';

/**
 * The 1c Sleep screen, as pure geometry and copy from the circadian briefing. Nothing here
 * estimates: every line, window and number is the engine's, placed on the screen.
 *
 * The design drew two threads (body clock and sleep pressure). The engine's energy model
 * is not a two-process model and does not expose those separately, so this draws the one
 * curve it does produce, in the same chart grammar as Today: solid where the day has been
 * lived, dotted where it is predicted, the person's usual range as a wash, scrubbable.
 */

export const SLEEP_CHART = { height: 190, top: 14, bottom: 26, padX: 0 } as const;

export type SleepChartPoint = { minute: number; energy: number; phase: CircadianPhase };

export type SleepChart = {
  startHour: number;
  endHour: number;
  width: number;
  /** The curve up to now (solid) and from now on (dotted), as "x,y" polylines. */
  lived: string | null;
  predicted: string | null;
  /** The area under the whole curve, for the wash. */
  area: string | null;
  /** The person's usual range, as a band between two y values. */
  usual: { top: number; bottom: number } | null;
  nowX: number | null;
  hourLabels: { x: number; label: string }[];
  baselineY: number;
};

export function chartPoints(briefing: Pick<CircadianBriefing, 'date' | 'energy_curve'>): SleepChartPoint[] {
  const day = briefing.date.slice(0, 10);
  return briefing.energy_curve
    .map((point) => ({ minute: wallClockMinute(point.time, day), energy: point.estimated_energy, phase: point.label as CircadianPhase }))
    .filter((point): point is SleepChartPoint => point.minute !== null && Number.isFinite(point.energy))
    .sort((a, b) => a.minute - b.minute);
}

function energyAt(points: SleepChartPoint[], minute: number): number | null {
  if (points.length === 0 || minute < points[0]!.minute || minute > points[points.length - 1]!.minute) return null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    if (minute >= a.minute && minute <= b.minute) {
      const span = b.minute - a.minute;
      return span <= 0 ? a.energy : a.energy + ((b.energy - a.energy) * (minute - a.minute)) / span;
    }
  }
  return points[points.length - 1]!.energy;
}

function phaseAt(points: SleepChartPoint[], minute: number): CircadianPhase {
  let best = points[0];
  for (const point of points) if (point.minute <= minute) best = point;
  return best?.phase ?? 'unknown';
}

export function buildSleepChart(input: {
  briefing: Pick<CircadianBriefing, 'date' | 'energy_curve' | 'wake_time' | 'target_bedtime' | 'typical_band'>;
  nowMinute: number;
  width: number;
}): SleepChart {
  const day = input.briefing.date.slice(0, 10);
  const { startHour, endHour } = threadRange(wallClockMinute(input.briefing.wake_time, day), wallClockMinute(input.briefing.target_bedtime, day));
  const start = startHour * 60;
  const span = (endHour - startHour) * 60;
  const plotHeight = SLEEP_CHART.height - SLEEP_CHART.top - SLEEP_CHART.bottom;
  const baselineY = SLEEP_CHART.top + plotHeight;
  const x = (minute: number) => SLEEP_CHART.padX + ((minute - start) / span) * (input.width - SLEEP_CHART.padX * 2);
  const y = (energy: number) => SLEEP_CHART.top + (1 - Math.min(100, Math.max(0, energy)) / 100) * plotHeight;
  const points = chartPoints(input.briefing);

  const hourLabels: SleepChart['hourLabels'] = [];
  for (let hour = startHour; hour <= endHour; hour += 3) hourLabels.push({ x: x(hour * 60), label: hour === 24 ? '24' : String(hour % 24).padStart(2, '0') });

  const band = input.briefing.typical_band;
  const usual = band ? { top: y(band.high), bottom: y(band.low) } : null;
  const nowVisible = input.nowMinute >= start && input.nowMinute <= endHour * 60;

  if (points.length < 2 || input.width <= 0) {
    return { startHour, endHour, width: input.width, lived: null, predicted: null, area: null, usual, nowX: nowVisible ? x(input.nowMinute) : null, hourLabels, baselineY };
  }

  const coords = points.map((point) => `${x(point.minute).toFixed(1)},${y(point.energy).toFixed(1)}`);
  const nowEnergy = energyAt(points, input.nowMinute);
  const nowCoord = nowEnergy === null ? null : `${x(input.nowMinute).toFixed(1)},${y(nowEnergy).toFixed(1)}`;
  const before = points.filter((point) => point.minute < input.nowMinute).map((point) => `${x(point.minute).toFixed(1)},${y(point.energy).toFixed(1)}`);
  const after = points.filter((point) => point.minute > input.nowMinute).map((point) => `${x(point.minute).toFixed(1)},${y(point.energy).toFixed(1)}`);
  const livedPoints = nowCoord ? [...before, nowCoord] : input.nowMinute > points[points.length - 1]!.minute ? coords : [];
  const predictedPoints = nowCoord ? [nowCoord, ...after] : input.nowMinute < points[0]!.minute ? coords : [];
  const first = points[0]!;
  const last = points[points.length - 1]!;

  return {
    startHour,
    endHour,
    width: input.width,
    lived: livedPoints.length >= 2 ? livedPoints.join(' ') : null,
    predicted: predictedPoints.length >= 2 ? predictedPoints.join(' ') : null,
    area: `M${x(first.minute).toFixed(1)},${baselineY} L${coords.join(' L')} L${x(last.minute).toFixed(1)},${baselineY} Z`,
    usual,
    nowX: nowVisible ? x(input.nowMinute) : null,
    hourLabels,
    baselineY
  };
}

const LEVEL_WORDS: Record<EnergyZoneLevel, string> = { high: 'High', moderate: 'Moderate', low: 'Low' };

export type SleepReading = { minute: number; time: string; phase: CircadianPhase; energy: number; level: string | null; x: number; y: number };

/** What the chart reads at a minute: the time, the phase, the engine's energy and its window. Null off the curve. */
export function readSleepChart(
  briefing: Pick<CircadianBriefing, 'date' | 'energy_curve' | 'energy_zones' | 'wake_time' | 'target_bedtime'>,
  minute: number,
  width: number
): SleepReading | null {
  const day = briefing.date.slice(0, 10);
  const points = chartPoints(briefing);
  if (points.length < 2) return null;
  const at = Math.min(points[points.length - 1]!.minute, Math.max(points[0]!.minute, Math.round(minute / 5) * 5));
  const energy = energyAt(points, at);
  if (energy === null) return null;
  const { startHour, endHour } = threadRange(wallClockMinute(briefing.wake_time, day), wallClockMinute(briefing.target_bedtime, day));
  const plotHeight = SLEEP_CHART.height - SLEEP_CHART.top - SLEEP_CHART.bottom;
  const zone = briefing.energy_zones.find((candidate) => {
    const from = wallClockMinute(candidate.start_at, day);
    const to = wallClockMinute(candidate.end_at, day);
    return from !== null && to !== null && at >= from && at < to;
  });
  return {
    minute: at,
    time: clock(at),
    phase: phaseAt(points, at),
    energy,
    level: zone ? LEVEL_WORDS[zone.level] : null,
    x: ((at - startHour * 60) / ((endHour - startHour) * 60)) * width,
    y: SLEEP_CHART.top + (1 - Math.min(100, Math.max(0, energy)) / 100) * plotHeight
  };
}

/** The minute a horizontal offset across the chart stands for. */
export function minuteAtX(briefing: Pick<CircadianBriefing, 'date' | 'wake_time' | 'target_bedtime'>, offsetX: number, width: number): number {
  const day = briefing.date.slice(0, 10);
  const { startHour, endHour } = threadRange(wallClockMinute(briefing.wake_time, day), wallClockMinute(briefing.target_bedtime, day));
  const ratio = width > 0 ? Math.min(1, Math.max(0, offsetX / width)) : 0;
  return startHour * 60 + ratio * (endHour - startHour) * 60;
}

export type RhythmSegment = { level: EnergyZoneLevel | 'wind_down'; share: number };
export type RhythmRow = { id: string; level: EnergyZoneLevel | 'wind_down'; name: string; range: string; fit: string | null };

/**
 * "Today's rhythm": the day's energy windows as a composition bar (design language P10) and
 * the high and low windows plus wind-down as rows. Each row's fit text is the engine's own
 * reason for the protocol step that falls in that window.
 */
export function buildRhythm(
  briefing: Pick<CircadianBriefing, 'date' | 'energy_curve' | 'energy_zones' | 'rhythm_plan' | 'target_bedtime'>,
  protocol: SleepProtocolItem[],
  phaseName: (phase: CircadianPhase) => string
): { segments: RhythmSegment[]; rows: RhythmRow[] } {
  const day = briefing.date.slice(0, 10);
  const points = chartPoints(briefing);
  const zones = briefing.energy_zones
    .map((zone) => ({ level: zone.level, start: wallClockMinute(zone.start_at, day), end: wallClockMinute(zone.end_at, day) }))
    .filter((zone): zone is { level: EnergyZoneLevel; start: number; end: number } => zone.start !== null && zone.end !== null && zone.end > zone.start);
  const windDownStart = wallClockMinute(briefing.rhythm_plan.wind_down_start, day);
  const bed = wallClockMinute(briefing.target_bedtime ?? briefing.rhythm_plan.target_bedtime, day);

  const spans: { level: RhythmSegment['level']; start: number; end: number }[] = zones.map((zone) => ({ ...zone }));
  if (windDownStart !== null && bed !== null && bed > windDownStart) {
    for (const span of spans) span.end = Math.min(span.end, windDownStart);
    spans.push({ level: 'wind_down', start: windDownStart, end: bed });
  }
  const kept = spans.filter((span) => span.end > span.start);
  const total = kept.reduce((sum, span) => sum + (span.end - span.start), 0);
  const segments = total > 0 ? kept.map((span) => ({ level: span.level, share: (span.end - span.start) / total })) : [];

  const items = protocol.map((item) => ({ item, start: wallClockMinute(item.start_at, day), end: wallClockMinute(item.end_at, day) }));
  const fitFor = (start: number, end: number, ids: SleepProtocolItem['id'][]) => {
    const match = items.find((entry) => ids.includes(entry.item.id) && entry.start !== null && entry.start < end && (entry.end ?? entry.start + 1) > start);
    return match ? match.item.reason : null;
  };

  const rows: RhythmRow[] = zones
    .filter((zone) => zone.level !== 'moderate' && (windDownStart === null || zone.start < windDownStart))
    .map((zone, index) => {
      const end = windDownStart !== null ? Math.min(zone.end, windDownStart) : zone.end;
      const middle = zone.start + (end - zone.start) / 2;
      return {
        id: `${zone.level}-${index}`,
        level: zone.level,
        name: points.length ? phaseName(phaseAt(points, middle)) : zone.level === 'high' ? 'Higher energy' : 'Lower energy',
        range: `${clock(zone.start)}–${clock(end)}`,
        fit: zone.level === 'high' ? fitFor(zone.start, end, ['focus', 'movement']) : fitFor(zone.start, end, ['reset', 'light'])
      };
    });
  if (windDownStart !== null && bed !== null && bed > windDownStart) {
    rows.push({ id: 'wind-down', level: 'wind_down', name: 'Wind-down', range: `${clock(windDownStart)}–${clock(bed)}`, fit: fitFor(windDownStart, bed, ['wind_down', 'dim_light']) });
  }
  return { segments, rows };
}

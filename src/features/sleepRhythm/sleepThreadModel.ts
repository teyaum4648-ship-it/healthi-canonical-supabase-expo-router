import type { CircadianBriefing, CircadianPhase, EnergyZoneLevel } from '../../engines/circadian';
import { wallClockMinute } from '../dashboard/dayThreadInput';
import { formatClockRange } from '../../utils/clockFormat';
import type { SleepProtocolItem } from './sleepPresentation';

/**
 * The 1c Sleep screen's "Today's rhythm", as pure copy from the circadian briefing. Nothing
 * here estimates: every window and time is the engine's, placed on the screen. The charts
 * live in SleepEnergyChart (the energy forecast) and twoProcessModel (body clock and sleep
 * pressure).
 */

export type SleepChartPoint = { minute: number; energy: number; phase: CircadianPhase };

export function chartPoints(briefing: Pick<CircadianBriefing, 'date' | 'energy_curve'>): SleepChartPoint[] {
  const day = briefing.date.slice(0, 10);
  return briefing.energy_curve
    .map((point) => ({ minute: wallClockMinute(point.time, day), energy: point.estimated_energy, phase: point.label as CircadianPhase }))
    .filter((point): point is SleepChartPoint => point.minute !== null && Number.isFinite(point.energy))
    .sort((a, b) => a.minute - b.minute);
}

function phaseAt(points: SleepChartPoint[], minute: number): CircadianPhase {
  let best = points[0];
  for (const point of points) if (point.minute <= minute) best = point;
  return best?.phase ?? 'unknown';
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
        range: formatClockRange(zone.start, end),
        fit: zone.level === 'high' ? fitFor(zone.start, end, ['focus', 'movement']) : fitFor(zone.start, end, ['reset', 'light'])
      };
    });
  if (windDownStart !== null && bed !== null && bed > windDownStart) {
    rows.push({ id: 'wind-down', level: 'wind_down', name: 'Wind-down', range: formatClockRange(windDownStart, bed), fit: fitFor(windDownStart, bed, ['wind_down', 'dim_light']) });
  }
  return { segments, rows };
}

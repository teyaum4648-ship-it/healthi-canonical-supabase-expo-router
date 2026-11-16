import { strand } from '../../styles/daywoven1c';

import { formatClock, formatClockCompact } from '../../utils/clockFormat';
/**
 * The geometry of "Your day", the energy strand on Today (docs/design/1c/HANDOFF.md, Phase 1
 * section 6). Pure and deterministic: every position comes from the inputs, nothing is
 * estimated here. Times are minutes from the start of today on the local wall clock, so
 * 06:40 is 400 and 00:30 tomorrow is 1470.
 *
 * - The column runs from the hour of waking (floored) to the hour after bedtime, or
 *   06:00 to 24:00 when either is unknown. One hour is `strand.hourHeight` points.
 * - The energy area is drawn only where the engine gave a curve. No curve, no area.
 * - Above now: only things that were logged or measured. Below now: only the plan.
 * - A planned block that falls inside a high-energy window is drawn as a wash card that
 *   spans its real duration. Other planned items are a hollow dot and a line of text.
 * - Rows never overlap: each keeps at least ROW_GAP from the one before, and rows are
 *   kept clear of the "Now" pill.
 */

export type EnergyLevel = 'high' | 'moderate' | 'low';

export type DayThreadInput = {
  wakeMinute: number | null;
  bedMinute: number | null;
  nowMinute: number;
  curve: { minute: number; energy: number }[];
  zones: { start: number; end: number; level: EnergyLevel }[];
  logged: { id: string; minute: number; label: string }[];
  /** `listOnly` items keep their real end (so one in progress stays visible) but are never drawn to scale. */
  planned: { id: string; start: number; end?: number | null; title: string; detail?: string | null; listOnly?: boolean }[];
};

export type DayThreadRow =
  | { kind: 'log'; id: string; top: number; height: number; time: string; label: string }
  | { kind: 'plan'; id: string; top: number; height: number; title: string; detail: string | null }
  /** `contentTop` is set when the block is under way: its text starts below the now line, as in the design. */
  | { kind: 'block'; id: string; top: number; height: number; title: string; detail: string | null; detailInside: boolean; contentTop: number | null }
  | { kind: 'note'; id: string; top: number; height: number; text: string };

export type DayThreadScrub = { minute: number; y: number; x: number; time: string; level: string | null };

export type DayThreadModel = {
  startHour: number;
  endHour: number;
  height: number;
  hourLabels: { y: number; label: string }[];
  area: { path: string; predictedLine: string | null; livedHeight: number } | null;
  now: { y: number; label: string } | null;
  rows: DayThreadRow[];
  summary: string;
};

/** Minimum space between two rows, so text never touches. 18pt rows land 22pt apart. */
export const ROW_GAP = 4;
const LOG_HEIGHT = 18;
/** Title (20) plus up to two lines of the engine's reason (2 × 17). */
const PLAN_HEIGHT = 54;
const PLAN_HEIGHT_SINGLE = 20;
const BLOCK_MIN = 36;
const BLOCK_DETAIL_INSIDE = 60;
/** A block longer than this is listed rather than drawn to scale, so one long window can't push the rest of the day off the column. */
const BLOCK_MAX_MINUTES = 180;
const NOTE_HEIGHT = 34;
const NOW_BAND = 11;


/** "6:40 AM", "2:05 PM", and "12:30 AM" for half past midnight tomorrow. */
/** A clock label for the strand: "2:30 PM". The one shared 12-hour formatter, by another name. */
export function clock(minute: number): string {
  return formatClock(minute);
}

export function threadRange(wakeMinute: number | null, bedMinute: number | null): { startHour: number; endHour: number } {
  if (wakeMinute === null || bedMinute === null || !Number.isFinite(wakeMinute) || !Number.isFinite(bedMinute) || bedMinute <= wakeMinute) {
    return { startHour: 6, endHour: 24 };
  }
  const startHour = Math.max(0, Math.floor(wakeMinute / 60));
  const endHour = Math.min(startHour + 30, Math.floor(bedMinute / 60) + 1);
  return { startHour, endHour };
}

export function energyX(energy: number): number {
  return strand.minX + (Math.min(100, Math.max(0, energy)) / 100) * strand.spanX;
}

/** Linear between samples; null outside the curve, because nothing there was estimated. */
export function energyAt(curve: DayThreadInput['curve'], minute: number): number | null {
  if (curve.length === 0) return null;
  if (minute < curve[0]!.minute || minute > curve[curve.length - 1]!.minute) return null;
  for (let index = 0; index < curve.length - 1; index += 1) {
    const a = curve[index]!;
    const b = curve[index + 1]!;
    if (minute >= a.minute && minute <= b.minute) {
      const span = b.minute - a.minute;
      return span <= 0 ? a.energy : a.energy + ((b.energy - a.energy) * (minute - a.minute)) / span;
    }
  }
  return curve[curve.length - 1]!.energy;
}

const LEVEL_NAMES: Record<EnergyLevel, string> = { high: 'High', moderate: 'Moderate', low: 'Low' };

export function levelAt(zones: DayThreadInput['zones'], minute: number): string | null {
  const zone = zones.find((item) => minute >= item.start && minute < item.end) ?? zones.find((item) => minute === item.end);
  return zone ? LEVEL_NAMES[zone.level] : null;
}

function overlapsHigh(zones: DayThreadInput['zones'], start: number, end: number): boolean {
  return zones.some((zone) => zone.level === 'high' && start < zone.end && end > zone.start);
}

export function buildDayThread(input: DayThreadInput): DayThreadModel {
  const { startHour, endHour } = threadRange(input.wakeMinute, input.bedMinute);
  const origin = startHour * 60;
  const gridHeight = (endHour - startHour) * strand.hourHeight;
  const y = (minute: number) => ((minute - origin) / 60) * strand.hourHeight;
  const now = input.nowMinute;
  const nowVisible = now >= origin && now <= endHour * 60;
  const nowY = y(now);

  const curve = [...input.curve].filter((point) => Number.isFinite(point.minute) && Number.isFinite(point.energy)).sort((a, b) => a.minute - b.minute);
  let area: DayThreadModel['area'] = null;
  if (curve.length >= 2) {
    const points = curve.map((point) => [energyX(point.energy), y(point.minute)] as const);
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const path = `M0 ${first[1].toFixed(1)} ${points.map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')} L0 ${last[1].toFixed(1)} Z`;
    const nowEnergy = energyAt(curve, now);
    const ahead = curve.filter((point) => point.minute > now).map((point) => [energyX(point.energy), y(point.minute)] as const);
    const predicted = nowEnergy === null ? (now < curve[0]!.minute ? points : []) : [[energyX(nowEnergy), nowY] as const, ...ahead];
    area = {
      path,
      predictedLine: predicted.length >= 2 ? predicted.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ') : null,
      livedHeight: Math.min(gridHeight, Math.max(0, nowY))
    };
  }

  const hourLabels: DayThreadModel['hourLabels'] = [];
  for (let hour = startHour; hour <= endHour; hour += 3) hourLabels.push({ y: y(hour * 60), label: formatClockCompact(hour * 60) });

  const bandTop = nowVisible ? nowY - NOW_BAND : Infinity;
  const bandBottom = nowVisible ? nowY + NOW_BAND : -Infinity;

  /* Above now, laid out from the latest upward so the newest row sits just over the now pill. */
  const logged = input.logged
    .filter((item) => item.minute <= now && Number.isFinite(item.minute))
    .sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
  const above: DayThreadRow[] = [];
  let limit = bandTop - ROW_GAP / 2;
  for (let index = logged.length - 1; index >= 0; index -= 1) {
    const item = logged[index]!;
    const top = Math.min(y(item.minute) - LOG_HEIGHT / 2, limit - LOG_HEIGHT);
    above.unshift({ kind: 'log', id: item.id, top, height: LOG_HEIGHT, time: clock(item.minute), label: item.label });
    limit = top - ROW_GAP;
  }
  /* A crowded morning can run past the top; push down again, keeping the gaps. */
  let bottom = -Infinity;
  for (const row of above) {
    row.top = Math.max(row.top, bottom + ROW_GAP, 0);
    bottom = row.top + row.height;
  }
  const aboveBottom = above.length ? bottom : -Infinity;

  /* Below now: the plan, in order, each pushed clear of the row before it. */
  const planned = input.planned
    .filter((item) => Number.isFinite(item.start) && (item.end ?? item.start) > now)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const below: DayThreadRow[] = [];
  bottom = aboveBottom;
  for (const item of planned) {
    const end = item.end ?? null;
    const duration = end === null ? 0 : end - item.start;
    const asBlock = !item.listOnly && end !== null && duration > 0 && duration <= BLOCK_MAX_MINUTES && overlapsHigh(input.zones, item.start, end);
    if (asBlock) {
      const top = Math.max(y(item.start), bottom + ROW_GAP);
      let height = Math.max(BLOCK_MIN, y(end) - top);
      /* Under way: keep the title clear of the now line and pill, and give the text the room it needs. */
      const underWay = nowVisible && top < nowY + NOW_BAND && top + height > nowY - NOW_BAND;
      const contentTop = underWay ? Math.max(0, nowY - top) + NOW_BAND + 2 : null;
      if (contentTop !== null) height = Math.max(height, contentTop + PLAN_HEIGHT_SINGLE + (item.detail ? 2 * 17 + 2 : 0) + 10);
      const detailInside = contentTop !== null || height >= BLOCK_DETAIL_INSIDE;
      below.push({ kind: 'block', id: item.id, top, height, title: item.title, detail: item.detail ?? null, detailInside, contentTop });
      bottom = top + height;
      if (!detailInside && item.detail) {
        below.push({ kind: 'note', id: `${item.id}-note`, top: bottom + 5, height: NOTE_HEIGHT, text: item.detail });
        bottom = bottom + 5 + NOTE_HEIGHT;
      }
      continue;
    }
    const height = item.detail ? PLAN_HEIGHT : PLAN_HEIGHT_SINGLE;
    let top = Math.max(y(item.start) - PLAN_HEIGHT_SINGLE / 2, bottom + ROW_GAP);
    if (top < bandBottom && top + height > bandTop) top = bandBottom + ROW_GAP / 2;
    below.push({ kind: 'plan', id: item.id, top, height, title: item.title, detail: item.detail ?? null });
    bottom = top + height;
  }

  const rows = [...above, ...below];
  const contentBottom = rows.reduce((max, row) => Math.max(max, row.top + row.height), 0);
  const height = Math.max(gridHeight, contentBottom + 8);

  const zoneText = input.zones.length
    ? `Estimated energy ${input.zones.map((zone) => `${LEVEL_NAMES[zone.level].toLowerCase()} ${clock(zone.start)} to ${clock(zone.end)}`).join(', ')}.`
    : 'No energy estimate yet.';
  const summary = `Your day. ${zoneText} ${logged.length} logged so far, ${planned.length} planned.`;

  return {
    startHour,
    endHour,
    height,
    hourLabels,
    area,
    now: nowVisible ? { y: nowY, label: `Now ${clock(Math.floor(now))}` } : null,
    rows,
    summary
  };
}

/** What the scrub reads at a point down the column, snapped to 5 minutes and kept on the curve. */
export function scrubAt(input: Pick<DayThreadInput, 'curve' | 'zones'>, startHour: number, offsetY: number): DayThreadScrub | null {
  const curve = [...input.curve].sort((a, b) => a.minute - b.minute);
  if (curve.length < 2) return null;
  const raw = startHour * 60 + (offsetY / strand.hourHeight) * 60;
  const minute = Math.min(curve[curve.length - 1]!.minute, Math.max(curve[0]!.minute, Math.round(raw / 5) * 5));
  const energy = energyAt(curve, minute);
  if (energy === null) return null;
  return {
    minute,
    y: ((minute - startHour * 60) / 60) * strand.hourHeight,
    x: energyX(energy),
    time: clock(minute),
    level: levelAt(input.zones, minute)
  };
}

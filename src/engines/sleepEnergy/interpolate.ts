/** [input, output] pairs, input ascending. */
export type Anchors = readonly (readonly [number, number])[];

/**
 * Piecewise-linear lookup: every score table in this model is a list of anchor points
 * read through this one function, so a table can be checked by reading it rather than by
 * tracing a chain of branches. Outside the table the nearest end is held.
 */
export function interpolate(x: number, anchors: Anchors): number {
  if (!anchors.length) throw new Error('interpolate needs at least one anchor');
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [x1, y1] = anchors[index]!;
    const [x0, y0] = anchors[index - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

export function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MINUTE_MS;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Whole days from `earlier` to `later`, by UTC calendar day. */
export function calendarDaysBetween(earlier: Date, later: Date): number {
  const day = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((day(later) - day(earlier)) / DAY_MS);
}

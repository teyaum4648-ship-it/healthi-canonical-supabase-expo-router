import type { DataConfidence } from '../../types/common';
import { LOAD_AREAS, LOAD_ITEMS, type LoadArea, type LoadPoints } from './loadCheckItems';

/**
 * Turning load-check answers into a starting point for readiness.
 *
 * Load is read per area and banded, never totalled across areas: a heavy week at work and
 * a light diet are two facts, not an average. The areas then become capacity — the
 * inversion is explicit, `capacity = 1 − burden`, because load is a deficit and readiness
 * is a capacity, and that is the easiest sign error in the design.
 *
 * Observation outranks self-report. Where the logs answer a question, the logged answer
 * is used and the reported one is kept only as a fallback, and the result says which.
 *
 * Unanswered questions lower confidence and never the result: an area is scored from what
 * was answered in it, and an area with too little answered is left out rather than filled.
 */

export type LoadBand = 'light' | 'moderate' | 'heavy';
export type LoadAnswers = Partial<Record<string, LoadPoints>>;
export type ObservedLoadAnswer = { points: LoadPoints; basis: string };
export type ObservedLoadAnswers = Partial<Record<string, ObservedLoadAnswer>>;

export type LoadAreaResult = {
  area: LoadArea;
  title: string;
  /** 0–1 share of the area's possible load, or null when too little was answered. */
  burden: number | null;
  band: LoadBand | null;
  answered: number;
  total: number;
  observed: number;
};

export type LoadCheckResult = {
  areas: LoadAreaResult[];
  /** 0–1, where 1 is no load at all. Null when fewer than three areas could be read. */
  capacity: number | null;
  /** Where readiness starts each day, or null when the check is too incomplete to say. */
  baseline: number | null;
  confidence: DataConfidence;
  flags: Array<{ itemId: string; message: string }>;
  answered: number;
  total: number;
  reason_codes: string[];
};

/**
 * Where load stops being light and starts being heavy, as shares of each area's maximum.
 * These keep the proportions of the published cut points the method uses, carried over
 * as shares because the items themselves are our own.
 */
export const LOAD_BAND_EDGES: Record<LoadArea, readonly [number, number]> = {
  rhythm: [0.33, 0.56],
  food_quality: [0.15, 0.31],
  food_timing: [0.2, 0.4],
  digestion: [0.24, 0.48],
  life_load: [0.24, 0.5],
  exposures: [0.23, 0.45]
};

/** How the areas fold into the readiness foundations they feed. */
const DOMAIN_AREAS: ReadonlyArray<ReadonlyArray<readonly [LoadArea, number]>> = [
  [['rhythm', 1]],
  [['food_quality', 0.4], ['food_timing', 0.25], ['digestion', 0.35]],
  [['life_load', 0.7], ['exposures', 0.3]]
];

/** Readiness starts between these, from heaviest load to none. */
export const LOAD_BASELINE_RANGE = [50, 85] as const;
const MIN_AREAS = 3;

function bandFor(area: LoadArea, burden: number): LoadBand {
  const [moderate, heavy] = LOAD_BAND_EDGES[area];
  if (burden >= heavy) return 'heavy';
  if (burden >= moderate) return 'moderate';
  return 'light';
}

export function scoreLoadCheck(answers: LoadAnswers, observed: ObservedLoadAnswers = {}): LoadCheckResult {
  const points = (itemId: string): LoadPoints | null => observed[itemId]?.points ?? answers[itemId] ?? null;

  const areas: LoadAreaResult[] = LOAD_AREAS.map(({ id, title }) => {
    const items = LOAD_ITEMS.filter((item) => item.area === id);
    const known = items.map((item) => points(item.id)).filter((value): value is LoadPoints => value !== null);
    const enough = known.length * 2 >= items.length;
    const burden = enough ? known.reduce((sum: number, value) => sum + value, 0) / (3 * known.length) : null;
    return {
      area: id,
      title,
      burden: burden === null ? null : Math.round(burden * 100) / 100,
      band: burden === null ? null : bandFor(id, burden),
      answered: known.length,
      total: items.length,
      observed: items.filter((item) => observed[item.id]).length
    };
  });

  const byArea = new Map(areas.map((area) => [area.area, area]));
  const capacities = DOMAIN_AREAS.map((parts) => {
    const read = parts.filter(([area]) => byArea.get(area)?.burden !== null && byArea.get(area)?.burden !== undefined);
    const weight = read.reduce((sum, [, share]) => sum + share, 0);
    if (!read.length || weight <= 0) return null;
    return 1 - read.reduce((sum, [area, share]) => sum + (byArea.get(area)!.burden as number) * share, 0) / weight;
  }).filter((value): value is number => value !== null);

  const readAreas = areas.filter((area) => area.burden !== null).length;
  const capacity = readAreas >= MIN_AREAS && capacities.length
    ? Math.round((capacities.reduce((sum, value) => sum + value, 0) / capacities.length) * 100) / 100
    : null;
  const [low, high] = LOAD_BASELINE_RANGE;
  const baseline = capacity === null ? null : Math.round(low + (high - low) * capacity);

  const answered = LOAD_ITEMS.filter((item) => points(item.id) !== null).length;
  const observedCount = LOAD_ITEMS.filter((item) => observed[item.id]).length;
  const share = answered / LOAD_ITEMS.length;
  const confidence: DataConfidence = capacity === null || share < 0.6
    ? 'low'
    : share >= 0.85 && observedCount >= 2 ? 'high' : 'medium';

  const flags = LOAD_ITEMS
    .filter((item) => item.flag && (points(item.id) ?? -1) >= item.flag.minPoints)
    .map((item) => ({ itemId: item.id, message: item.flag!.message }));

  const reason_codes = [
    ...(baseline === null ? ['load_check_incomplete'] : ['baseline_from_load_check']),
    ...areas.filter((area) => area.band).map((area) => `load_${area.area}_${area.band}`),
    ...(observedCount > 0 ? ['load_check_observed_answers'] : []),
    ...(flags.length ? ['professional_check_suggested'] : [])
  ];

  return { areas, capacity, baseline, confidence, flags, answered, total: LOAD_ITEMS.length, reason_codes };
}

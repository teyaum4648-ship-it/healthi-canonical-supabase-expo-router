/**
 * How today's logged water compares with what would be expected by now.
 *
 * The target is spread evenly across the waking day, from wake time to bedtime, so a
 * glass at 8 a.m. is not measured against the whole day's water. Early in the day there
 * is too little day to pace against and the answer is null, which readiness reads as
 * "water was logged" without a judgement either way.
 */

/** The general daily baseline the onboarding uses when nothing more specific is known. */
export const DEFAULT_WATER_TARGET_ML = 2600;
const MIN_DAY_FRACTION = 0.15;

export function waterPace(params: {
  mlToday: number;
  targetMl?: number | null;
  /** Minutes after local midnight; 07:00 and 23:00 when unknown. */
  wakeMinute?: number | null;
  bedMinute?: number | null;
  nowMinute: number;
}): number | null {
  const target = params.targetMl && params.targetMl > 0 ? params.targetMl : DEFAULT_WATER_TARGET_ML;
  if (!(params.mlToday > 0)) return null;
  const wake = params.wakeMinute ?? 7 * 60;
  let bed = params.bedMinute ?? 23 * 60;
  if (bed <= wake) bed += 24 * 60;
  let now = params.nowMinute;
  if (now < wake && bed > 24 * 60) now += 24 * 60;
  const fraction = Math.max(0, Math.min(1, (now - wake) / (bed - wake)));
  if (fraction < MIN_DAY_FRACTION) return null;
  return Math.round((params.mlToday / (target * fraction)) * 100) / 100;
}

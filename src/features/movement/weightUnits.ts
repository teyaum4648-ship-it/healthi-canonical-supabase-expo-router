/**
 * Weight units for logged training.
 *
 * Sets record the unit they were entered in, so a logged number is never
 * dimensionless. Sets logged before units existed carry no unit and are
 * displayed without one rather than being assumed into pounds.
 */

export type WeightUnit = 'lb' | 'kg';

export const WEIGHT_UNITS: readonly WeightUnit[] = ['lb', 'kg'];
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'lb';

const LB_PER_KG = 2.2046226218;

/** Plate-pair increments: the smallest change most gyms can actually make. */
const STEPS: Record<WeightUnit, { coarse: number; fine: number }> = {
  lb: { coarse: 5, fine: 2.5 },
  kg: { coarse: 2.5, fine: 1.25 }
};

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'lb' || value === 'kg';
}

export function weightStep(unit: WeightUnit, grain: 'coarse' | 'fine' = 'coarse'): number {
  return STEPS[unit][grain];
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (!Number.isFinite(value)) return value;
  if (from === to) return value;
  return from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG;
}

/** Trim floating-point noise without pretending to more precision than a gym scale has. */
function tidy(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Convert for display beside a value entered in another unit. Rounded to the
 * target unit's fine increment, because "61.23 kg" reads as false precision
 * next to a bar someone loaded in pounds.
 */
export function convertWeightForDisplay(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return tidy(value);
  const step = weightStep(to, 'fine');
  return tidy(Math.round(convertWeight(value, from, to) / step) * step);
}

/** Step a weight by the unit's increment, snapping a stray value onto the grid. */
export function stepWeight(value: number | null, unit: WeightUnit, direction: 1 | -1): number {
  const step = weightStep(unit);
  if (value === null || !Number.isFinite(value)) return direction > 0 ? step : 0;
  const snapped = Math.round(value / step) * step;
  const moved = Math.abs(snapped - value) > 1e-9 && (direction > 0 ? snapped > value : snapped < value)
    ? snapped
    : snapped + direction * step;
  return tidy(Math.max(0, moved));
}

export function formatWeight(value: number | null | undefined, unit: WeightUnit | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const amount = tidy(value).toString();
  return unit ? `${amount} ${unit}` : amount;
}

export function weightUnitLabel(unit: WeightUnit): string {
  return unit === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)';
}

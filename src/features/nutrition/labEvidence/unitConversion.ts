export type LabUnit = 'ug/kg' | 'mg/kg' | 'ppm' | 'ppb' | 'ug' | 'mg' | 'g';
export type UnitConversionResult =
  | { ok: true; value: number; unit: LabUnit }
  | { ok: false; reason: 'invalid_value' | 'unsupported_unit' | 'incompatible_dimensions' | 'serving_mass_required' };

const concentrationInUgPerKg: Partial<Record<LabUnit, number>> = {
  'ug/kg': 1,
  'mg/kg': 1000,
  ppm: 1000,
  ppb: 1
};
const massInUg: Partial<Record<LabUnit, number>> = {
  ug: 1,
  mg: 1000,
  g: 1_000_000
};

export function normalizeLabUnit(value: string): LabUnit | null {
  const unit = value.toLowerCase().replace(/μ|µ/g, 'u').replace(/\s+/g, '');
  const aliases: Record<string, LabUnit> = {
    'ug/kg': 'ug/kg', 'mcg/kg': 'ug/kg', 'mg/kg': 'mg/kg', ppm: 'ppm', ppb: 'ppb',
    ug: 'ug', mcg: 'ug', mg: 'mg', g: 'g'
  };
  return aliases[unit] ?? null;
}

export function convertLabUnit(value: number, fromValue: string, toValue: string): UnitConversionResult {
  if (!Number.isFinite(value) || value < 0) return { ok: false, reason: 'invalid_value' };
  const from = normalizeLabUnit(fromValue);
  const to = normalizeLabUnit(toValue);
  if (!from || !to) return { ok: false, reason: 'unsupported_unit' };
  if (from === to) return { ok: true, value, unit: to };
  const concentrationFrom = concentrationInUgPerKg[from];
  const concentrationTo = concentrationInUgPerKg[to];
  if (concentrationFrom && concentrationTo) return { ok: true, value: value * concentrationFrom / concentrationTo, unit: to };
  const massFrom = massInUg[from];
  const massTo = massInUg[to];
  if (massFrom && massTo) return { ok: true, value: value * massFrom / massTo, unit: to };
  return { ok: false, reason: 'incompatible_dimensions' };
}

export function concentrationToServingAmount(
  value: number,
  concentrationUnit: string,
  servingMassGrams: number | null | undefined,
  outputUnit: 'ug' | 'mg'
): UnitConversionResult {
  if (typeof servingMassGrams !== 'number' || !Number.isFinite(servingMassGrams) || servingMassGrams <= 0) {
    return { ok: false, reason: 'serving_mass_required' };
  }
  const concentration = convertLabUnit(value, concentrationUnit, 'ug/kg');
  if (!concentration.ok) return concentration;
  return convertLabUnit(concentration.value * servingMassGrams / 1000, 'ug', outputUnit);
}

/** Only explicit label amounts; never infer a portion from a food's name. */
export function metricServing(quantity: unknown, unit: unknown): { quantity: number; unit: 'g' | 'mL' } | null {
  const value = typeof quantity === 'number' ? quantity : typeof quantity === 'string' && /^\d+(?:\.\d+)?$/.test(quantity.trim()) ? Number(quantity) : NaN;
  if (!Number.isFinite(value) || value <= 0 || typeof unit !== 'string') return null;
  const key = unit.trim().toLowerCase();
  if (['g', 'grm', 'gram', 'grams'].includes(key)) return { quantity: value, unit: 'g' };
  if (['ml', 'mlt', 'milliliter', 'milliliters'].includes(key)) return { quantity: value, unit: 'mL' };
  if (['oz', 'onz', 'ounce', 'ounces'].includes(key)) return { quantity: value * 28.349523125, unit: 'g' };
  // "fl oz" alone can mean US or imperial; do not guess a volume conversion.
  return null;
}

export function metricServingFromText(label: string | null | undefined) {
  const match = label?.match(/(?:^|[\s(])(\d+(?:\.\d+)?)\s*(g|grams?|ml|milliliters?)\b/i);
  return match ? metricServing(match[1], match[2]) : null;
}

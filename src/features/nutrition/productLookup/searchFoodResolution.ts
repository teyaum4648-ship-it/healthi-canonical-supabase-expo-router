import type { HealthiProductSnapshot } from './productLookupTypes';
import { canonicalBarcodeIdentity } from './barcodeUtils';
import { foodLoggingCompleteness } from '../foodLoggingNutrition';

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Completeness breaks ties among relevant foods, never across identities.
 * A secondary-provider record wins a duplicate only as a whole nutrition record.
 */
export function resolveSearchFoods(rows: HealthiProductSnapshot[], query: string): HealthiProductSnapshot[] {
  const identity = (p: HealthiProductSnapshot) => p.barcode ? canonicalBarcodeIdentity(p.barcode) : `${p.provider}:${p.provider_product_id}`;
  const groups = new Map<string, HealthiProductSnapshot[]>();
  for (const p of rows) { const key = identity(p); groups.set(key, [...(groups.get(key) ?? []), p]); }
  const candidates = [...groups.values()].map(group => {
    const sorted = [...group].sort((a,b) => foodLoggingCompleteness(b) - foodLoggingCompleteness(a));
    const best = sorted[0];
    // Identification image only; never borrow nutrients, serving or brand from
    // another result. Exact barcode equality is required for this photo reuse.
    return best.image_url ? best : { ...best, image_url: sorted.find(p => p.image_url)?.image_url ?? null };
  });
  const phrase = normalized(query), terms = [...new Set(phrase.split(/\s+/).filter(Boolean))];
  return candidates.map((p,i) => {
    const name = normalized(p.name), haystack = `${name} ${normalized(p.brand ?? '')}`;
    const words = new Set(haystack.split(' '));
    const covered = terms.filter(t => words.has(t)).length;
    return { p, i, covered, completeness: foodLoggingCompleteness(p), exact: name === phrase ? 2 : name.includes(phrase) ? 1 : 0, length: name.length };
  }).sort((a,b) => b.covered - a.covered || b.completeness - a.completeness || b.exact - a.exact || a.length - b.length || a.i - b.i).map(r => r.p);
}

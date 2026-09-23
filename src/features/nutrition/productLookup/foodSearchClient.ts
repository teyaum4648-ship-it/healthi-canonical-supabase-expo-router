import { normalizeOpenFoodFactsProduct, type OpenFoodFactsProduct } from './normalizeProduct';
import { searchOpenFoodFactsProducts, type ProductSearchResult } from './openFoodFactsClient';
import { resolveSearchFoods } from './searchFoodResolution';
import { readUsdaMicronutrients } from './micronutrientReaders';
import type { HealthiProductSnapshot } from './productLookupTypes';
import { metricServing, metricServingFromText } from '../labelServing';
type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';

export function usdaFoodPortions(food: RecordValue): NonNullable<HealthiProductSnapshot['food_portions']> {
  const rows = [food.foodMeasures, food.foodPortions].flatMap(v => Array.isArray(v) ? v.filter(record) : []);
  const seen = new Set<string>();
  return rows.flatMap(p => {
    const grams = finite(p.gramWeight);
    const measure = record(p.measureUnit) ? text(p.measureUnit.name) : '';
    const label = text(p.disseminationText) || text(p.portionDescription) ||
      [finite(p.amount) ? String(p.amount) : '', measure && measure !== 'undetermined' ? measure : '', text(p.modifier)].filter(Boolean).join(' ');
    if (!grams || !label || /quantity not specified|undetermined|not applicable/i.test(label) || /^\d+$/.test(label)) return [];
    const display = `${label} (${Math.round(grams * 100) / 100} g)`;
    if (seen.has(display)) return [];
    seen.add(display);
    return [{ label: display, quantity: grams, unit: 'g' as const }];
  });
}

/** USDA branded nutrients use 100 g or 100 mL according to the reported unit.
 * https://fdc.nal.usda.gov/GBFPD_Documentation/#standardizing-and-presenting-gbfpd-data
 */
export function normalizeUsdaSearchFood(food: RecordValue): HealthiProductSnapshot | null {
  if (!text(food.description) || !Number.isInteger(food.fdcId)) return null;
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients.filter(record).map(n => record(n.nutrient)
    ? { nutrientId: n.nutrient.id, unitName: n.nutrient.unitName, value: n.amount } : n) : [];
  function nutrient(id: number, unit: string) {
    const row = nutrients.find(n => n.nutrientId === id && text(n.unitName).toLowerCase() === unit.toLowerCase());
    return row ? finite(row.value) : null;
  }
  const rawKcal = nutrient(1008, 'kcal') ?? nutrient(2048, 'kcal') ?? nutrient(2047, 'kcal') ?? (nutrient(1062, 'kj') !== null ? nutrient(1062, 'kj')! / 4.184 : null);
  const kcal = rawKcal !== null && rawKcal <= 1000 ? rawKcal : null;
  const portions = usdaFoodPortions(food);
  const household = text(food.householdServingFullText);
  const reported = metricServing(food.servingSize, food.servingSizeUnit) ?? metricServingFromText(household);
  const serving = reported ?? portions[0] ?? null;
  const isVolume = (metricServing(1, food.servingSizeUnit)?.unit ?? serving?.unit) === 'mL';
  const metricLabel = serving ? `${Math.round(serving.quantity * 100) / 100} ${serving.unit}` : null;
  const label = !reported && portions.length ? portions[0].label : household && metricLabel && !metricServingFromText(household)
    ? `${household} (${metricLabel})` : household || metricLabel;
  const perHundred = { calories: kcal, protein_g: nutrient(1003, 'g'), carbs_g: nutrient(1005, 'g'), fat_g: nutrient(1004, 'g'), fiber_g: nutrient(1079, 'g'), sugar_g: nutrient(2000, 'g'), added_sugar_g: nutrient(1235, 'g'), saturated_fat_g: nutrient(1258, 'g'), sodium_mg: nutrient(1093, 'mg'), micronutrients: readUsdaMicronutrients(nutrients) };
  return { barcode: text(food.gtinUpc), provider: 'usda_food_data_central', provider_product_id: String(food.fdcId), name: text(food.description), brand: text(food.brandName) || text(food.brandOwner) || null,
    ingredients_text: text(food.ingredients) || null, image_url: null, serving_size: label,
    food_portions: reported && label ? [{ label, ...reported }, ...portions] : portions, food_data_type: text(food.dataType),
    serving_quantity: serving?.quantity ?? null, serving_unit: serving?.unit ?? null,
    serving_quantity_g: serving?.unit === 'g' ? serving.quantity : null,
    nutriments_per_100g: isVolume ? undefined : perHundred,
    nutriments_per_100ml: isVolume ? perHundred : undefined,
    confidence: 'medium', quality_flags: [], reason_codes: [] };
}
export function normalizeSearchPayload(payload: unknown, query: string): HealthiProductSnapshot[] {
  if (!record(payload) || !Array.isArray(payload.products) || !Array.isArray(payload.usdaFoods)) throw new SyntaxError('Unreadable catalog');
  const rows: HealthiProductSnapshot[] = [];
  for (const candidate of payload.products.slice(0,24)) {
    if (!record(candidate) || !text(candidate.code)) continue;
    // A single malformed public record must not discard all readable matches.
    try { const p = normalizeOpenFoodFactsProduct(text(candidate.code), candidate as OpenFoodFactsProduct); if (p) rows.push(p); } catch { /* skip this record */ }
  }
  for (const candidate of payload.usdaFoods.slice(0,24)) { if (record(candidate)) { const p = normalizeUsdaSearchFood(candidate); if (p) rows.push(p); } }
  return resolveSearchFoods(rows, query);
}
type SearchResult = ProductSearchResult & { notice?: string };
const cache = new Map<string, { at: number; result: SearchResult }>();
export async function searchFoods(query: string, options: { signal?: AbortSignal; fetcher?: typeof fetch; endpoint?: string } = {}): Promise<SearchResult> {
  const q = query.trim().replace(/\s+/g,' ');
  if (q.length < 2 || q.length > 120) return { status: 'empty', products: [], message: 'Enter a food or brand between 2 and 120 characters.' };
  const endpoint = options.endpoint ?? process.env.EXPO_PUBLIC_FOOD_SEARCH_URL;
  if (!endpoint) return searchOpenFoodFactsProducts(q, { signal: options.signal });
  const key = `${endpoint}:${q.toLowerCase()}`;
  const cached = options.fetcher ? null : cache.get(key);
  if (options.signal?.aborted) return { status: 'error', products: [], message: 'Search canceled.' };
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.result;
  const controller = new AbortController(); let timedOut = false;
  const cancel = () => controller.abort(); options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
  try {
    const r = await (options.fetcher ?? fetch)(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) {
      if (cached && Date.now() - cached.at < 86400_000) return { ...cached.result, notice: 'Showing earlier results while the database is unavailable. Check the package label.' };
      return { status: 'error', products: [], message: r.status === 429 ? 'Please wait a moment, then search again. Recent and Saved are available now.' : 'The food database is temporarily unavailable. Try again, or use Recent, Saved, or scan the barcode.' };
    }
    const payload: unknown = await r.json();
    if (options.signal?.aborted) throw new Error('canceled');
    const products = normalizeSearchPayload(payload, q);
    const notice = record(payload) && payload.stale ? 'Showing earlier catalog results. Check the package label.' : record(payload) && payload.partial ? 'One database is unavailable; showing the matches we could load.' : record(payload) && payload.servingDetailsIncomplete ? 'Some label serving sizes could not load. Results marked per 100 g or 100 mL need an amount from the package.' : undefined;
    const result: SearchResult = products.length ? { status: 'found', products, notice } : { status: 'empty', products: [], message: notice ?? 'No readable matches. Try the brand or scan the barcode; not every product is listed.' };
    if (!options.fetcher && products.length && !notice) { if (cache.size >= 30) cache.delete(cache.keys().next().value!); cache.set(key, { at: Date.now(), result }); }
    return result;
  } catch(error) {
    if (!options.signal?.aborted && cached && Date.now() - cached.at < 86400_000) return { ...cached.result, notice: 'Showing earlier results. Check the package label.' };
    return { status: 'error', products: [], message: options.signal?.aborted ? 'Search canceled.' : timedOut ? 'Search took too long. Try again; your Recent and Saved foods are ready now.' : error instanceof SyntaxError ? 'The database returned unreadable results. Please try again.' : 'Could not reach food search. Check your connection or use Recent and Saved.' };
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', cancel); }
}

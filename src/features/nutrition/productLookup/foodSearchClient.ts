import { searchCatalogueEngine } from './catalogueEngine';
import { normalizeOpenFoodFactsProduct, type OpenFoodFactsProduct } from './normalizeProduct';
import { searchOpenFoodFactsProducts, type ProductLookupFetch, type ProductSearchResult } from './openFoodFactsClient';
import { deviceCountryTag, findStoreBrand, storeBrandNotice, storeBrandText } from './storeBrands';
import { matchRestaurantFoods } from './bundledRestaurantFoods';
import { loadMenuStat, matchMenuStat, type MenuStatData } from './menuStatFoods';
import type { RestaurantFoodRow } from './restaurantFoodTypes';
import { resolveSearchFoods } from './searchFoodResolution';
import { readUsdaMicronutrients } from './micronutrientReaders';
import { correctSearchQuery, guessSearchQuery } from './searchQueryCorrection';
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
type SearchResult = ProductSearchResult & { notice?: string; searchedFor?: string };
const cache = new Map<string, { at: number; result: SearchResult }>();

/** The built-in restaurant dishes that match, best first, at most a dozen. */
export function bundledRestaurantMatches(query: string, rows?: readonly RestaurantFoodRow[]): HealthiProductSnapshot[] {
  const found = matchRestaurantFoods(query, rows).flatMap(food => normalizeUsdaSearchFood(food) ?? []);
  return resolveSearchFoods(found, query).slice(0, 12);
}

/**
 * Built-in restaurant matches from both lists, best first, one row per chain and dish.
 * The same Big Mac is in USDA's list and MenuStat's; showing it twice reads as two foods.
 */
export async function restaurantMatches(query: string, options: { restaurantRows?: readonly RestaurantFoodRow[]; menuStat?: MenuStatData } = {}): Promise<HealthiProductSnapshot[]> {
  let menu: HealthiProductSnapshot[] = [];
  try { menu = matchMenuStat(query, options.menuStat ?? await loadMenuStat()); } catch { /* the chain list is optional; USDA's still answers */ }
  const usda = matchRestaurantFoods(query, options.restaurantRows).flatMap(food => normalizeUsdaSearchFood(food) ?? []);
  // Of two rows for one dish, keep the one that knows its serving weight.
  const key = (p: HealthiProductSnapshot) => `${p.brand ?? ''}|${p.name}`.toLowerCase().replace(/[^a-z0-9|]+/g, ' ').trim();
  const weighed = (p: HealthiProductSnapshot) => (p.serving_quantity_g ?? p.serving_quantity ?? 0) > 0;
  const best = new Map<string, HealthiProductSnapshot>();
  for (const p of [...menu, ...usda]) {
    const held = best.get(key(p));
    if (!held || (!weighed(held) && weighed(p))) best.set(key(p), p);
  }
  return resolveSearchFoods([...best.values()], query).slice(0, 15);
}

/**
 * Puts built-in restaurant matches in with a catalogue's answer. They are ranked together,
 * so a chain dish leads only when it matches the words better. If the catalogue failed,
 * the built-in matches still answer, and say where they came from.
 */
function withBundled(result: SearchResult, local: HealthiProductSnapshot[], query: string): SearchResult {
  if (!local.length) return result;
  if (result.status === 'found') return { ...result, products: resolveSearchFoods([...local, ...result.products], query) };
  return {
    status: 'found', products: local,
    ...(result.status === 'error' ? { notice: 'Online search is unavailable, so these are restaurant dishes built into the app.' } : {}),
    ...(result.searchedFor ? { searchedFor: result.searchedFor } : {})
  };
}
/**
 * Searches for what somebody probably meant, and says so when that differs from what
 * they typed.
 *
 * Certain corrections — an apostrophe a chain name needs dropped, a spelling from the
 * curated maps — are applied before the first request. A guess is only made after that
 * request has come back with nothing, because a query that has not failed yet does not
 * need guessing at, and guessing early mangles correct words.
 */
export async function searchFoods(query: string, options: {
  signal?: AbortSignal; fetcher?: typeof fetch; endpoint?: string; restaurantRows?: readonly RestaurantFoodRow[]; menuStat?: MenuStatData;
  /** Override the device's country; null searches every country. */
  countryTag?: string | null;
} = {}): Promise<SearchResult> {
  const typed = query.trim().replace(/\s+/g,' ');
  if (typed.length < 2 || typed.length > 120) return { status: 'empty', products: [], message: 'Enter a food or brand between 2 and 120 characters.' };
  const correction = correctSearchQuery(typed);
  const q = correction.query || typed;
  const local = await restaurantMatches(q, options);
  const store = findStoreBrand(q);
  const storeNotice = store ? storeBrandNotice(store) : undefined;
  const endpoint = options.endpoint ?? process.env.EXPO_PUBLIC_FOOD_SEARCH_URL;
  if (!endpoint) {
    const base = { signal: options.signal, ...(options.fetcher ? { fetcher: options.fetcher as unknown as ProductLookupFetch } : {}) };
    const countryTag = options.countryTag === undefined ? deviceCountryTag() : options.countryTag;
    /*
     * The catalogue's newer engine first. The keyword search below turned away most
     * requests when measured, so it is the fallback now rather than the front door; see
     * catalogueEngine for the numbers. A store name goes in as its house brand's words,
     * and the engine reads the brand back off its answers.
     */
    const engine = await searchCatalogueEngine(store ? storeBrandText(store) : q, { ...base, countryTag });
    if (options.signal?.aborted) return engine;
    if (engine.status === 'found') return withBundled(storeNotice ? { ...engine, notice: storeNotice } : engine, local, q);
    /*
     * Searched among products sold in the device's country, and a named store or house
     * brand as a brand filter on top. The country matters for brands too: "Trader Joe's"
     * alone brought back German Aldi goods sold under the same name. Each falls back
     * once, and only on an empty answer: an error is usually the rate limit, which a
     * second request would only make worse.
     */
    let off: ProductSearchResult;
    if (store) {
      off = await searchOpenFoodFactsProducts(store.rest, { ...base, brandTag: store.store.tag, ...(countryTag ? { countryTag } : {}) });
      if (off.status === 'empty' && !options.signal?.aborted) off = await searchOpenFoodFactsProducts(storeBrandText(store), base);
    } else {
      off = await searchOpenFoodFactsProducts(q, countryTag ? { ...base, countryTag } : base);
      if (countryTag && off.status === 'empty' && !options.signal?.aborted) off = await searchOpenFoodFactsProducts(q, base);
    }
    if (options.signal?.aborted) return off;
    // The engine answered and found nothing; the keyword search failing too does not make that an outage.
    if (off.status === 'error' && engine.status === 'empty') off = engine;
    return withBundled(storeNotice && off.status === 'found' ? { ...off, notice: storeNotice } : off, local, q);
  }
  // The server's full-text search has no brand filter, so the brand's own words stand in.
  const sent = store ? storeBrandText(store) : q;
  const key = `${endpoint}:${sent.toLowerCase()}`;
  const cached = options.fetcher ? null : cache.get(key);
  if (options.signal?.aborted) return { status: 'error', products: [], message: 'Search canceled.' };
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.result;
  const controller = new AbortController(); let timedOut = false;
  const cancel = () => controller.abort(); options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
  try {
    const r = await (options.fetcher ?? fetch)(`${endpoint}?q=${encodeURIComponent(sent)}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) {
      if (cached && Date.now() - cached.at < 86400_000) return { ...cached.result, notice: 'Showing earlier results while the database is unavailable. Check the package label.' };
      return withBundled({ status: 'error', products: [], message: r.status === 429 ? 'Please wait a moment, then search again. Recent and Saved are available now.' : 'The food database is temporarily unavailable. Try again, or use Recent, Saved, or scan the barcode.' }, local, q);
    }
    const payload: unknown = await r.json();
    if (options.signal?.aborted) throw new Error('canceled');
    const catalog = normalizeSearchPayload(payload, sent);
    const products = local.length ? resolveSearchFoods([...local, ...catalog], q) : catalog;
    const notice = storeNotice ?? (record(payload) && payload.stale ? 'Showing earlier catalog results. Check the package label.' : record(payload) && payload.partial ? 'One database is unavailable; showing the matches we could load.' : record(payload) && payload.servingDetailsIncomplete ? 'Some label serving sizes could not load. Results marked per 100 g or 100 mL need an amount from the package.' : undefined);
    if (products.length === 0) {
      /*
       * Nothing came back, so the query has demonstrably failed and a guess is now worth
       * making. One attempt, never a loop, and the caller is told what was searched so it
       * can offer the literal words back.
       */
      const guess = guessSearchQuery(typed);
      if (guess && guess.query !== q) {
        const retried = await searchFoods(guess.query, { ...options, endpoint });
        if (retried.status === 'found') return { ...retried, searchedFor: guess.query };
      }
      return { status: 'empty', products: [], message: notice ?? 'No readable matches. Try the brand or scan the barcode; not every product is listed.' };
    }
    const result: SearchResult = { status: 'found', products, notice, ...(correction.corrected ? { searchedFor: q } : {}) };
    if (!options.fetcher && !notice) { if (cache.size >= 30) cache.delete(cache.keys().next().value!); cache.set(key, { at: Date.now(), result }); }
    return result;
  } catch(error) {
    if (!options.signal?.aborted && cached && Date.now() - cached.at < 86400_000) return { ...cached.result, notice: 'Showing earlier results. Check the package label.' };
    const failed: SearchResult = { status: 'error', products: [], message: options.signal?.aborted ? 'Search canceled.' : timedOut ? 'Search took too long. Try again; your Recent and Saved foods are ready now.' : error instanceof SyntaxError ? 'The database returned unreadable results. Please try again.' : 'Could not reach food search. Check your connection or use Recent and Saved.' };
    return options.signal?.aborted ? failed : withBundled(failed, local, q);
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', cancel); }
}

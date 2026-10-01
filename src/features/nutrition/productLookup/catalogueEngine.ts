import { canonicalBarcodeIdentity } from './barcodeUtils';
import { brandText, leadingBrand } from './brandSearch';
import { normalizeOpenFoodFactsProduct, type OpenFoodFactsProduct } from './normalizeProduct';
import { fetchLabelByCode, fetchLabelsByCode, type ProductLookupFetch, type ProductSearchResult } from './openFoodFactsClient';
import type { HealthiProductSnapshot } from './productLookupTypes';
import { resolveSearchFoods } from './searchFoodResolution';

/*
 * Open Food Facts' newer search engine, the one its own site searches with.
 *
 * Measured on 1 October 2026, from the app's own code: the keyword search the phone had
 * been using turned away 28 of 40 requests with a "503 busy" page, a few seconds apart and
 * whatever the headers or filters, and the app gave up after two tries. That, not the
 * brand being missing from a product's name, is why "breyers butter pecan ice cream"
 * came back with nothing while the barcode, which goes to a different service, always
 * worked. This engine answered every request, in about a fifth of a second.
 *
 * Its plain-word ranking is loose — that same search led with a Croatian biscuit — but
 * naming the brand as a field put the brand's own products first in 8 of 10 branded
 * searches. The brand has to be spelled the way the catalogue spells it ("annies" finds
 * nothing; "Annie's" does), so it is read off the brands that come back from the first
 * ask rather than guessed from the typing.
 */

const ENGINE_URL = 'https://search.openfoodfacts.org/search';
const ENGINE_FIELDS = 'code,product_name,product_name_en,generic_name,brands,categories_tags,countries_tags,labels_tags,nutriments,image_front_small_url,quantity,lang';
const headers = { Accept: 'application/json', 'X-User-Agent': 'Healthi/0.1' };

type Hit = Record<string, unknown>;
const isRecord = (value: unknown): value is Hit => !!value && typeof value === 'object' && !Array.isArray(value);

/** Words people type around a food that carry nothing for the engine. */
const FILLER = new Set(['a', 'an', 'the', 'and', 'with', 'of', 'or', 'not', 'to']);

/** Plain lower-case words: nothing the engine could read as query syntax. */
export function engineWords(text: string): string[] {
  const words = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['\u2019]/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words.filter((word) => !FILLER.has(word)))];
}

/** A value for a quoted field clause: no quotes or backslashes to break out of it. */
const quoted = (value: string) => `"${value.toLowerCase().replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()}"`;

/**
 * The engine's request. With a brand, only that brand's products come back, ranked by
 * the remaining words; with a country, only products sold there.
 */
export function buildEngineSearchUrl(words: readonly string[], options: { brand?: string; countryTag?: string } = {}): string {
  const clauses = [
    ...(options.brand ? [`brands:${quoted(options.brand)}`] : []),
    ...words,
    ...(options.countryTag ? [`countries_tags:${quoted(`en:${options.countryTag}`)}`] : [])
  ];
  return `${ENGINE_URL}?q=${encodeURIComponent(clauses.join(' AND '))}&langs=en&page_size=24&fields=${ENGINE_FIELDS}`;
}

/** Each brand as one entry, the way the engine lists them. */
function hitBrands(hit: Hit): string[] {
  const brands = Array.isArray(hit.brands) ? hit.brands : typeof hit.brands === 'string' ? hit.brands.split(',') : [];
  return brands.filter((brand): brand is string => typeof brand === 'string').map((brand) => brand.trim()).filter(Boolean);
}

/**
 * The brand a query starts with, spelled the way the catalogue spells it, and what else
 * was asked for. Of several spellings of one brand ("Annie's", "Annies", "Annie’s"), the
 * most common among the answers is the one the catalogue mostly uses.
 */
export function catalogueBrand(query: string, hits: readonly Hit[]): { brand: string; rest: string } | null {
  const spellings = new Map<string, Map<string, number>>();
  for (const brand of hits.flatMap(hitBrands)) {
    const key = brandText(brand);
    if (!key) continue;
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(brand, (counts.get(brand) ?? 0) + 1);
    spellings.set(key, counts);
  }
  const found = leadingBrand(query, [...spellings.keys()]);
  if (!found) return null;
  const counts = [...spellings.get(found.brand)!.entries()].sort((a, b) => b[1] - a[1]);
  return { brand: counts[0][0], rest: found.rest };
}

type EngineAnswer = { ok: true; hits: Hit[] } | { ok: false };

async function ask(url: string, fetcher: ProductLookupFetch, signal: AbortSignal | undefined, timeoutMs: number): Promise<EngineAnswer> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetcher(url, { headers, signal: controller.signal });
    if (!response.ok) return { ok: false };
    const body = await response.json();
    return isRecord(body) && Array.isArray(body.hits) ? { ok: true, hits: body.hits.filter(isRecord) } : { ok: false };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

function toSnapshot(hit: Hit): HealthiProductSnapshot | null {
  const code = typeof hit.code === 'string' ? hit.code.trim() : '';
  if (!code) return null;
  try {
    return normalizeOpenFoodFactsProduct(code, { ...hit, brands: hitBrands(hit).join(', ') } as OpenFoodFactsProduct);
  } catch {
    return null;
  }
}

const cache = new Map<string, { at: number; result: ProductSearchResult }>();
/** How many leading matches are read one by one when the bulk label request fails. */
const LABELLED_LEADERS = 4;

/**
 * Searches the engine: once with the words, and once more inside the brand the query
 * starts with when the answers name one. The brand's own products lead; the rest of the
 * first answer follows, so a misread brand costs ordering, never results.
 *
 * The engine's index leaves out label servings and ingredients, so the full records are
 * fetched for the matches in one request. If that request fails the matches still log
 * per 100 g, which is what the label states too.
 */
export async function searchCatalogueEngine(query: string, options: {
  fetcher?: ProductLookupFetch; signal?: AbortSignal; countryTag?: string | null; timeoutMs?: number;
} = {}): Promise<ProductSearchResult> {
  const words = engineWords(query);
  if (!words.length) return { status: 'empty', products: [], message: 'Enter a food or brand to search.' };
  const fetcher = options.fetcher ?? (fetch as unknown as ProductLookupFetch);
  const timeoutMs = options.timeoutMs ?? 8_000;
  const countryTag = options.countryTag ?? undefined;
  const key = `${countryTag ?? ''}:${words.join(' ')}`;
  const cached = options.fetcher ? null : cache.get(key);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.result;

  let first = await ask(buildEngineSearchUrl(words, { countryTag }), fetcher, options.signal, timeoutMs);
  // Nothing tagged as sold here: a product's country tags are often incomplete.
  if (first.ok && !first.hits.length && countryTag && !options.signal?.aborted) first = await ask(buildEngineSearchUrl(words), fetcher, options.signal, timeoutMs);
  if (!first.ok) return { status: 'error', products: [], message: 'The food database is unavailable right now.' };
  let hits = first.hits;
  const brand = catalogueBrand(query, first.hits);
  if (brand && !options.signal?.aborted) {
    const inside = await ask(buildEngineSearchUrl(engineWords(brand.rest), { brand: brand.brand, countryTag }), fetcher, options.signal, timeoutMs);
    if (inside.ok) hits = [...inside.hits, ...first.hits];
  }
  if (options.signal?.aborted) return { status: 'error', products: [], message: 'Search canceled.' };

  const seen = new Set<string>();
  const unique = hits.filter((hit) => {
    const code = typeof hit.code === 'string' ? hit.code : '';
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  }).slice(0, 30);
  const labels = await fetchLabelsByCode(unique.map((hit) => String(hit.code)), { fetcher: options.fetcher, signal: options.signal });
  // A full record replaces the index entry whole, never field by field.
  const snapshots = () => unique.flatMap((hit) => toSnapshot(labels.get(canonicalBarcodeIdentity(String(hit.code))) ?? hit) ?? []);
  /*
   * The bulk request goes to a search service and was turned away about half the time
   * when measured. The few matches most likely to be picked are then read one by one
   * from the product service, as a scan would be.
   */
  const unlabelled = resolveSearchFoods(snapshots(), query).slice(0, LABELLED_LEADERS)
    .map((product) => product.barcode).filter((code) => code && !labels.has(canonicalBarcodeIdentity(code)));
  if (unlabelled.length && !options.signal?.aborted) {
    const read = await Promise.all(unlabelled.map((code) => fetchLabelByCode(code, { fetcher: options.fetcher, signal: options.signal })));
    read.forEach((label, index) => { if (label) labels.set(canonicalBarcodeIdentity(unlabelled[index]), label); });
  }
  const products = snapshots();
  const result: ProductSearchResult = products.length
    ? { status: 'found', products: resolveSearchFoods(products, query) }
    : { status: 'empty', products: [], message: 'No foods matched. Try a simpler name or include the brand. You can also scan or enter the label.' };
  if (!options.fetcher) {
    if (cache.size >= 30) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), result });
  }
  return result;
}

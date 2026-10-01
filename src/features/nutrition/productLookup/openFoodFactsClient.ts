import { barcodeLookupCandidates, canonicalBarcodeIdentity, validateBarcode } from './barcodeUtils';
import { normalizeOpenFoodFactsProduct, type OpenFoodFactsProduct } from './normalizeProduct';
import {
  openFoodFactsProductRequestScheduler,
  ProviderRequestScheduler
} from './productRequestScheduler';
import type { HealthiProductSnapshot, ProductLookupResult } from './productLookupTypes';

type FetchResponse = {
  ok: boolean;
  status?: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
};

export type ProductLookupFetch = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<FetchResponse>;

export type OpenFoodFactsLookupOptions = {
  fetcher?: ProductLookupFetch;
  timeoutMs?: number;
  locale?: string;
  scheduler?: Pick<ProviderRequestScheduler, 'schedule' | 'defer'> | null;
  signal?: AbortSignal;
  /** Search only this brand (an Open Food Facts brands tag). The query may then be empty. */
  brandTag?: string;
  /** Search only products sold in this country (an Open Food Facts countries tag). */
  countryTag?: string;
};

export type ProductSearchResult =
  | { status: 'found'; products: HealthiProductSnapshot[] }
  | { status: 'empty'; products: HealthiProductSnapshot[]; message: string }
  | { status: 'error'; products: HealthiProductSnapshot[]; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function productFields(locale = 'en'): string {
  const safeLocale = locale.toLowerCase().replace('-', '_').match(/^[a-z]{2,3}(?:_[a-z]{2})?$/)?.[0] ?? 'en';
  return [
  'code',
  'product_name',
  'image_front_small_url',
  'image_front_thumb_url',
  'image_front_url',
  'product_name_en',
  'generic_name',
  'abbreviated_product_name',
  'brands',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'ingredients_text',
  'ingredients_text_en',
  `ingredients_text_${safeLocale}`,
  'ingredients',
  'ingredients_n',
  'labels_tags',
  // Curated and language-independent, unlike the printed "Contains" statement.
  'allergens_tags',
  'traces_tags',
  'categories_tags',
  'packaging_tags',
  'lang',
  'languages_codes',
  'countries_tags',
  'last_modified_t',
  'last_modified_datetime',
  'completeness',
  'data_quality_tags',
  'nova_group',
  'additives_n',
  'nutriments'
  ].join(',');
}

const requestHeaders = {
  Accept: 'application/json',
  'X-User-Agent': 'Healthi/0.1'
};

async function fetchWithTimeout(
  fetcher: ProductLookupFetch,
  url: string,
  timeoutMs: number
): Promise<FetchResponse> {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    return await fetcher(url, {
      headers: requestHeaders,
      signal: controller?.signal
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function isRetryableProviderFailure(response: FetchResponse): boolean {
  return response.status === 408 || response.status === 429 || (typeof response.status === 'number' && response.status >= 500);
}

export function retryAfterMilliseconds(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

async function fetchProductWithRetry(
  fetcher: ProductLookupFetch,
  url: string,
  timeoutMs: number,
  scheduler: OpenFoodFactsLookupOptions['scheduler']
): Promise<FetchResponse> {
  const maximumAttempts = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      const request = () => fetchWithTimeout(fetcher, url, timeoutMs);
      const response = scheduler ? await scheduler.schedule(request) : await request();
      if (response.ok || !isRetryableProviderFailure(response) || attempt === maximumAttempts - 1) return response;
      if (response.status === 429 && scheduler) {
        scheduler.defer(retryAfterMilliseconds(response.headers?.get('retry-after')) ?? 0);
      }
    } catch (error) {
      lastError = error;
      if (attempt === maximumAttempts - 1) throw error;
    }
  }
  throw lastError;
}

export async function lookupOpenFoodFactsProduct(
  value: string,
  options: OpenFoodFactsLookupOptions = {}
): Promise<ProductLookupResult> {
  const validation = validateBarcode(value);
  if (!validation.valid) {
    return {
      status: 'error',
      barcode: validation.barcode,
      code: 'invalid_barcode',
      message: validation.message
    };
  }

  const { barcode } = validation;
  const fetcher = options.fetcher ?? (fetch as unknown as ProductLookupFetch);
  const timeoutMs = options.timeoutMs ?? 12_000;
  const scheduler = options.scheduler === undefined
    ? (options.fetcher ? null : openFoodFactsProductRequestScheduler)
    : options.scheduler;

  try {
    for (const candidate of barcodeLookupCandidates(barcode)) {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(candidate)}.json?fields=${productFields(options.locale)}`;
      const response = await fetchProductWithRetry(fetcher, url, timeoutMs, scheduler);
      if (!response.ok) {
        return {
          status: 'error',
          barcode,
          code: 'provider_error',
          message: 'Product data is unavailable right now. Try again or log the meal manually.'
        };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return {
          status: 'error',
          barcode,
          code: 'malformed_response',
          message: 'The product response could not be read. Try again in a moment.'
        };
      }

      if (!isRecord(payload)) {
        return {
          status: 'error',
          barcode,
          code: 'malformed_response',
          message: 'The product response could not be read. Try again in a moment.'
        };
      }

      if (payload.status === 0 || !isRecord(payload.product)) continue;

      const product = normalizeOpenFoodFactsProduct(barcode, payload.product as OpenFoodFactsProduct);
      if (!product) {
        return {
          status: 'error',
          barcode,
          code: 'malformed_response',
          message: 'This product is missing a readable name. You can still log it manually.'
        };
      }

      return { status: 'found', product };
    }

    return {
      status: 'not_found',
      barcode,
      message: 'No product was found for this barcode. You can still log it manually.'
    };
  } catch {
    return {
      status: 'error',
      barcode,
      code: 'network_error',
      message: 'Product lookup could not connect. Check your connection or log the meal manually.'
    };
  }
}

export async function searchOpenFoodFactsProducts(
  query: string,
  options: OpenFoodFactsLookupOptions = {}
): Promise<ProductSearchResult> {
  const searchTerms = query.trim();
  if (searchTerms.length < 2 && !options.brandTag) {
    return { status: 'empty', products: [], message: 'Enter at least two letters to search foods.' };
  }

  if (searchTerms.length > 120) return { status: 'empty', products: [], message: 'Try a shorter food name or brand (up to 120 characters).' };
  const fetcher = options.fetcher ?? (fetch as unknown as ProductLookupFetch);
  // V2 search is filter-only. The existing provider's keyword endpoint also
  // permits browser requests; Search-a-licious currently blocks this app origin.
  const filters = { brandTag: options.brandTag, countryTag: options.countryTag };
  const url = buildFoodSearchUrl(searchTerms, options.locale, filters);
  const cacheKey = `${options.locale ?? 'en'}:${filters.brandTag ?? ''}:${filters.countryTag ?? ''}:${searchTerms.toLocaleLowerCase()}`;
  const cached = !options.fetcher ? foodSearchCache.get(cacheKey) : null;
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const scheduler = options.scheduler === undefined ? (options.fetcher ? null : foodSearchScheduler) : options.scheduler;

  try {
    let response: FetchResponse | null = null;
    let payload: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const request = async () => {
          if (options.signal?.aborted) throw new Error('Search canceled');
          const controller = new AbortController();
          const cancel = () => controller.abort();
          options.signal?.addEventListener('abort', cancel, { once: true });
          const timeout = setTimeout(cancel, options.timeoutMs ?? 12_000);
          try {
            const result = await fetcher(url, { headers: requestHeaders, signal: controller.signal });
            // Keep the timeout active through body decoding, not just headers.
            const body = result.ok ? await result.json() : null;
            return { result, body };
          } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', cancel); }
        };
        const fetched = scheduler ? await scheduler.schedule(request) : await request();
        response = fetched.result; payload = fetched.body;
        if (response.status === 429 && scheduler) scheduler.defer(Math.min(retryAfterMilliseconds(response.headers?.get('retry-after')) ?? 6_100, 60_000));
        if (response.ok || !isRetryableProviderFailure(response) || response.status === 429 || attempt === 1) break;
      } catch (error) {
        if (options.signal?.aborted || error instanceof SyntaxError || attempt === 1) throw error;
      }
    }
    if (!response) throw new Error('No search response');
    if (!response.ok) {
      return { status: 'error', products: [], message: response.status === 429 ? 'The food database is busy. Wait a minute, then try Search again. Your saved foods are still available.' : 'The food database is unavailable right now. Try again, or use Recent, Saved, or manual entry.' };
    }

    if (!isRecord(payload) || !Array.isArray(payload.products)) {
      return { status: 'error', products: [], message: 'Food search returned an unreadable result. You can add the product manually.' };
    }

    const normalizedProducts = payload.products.flatMap((candidate) => {
      if (!isRecord(candidate)) return [];
      const barcode = typeof candidate.code === 'string' ? candidate.code.trim() : '';
      if (!barcode) return [];
      const normalized = normalizeOpenFoodFactsProduct(barcode, candidate as OpenFoodFactsProduct);
      return normalized ? [normalized] : [];
    });

    if (options.signal?.aborted) throw new Error('Search canceled');
    const products = rankFoodSearchResults(normalizedProducts, searchTerms);
    const result: ProductSearchResult = products.length
      ? { status: 'found', products }
      : { status: 'empty', products: [], message: 'No foods matched. Try a simpler name or include the brand. You can also scan or enter the label.' };
    if (!options.fetcher) {
      if (foodSearchCache.size >= 30) foodSearchCache.delete(foodSearchCache.keys().next().value!);
      foodSearchCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, result });
    }
    return result;
  } catch (error) {
    return { status: 'error', products: [], message: options.signal?.aborted ? 'Search canceled.' : error instanceof SyntaxError ? 'Food search returned an unreadable response. Try Search again.' : 'Food search could not connect. Try again, or choose a Recent or Saved food.' };
  }
}

const foodSearchScheduler = new ProviderRequestScheduler({ minimumIntervalMs: 6_100 });
const foodSearchCache = new Map<string, { expiresAt: number; result: ProductSearchResult }>();
const labelScheduler = new ProviderRequestScheduler({ minimumIntervalMs: 6_100 });

/**
 * Full label records for a list of barcodes, in one request, keyed by barcode identity.
 *
 * Search indexes leave out label servings and ingredients; this fills them in. It is
 * given a short budget, waiting included, and a failure returns nothing: the caller keeps
 * what it had, which still logs per 100 g.
 * https://openfoodfacts.github.io/openfoodfacts-server/api/ref-cheatsheet/#get-data-for-a-list-of-products
 */
export async function fetchLabelsByCode(codes: readonly string[], options: {
  fetcher?: ProductLookupFetch; signal?: AbortSignal; budgetMs?: number; locale?: string;
} = {}): Promise<Map<string, Record<string, unknown>>> {
  const labels = new Map<string, Record<string, unknown>>();
  const wanted = [...new Set(codes.filter((code) => /^\d{8,14}$/.test(code)))].slice(0, 30);
  if (!wanted.length || options.signal?.aborted) return labels;
  const fetcher = options.fetcher ?? (fetch as unknown as ProductLookupFetch);
  const url = `https://world.openfoodfacts.org/api/v2/search?code=${wanted.join(',')}&fields=${productFields(options.locale)}&page_size=${wanted.length}`;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, options.budgetMs ?? 4_000);
  try {
    const request = async () => {
      if (controller.signal.aborted) throw new Error('Label budget spent');
      const response = await fetcher(url, { headers: requestHeaders, signal: controller.signal });
      return response.ok ? await response.json() : null;
    };
    const body = options.fetcher ? await request() : await labelScheduler.schedule(request);
    if (isRecord(body) && Array.isArray(body.products)) {
      for (const product of body.products) {
        if (isRecord(product) && typeof product.code === 'string') labels.set(canonicalBarcodeIdentity(product.code), product);
      }
    }
  } catch {
    // Labels are an improvement on the answer, never a condition of it.
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
  return labels;
}

/**
 * The keyword search URL. Brand and country filters use the endpoint's tag criteria, which
 * combine with the words: "almond butter" inside the kirkland-signature brand, or "greek
 * yogurt" among products sold in the United States.
 */
export function buildFoodSearchUrl(query: string, locale = 'en', filters: { brandTag?: string; countryTag?: string } = {}) {
  const tags = ([['brands', filters.brandTag], ['countries', filters.countryTag]] as const)
    .filter((entry): entry is readonly ['brands' | 'countries', string] => Boolean(entry[1]))
    .map(([type, tag], index) => `&tagtype_${index}=${type}&tag_contains_${index}=contains&tag_${index}=${encodeURIComponent(tag)}`)
    .join('');
  return `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1&fields=${productFields(locale)}&page_size=24${tags}`;
}
const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
export function rankFoodSearchResults(products: HealthiProductSnapshot[], query: string) {
  const phrase = searchable(query.trim());
  const terms = phrase.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  return products.filter(p => { const id = canonicalBarcodeIdentity(p.barcode); if (seen.has(id)) return false; seen.add(id); return true; })
    .map((product, index) => {
      const name = searchable(product.name), brand = searchable(product.brand ?? '');
      const relevance = (name === phrase ? 30 : name.startsWith(`${phrase} `) ? 14 : name.includes(phrase) ? 8 : 0)
        + terms.reduce((n, term) => n + (name.includes(term) ? 2 : 0) + (brand.includes(term) ? 1 : 0), 0);
      return { product, relevance, index };
    }).sort((a, b) => b.relevance - a.relevance || a.index - b.index).map(row => row.product);
}

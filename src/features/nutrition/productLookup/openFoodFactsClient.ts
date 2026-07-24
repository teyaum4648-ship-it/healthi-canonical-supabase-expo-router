import { barcodeLookupCandidates, validateBarcode } from './barcodeUtils';
import { normalizeOpenFoodFactsProduct, type OpenFoodFactsProduct } from './normalizeProduct';
import type { HealthiProductSnapshot, ProductLookupResult } from './productLookupTypes';

type FetchResponse = {
  ok: boolean;
  status?: number;
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

async function fetchProductWithRetry(
  fetcher: ProductLookupFetch,
  url: string,
  timeoutMs: number
): Promise<FetchResponse> {
  const maximumAttempts = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetcher, url, timeoutMs);
      if (response.ok || !isRetryableProviderFailure(response) || attempt === maximumAttempts - 1) return response;
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

  try {
    for (const candidate of barcodeLookupCandidates(barcode)) {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(candidate)}.json?fields=${productFields(options.locale)}`;
      const response = await fetchProductWithRetry(fetcher, url, timeoutMs);
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
  if (searchTerms.length < 2) {
    return { status: 'empty', products: [], message: 'Enter at least two letters to search foods.' };
  }

  const fetcher = options.fetcher ?? (fetch as unknown as ProductLookupFetch);
  const url = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=&search_terms=${encodeURIComponent(searchTerms)}&fields=${productFields(options.locale)}&page_size=12`;

  try {
    const response = await fetchWithTimeout(fetcher, url, options.timeoutMs ?? 12_000);
    if (!response.ok) {
      return { status: 'error', products: [], message: 'Food search is unavailable right now. You can add the product manually.' };
    }

    const payload = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.products)) {
      return { status: 'error', products: [], message: 'Food search returned an unreadable result. You can add the product manually.' };
    }

    const products = payload.products.flatMap((candidate) => {
      if (!isRecord(candidate)) return [];
      const barcode = typeof candidate.code === 'string' ? candidate.code.trim() : '';
      if (!barcode) return [];
      const normalized = normalizeOpenFoodFactsProduct(barcode, candidate as OpenFoodFactsProduct);
      return normalized ? [normalized] : [];
    });

    if (products.length === 0) {
      return { status: 'empty', products: [], message: 'No readable foods matched that search. You can add one manually.' };
    }

    return { status: 'found', products };
  } catch {
    return { status: 'error', products: [], message: 'Food search could not connect. You can add the product manually.' };
  }
}

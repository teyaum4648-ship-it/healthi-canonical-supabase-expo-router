import { validateBarcode } from './barcodeUtils';
import { normalizeOpenFoodFactsProduct, type OpenFoodFactsProduct } from './normalizeProduct';
import type { HealthiProductSnapshot, ProductLookupResult } from './productLookupTypes';

type FetchResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type ProductLookupFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

export type OpenFoodFactsLookupOptions = {
  fetcher?: ProductLookupFetch;
};

export type ProductSearchResult =
  | { status: 'found'; products: HealthiProductSnapshot[] }
  | { status: 'empty'; products: HealthiProductSnapshot[]; message: string }
  | { status: 'error'; products: HealthiProductSnapshot[]; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const productFields = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'serving_size',
  'serving_quantity',
  'ingredients_text',
  'nova_group',
  'additives_n',
  'nutriments'
].join(',');

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
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${productFields}`;

  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' } });
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

    if (payload.status === 0 || !isRecord(payload.product)) {
      return {
        status: 'not_found',
        barcode,
        message: 'No product was found for this barcode. You can still log it manually.'
      };
    }

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
  const url = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=&search_terms=${encodeURIComponent(searchTerms)}&fields=${productFields}&page_size=12`;

  try {
    const response = await fetcher(url, { headers: { Accept: 'application/json' } });
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

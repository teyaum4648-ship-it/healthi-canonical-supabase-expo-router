import { validateBarcode } from './barcodeUtils';
import { normalizeOpenFoodFactsProduct, type OpenFoodFactsProduct } from './normalizeProduct';
import type { ProductLookupResult } from './productLookupTypes';

type FetchResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type ProductLookupFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

export type OpenFoodFactsLookupOptions = {
  fetcher?: ProductLookupFetch;
};

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

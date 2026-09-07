import { canonicalGtin } from './barcodeUtils';
import { lookupOpenFoodFactsProduct } from './openFoodFactsClient';
import type { HealthiProductSnapshot, ProductLookupResult } from './productLookupTypes';

type FunctionInvokeError = {
  message?: string;
  name?: string;
  status?: number;
  context?: unknown;
};

type InvokeResult = { data: unknown; error: FunctionInvokeError | null };
export type ProductResolverFunctionClient = {
  functions: { invoke(name: string, options: { body: Record<string, unknown> }): Promise<InvokeResult> };
};

export type ProductLookupFallback = (barcode: string) => Promise<ProductLookupResult>;
export type ProductResolverErrorCode =
  | 'not_configured'
  | 'function_not_deployed'
  | 'auth_required'
  | 'forbidden'
  | 'rate_limited'
  | 'timeout'
  | 'network_error'
  | 'function_error'
  | 'malformed_response'
  | 'provider_unavailable';

export type ProductResolverAttempt = {
  provider: 'canonical_resolver' | 'open_food_facts';
  status: 'skipped' | 'found' | 'not_found' | 'unavailable' | 'error';
  durationMs: number;
  httpStatus: number | null;
  errorCode: ProductResolverErrorCode | null;
};

export type ProductResolverDiagnostics = {
  barcode: string;
  cacheStatus: 'miss' | 'recent_result';
  attempts: ProductResolverAttempt[];
  finalState: 'found' | 'identity_unresolved' | 'provider_unavailable';
};

export type ProductResolverLookupResult = ProductLookupResult & {
  resolverDiagnostics: ProductResolverDiagnostics;
};

type ProductResolverRequestState = {
  inFlightLookups: Map<string, Promise<ProductResolverLookupResult>>;
  recentLookups: Map<string, { expiresAt: number; result: ProductResolverLookupResult }>;
};

type ResolverRuntime = typeof globalThis & {
  __healthiProductResolverRequestState?: ProductResolverRequestState;
};

const resolverRuntime = globalThis as ResolverRuntime;
const requestState = resolverRuntime.__healthiProductResolverRequestState ?? {
  inFlightLookups: new Map<string, Promise<ProductResolverLookupResult>>(),
  recentLookups: new Map<string, { expiresAt: number; result: ProductResolverLookupResult }>()
};
resolverRuntime.__healthiProductResolverRequestState = requestState;
const { inFlightLookups, recentLookups } = requestState;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSnapshot(value: unknown): value is HealthiProductSnapshot {
  if (!isRecord(value)) return false;
  return typeof value.barcode === 'string'
    && typeof value.name === 'string'
    && typeof value.provider === 'string'
    && Array.isArray(value.quality_flags)
    && Array.isArray(value.reason_codes)
    && ['low', 'medium', 'high'].includes(String(value.confidence));
}

function statusFromError(error: FunctionInvokeError | null): number | null {
  if (typeof error?.status === 'number') return error.status;
  if (isRecord(error?.context) && typeof error.context.status === 'number') return error.context.status;
  return null;
}

export function classifyProductResolverError(error: FunctionInvokeError | null): {
  code: ProductResolverErrorCode;
  httpStatus: number | null;
} {
  const httpStatus = statusFromError(error);
  const message = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (httpStatus === 401) return { code: 'auth_required', httpStatus };
  if (httpStatus === 403) return { code: 'forbidden', httpStatus };
  if (httpStatus === 404 || /function.*(not found|missing)|not deployed/.test(message)) {
    return { code: 'function_not_deployed', httpStatus };
  }
  if (httpStatus === 408 || /timed?\s*out|abort/.test(message)) return { code: 'timeout', httpStatus };
  if (httpStatus === 429) return { code: 'rate_limited', httpStatus };
  if (typeof httpStatus === 'number' && httpStatus >= 500) return { code: 'function_error', httpStatus };
  if (/network|fetch|connect|offline/.test(message)) return { code: 'network_error', httpStatus };
  return { code: 'function_error', httpStatus };
}

function finalState(result: ProductLookupResult): ProductResolverDiagnostics['finalState'] {
  if (result.status === 'found') return 'found';
  if (result.status === 'not_found' || result.status === 'identity_unresolved') return 'identity_unresolved';
  return 'provider_unavailable';
}

function withDiagnostics(
  result: ProductLookupResult,
  barcode: string,
  attempts: ProductResolverAttempt[],
  cacheStatus: ProductResolverDiagnostics['cacheStatus'] = 'miss'
): ProductResolverLookupResult {
  return {
    ...result,
    resolverDiagnostics: { barcode, cacheStatus, attempts, finalState: finalState(result) }
  } as ProductResolverLookupResult;
}

function logResolution(result: ProductResolverLookupResult): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.info('[healthi.scanner.product_resolution]', JSON.stringify(result.resolverDiagnostics));
}

function fallbackAttempt(result: ProductLookupResult, durationMs: number): ProductResolverAttempt {
  if (result.status === 'found') {
    return { provider: 'open_food_facts', status: 'found', durationMs, httpStatus: null, errorCode: null };
  }
  if (result.status === 'not_found' || result.status === 'identity_unresolved') {
    return { provider: 'open_food_facts', status: 'not_found', durationMs, httpStatus: null, errorCode: null };
  }
  const errorCode: ProductResolverErrorCode = result.status === 'error'
    ? result.code === 'network_error' ? 'network_error'
      : result.code === 'malformed_response' ? 'malformed_response'
        : 'provider_unavailable'
    : 'provider_unavailable';
  return { provider: 'open_food_facts', status: 'unavailable', durationMs, httpStatus: null, errorCode };
}

async function lookupPublicLabelFallback(
  gtin: string,
  fallbackLookup: ProductLookupFallback,
  attempts: ProductResolverAttempt[]
): Promise<ProductResolverLookupResult> {
  const startedAt = Date.now();
  try {
    const fallback = await fallbackLookup(gtin);
    attempts.push(fallbackAttempt(fallback, Date.now() - startedAt));
    if (fallback.status === 'found') return withDiagnostics(fallback, gtin, attempts);
    if (fallback.status === 'not_found' || fallback.status === 'identity_unresolved') {
      return withDiagnostics({
        status: 'identity_unresolved', barcode: gtin, message: fallback.message
      }, gtin, attempts);
    }
    return withDiagnostics({
      status: 'provider_unavailable', barcode: gtin, message: fallback.message
    }, gtin, attempts);
  } catch {
    attempts.push({
      provider: 'open_food_facts', status: 'error', durationMs: Date.now() - startedAt,
      httpStatus: null, errorCode: 'network_error'
    });
    return withDiagnostics({
      status: 'provider_unavailable', barcode: gtin, message: 'Product providers are temporarily unavailable.'
    }, gtin, attempts);
  }
}

async function resolveProductOnce(params: {
  gtin: string;
  client?: ProductResolverFunctionClient | null;
  configured: boolean;
  fallbackLookup: ProductLookupFallback;
}): Promise<ProductResolverLookupResult> {
  const attempts: ProductResolverAttempt[] = [];
  if (!params.configured || !params.client) {
    attempts.push({
      provider: 'canonical_resolver', status: 'skipped', durationMs: 0,
      httpStatus: null, errorCode: 'not_configured'
    });
    return lookupPublicLabelFallback(params.gtin, params.fallbackLookup, attempts);
  }

  const startedAt = Date.now();
  try {
    const { data, error } = await params.client.functions.invoke('product-data-resolve', {
      body: { barcode: params.gtin }
    });
    const durationMs = Date.now() - startedAt;
    if (error) {
      const normalized = classifyProductResolverError(error);
      attempts.push({
        provider: 'canonical_resolver', status: 'error', durationMs,
        httpStatus: normalized.httpStatus, errorCode: normalized.code
      });
      return lookupPublicLabelFallback(params.gtin, params.fallbackLookup, attempts);
    }
    if (!isRecord(data)) {
      attempts.push({
        provider: 'canonical_resolver', status: 'error', durationMs,
        httpStatus: null, errorCode: 'malformed_response'
      });
      return lookupPublicLabelFallback(params.gtin, params.fallbackLookup, attempts);
    }
    if (data.status === 'resolved' && isSnapshot(data.product)) {
      attempts.push({
        provider: 'canonical_resolver', status: 'found', durationMs,
        httpStatus: null, errorCode: null
      });
      return withDiagnostics({ status: 'found', product: data.product }, params.gtin, attempts);
    }
    if (data.status === 'identity_unresolved') {
      attempts.push({
        provider: 'canonical_resolver', status: 'not_found', durationMs,
        httpStatus: null, errorCode: null
      });
      return withDiagnostics({
        status: 'identity_unresolved', barcode: params.gtin,
        message: typeof data.message === 'string' ? data.message : 'No exact product identity was found.'
      }, params.gtin, attempts);
    }
    attempts.push({
      provider: 'canonical_resolver',
      status: data.status === 'provider_unavailable' ? 'unavailable' : 'error',
      durationMs,
      httpStatus: null,
      errorCode: data.status === 'provider_unavailable' ? 'provider_unavailable' : 'malformed_response'
    });
    return lookupPublicLabelFallback(params.gtin, params.fallbackLookup, attempts);
  } catch (error) {
    const normalized = classifyProductResolverError(error instanceof Error ? error : null);
    attempts.push({
      provider: 'canonical_resolver', status: 'error', durationMs: Date.now() - startedAt,
      httpStatus: normalized.httpStatus, errorCode: normalized.code
    });
    return lookupPublicLabelFallback(params.gtin, params.fallbackLookup, attempts);
  }
}

export function clearProductResolverRequestState(): void {
  inFlightLookups.clear();
  recentLookups.clear();
}

export async function lookupResolvedProduct(params: {
  barcode: string;
  client?: ProductResolverFunctionClient | null;
  configured: boolean;
  fallbackLookup?: ProductLookupFallback;
  recentResultTtlMs?: number;
}): Promise<ProductResolverLookupResult> {
  const gtin = canonicalGtin(params.barcode);
  if (!gtin) {
    return withDiagnostics({
      status: 'identity_unresolved', barcode: params.barcode,
      message: 'Use a complete barcode with a valid check digit.'
    }, params.barcode, []);
  }

  const requestKey = `${params.configured && params.client ? 'canonical' : 'public'}:${gtin}`;
  const recent = recentLookups.get(requestKey);
  if (recent && recent.expiresAt > Date.now()) {
    const result = withDiagnostics(recent.result, gtin, [], 'recent_result');
    logResolution(result);
    return result;
  }
  if (recent) recentLookups.delete(requestKey);

  const existing = inFlightLookups.get(requestKey);
  if (existing) return existing;

  const lookup = resolveProductOnce({
    gtin,
    client: params.client,
    configured: params.configured,
    fallbackLookup: params.fallbackLookup ?? lookupOpenFoodFactsProduct
  }).then((result) => {
    const defaultTtl = result.status === 'found' ? 5 * 60_000
      : result.status === 'identity_unresolved' ? 30_000
        : 0;
    const ttl = params.recentResultTtlMs ?? defaultTtl;
    if (ttl > 0) recentLookups.set(requestKey, { expiresAt: Date.now() + ttl, result });
    logResolution(result);
    return result;
  }).finally(() => {
    inFlightLookups.delete(requestKey);
  });

  inFlightLookups.set(requestKey, lookup);
  return lookup;
}

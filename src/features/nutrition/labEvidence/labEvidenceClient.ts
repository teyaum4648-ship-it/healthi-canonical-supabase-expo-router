import { canonicalBarcodeIdentity } from '../productLookup/barcodeUtils';
import type { HealthiProductSnapshot } from '../productLookup/productLookupTypes';
import { clientSafeResolution, createTerminalResolution, emptyLabEvidenceIdentity } from './resolution';
import type { LabEvidenceResolution } from './labEvidenceTypes';

type FunctionInvokeError = {
  message?: string;
  name?: string;
  status?: number;
  context?: unknown;
};

type InvokeResult = { data: unknown; error: FunctionInvokeError | null };
export type LabEvidenceFunctionClient = {
  functions: { invoke(name: string, options: { body: Record<string, unknown> }): Promise<InvokeResult> };
};

export type LabEvidenceSemanticState =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'none_found'
  | 'unavailable'
  | 'not_configured'
  | 'auth_error'
  | 'identity_unresolved';

export type LabEvidenceClientErrorCode =
  | 'disabled'
  | 'not_configured'
  | 'function_not_deployed'
  | 'auth_required'
  | 'forbidden'
  | 'rate_limited'
  | 'timeout'
  | 'network_error'
  | 'function_error'
  | 'malformed_response';

export type LabEvidenceClientState = {
  state: LabEvidenceSemanticState;
  resolution: LabEvidenceResolution | null;
  errorCode: LabEvidenceClientErrorCode | null;
  retryCount: number;
  stale: boolean;
  durationMs: number;
  httpStatus: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function identityFromProduct(product: HealthiProductSnapshot, lotNumber?: string | null) {
  return emptyLabEvidenceIdentity({
    barcode: product.barcode,
    canonicalBarcode: product.canonical_barcode ?? (canonicalBarcodeIdentity(product.barcode) || null),
    productName: product.name,
    brand: product.brand ?? null,
    variant: product.variant ?? null,
    size: product.quantity ?? null,
    lotNumber: lotNumber ?? null,
    categoryKeys: [...(product.categories_tags ?? [])]
  });
}

function isResolution(value: unknown): value is LabEvidenceResolution {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LabEvidenceResolution>;
  return candidate.schemaVersion === 2
    && typeof candidate.status === 'string'
    && Array.isArray(candidate.labEvidence)
    && Array.isArray(candidate.certifications)
    && Array.isArray(candidate.regulatoryAlerts)
    && Array.isArray(candidate.relatedEvidence)
    && Array.isArray(candidate.categoryContext);
}

function statusFromError(error: FunctionInvokeError | null): number | null {
  if (typeof error?.status === 'number') return error.status;
  if (isRecord(error?.context) && typeof error.context.status === 'number') return error.context.status;
  return null;
}

export function classifyLabEvidenceError(error: FunctionInvokeError | null): {
  code: LabEvidenceClientErrorCode;
  state: Extract<LabEvidenceSemanticState, 'unavailable' | 'not_configured' | 'auth_error'>;
  retryable: boolean;
  httpStatus: number | null;
  retryAfterMs: number | null;
} {
  const httpStatus = statusFromError(error);
  const message = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase();
  const contextHeaders = isRecord(error?.context) && isRecord(error.context.headers)
    ? error.context.headers
    : null;
  const retryAfter = contextHeaders && typeof contextHeaders.get === 'function'
    ? String(contextHeaders.get('retry-after') ?? '')
    : '';
  const retrySeconds = Number(retryAfter);
  const retryAfterMs = Number.isFinite(retrySeconds) && retrySeconds >= 0 ? retrySeconds * 1_000 : null;

  if (httpStatus === 401) return { code: 'auth_required', state: 'auth_error', retryable: false, httpStatus, retryAfterMs };
  if (httpStatus === 403) return { code: 'forbidden', state: 'auth_error', retryable: false, httpStatus, retryAfterMs };
  if (httpStatus === 404 || /function.*(not found|missing)|not deployed/.test(message)) {
    return { code: 'function_not_deployed', state: 'not_configured', retryable: false, httpStatus, retryAfterMs };
  }
  if (httpStatus === 408 || /timed?\s*out|abort/.test(message)) {
    return { code: 'timeout', state: 'unavailable', retryable: true, httpStatus, retryAfterMs };
  }
  if (httpStatus === 429) return { code: 'rate_limited', state: 'unavailable', retryable: true, httpStatus, retryAfterMs };
  if (typeof httpStatus === 'number' && httpStatus >= 500) {
    return { code: 'function_error', state: 'unavailable', retryable: true, httpStatus, retryAfterMs };
  }
  if (/network|fetch|connect|offline/.test(message)) {
    return { code: 'network_error', state: 'unavailable', retryable: true, httpStatus, retryAfterMs };
  }
  return { code: 'function_error', state: 'unavailable', retryable: true, httpStatus, retryAfterMs };
}

function exactEvidenceAvailable(resolution: LabEvidenceResolution): boolean {
  return resolution.labEvidence.some((item) => (
    item.matchLevel === 'exact_lot'
    || item.matchLevel === 'exact_product'
    || item.matchLevel === 'exact_product_different_lot'
  )) || resolution.certifications.some((item) => item.scope === 'product')
    || resolution.regulatoryAlerts.some((item) => (
      item.matchLevel === 'exact_lot' || item.matchLevel === 'exact_product'
    ));
}

function stateFromResolution(resolution: LabEvidenceResolution): LabEvidenceSemanticState {
  if (resolution.status === 'identity_unresolved') return 'identity_unresolved';
  if (resolution.status === 'unavailable') {
    return resolution.availabilityReason === 'not_configured' || resolution.availabilityReason === 'source_disabled'
      ? 'not_configured'
      : 'unavailable';
  }
  return exactEvidenceAvailable(resolution) ? 'available' : 'none_found';
}

function logLabEvidence(state: LabEvidenceClientState, barcode: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.info('[healthi.scanner.lab_evidence]', JSON.stringify({
    barcode,
    functionName: 'lab-evidence-lookup',
    enabled: state.state !== 'disabled',
    durationMs: state.durationMs,
    httpStatus: state.httpStatus,
    semanticState: state.state,
    retryCount: state.retryCount,
    errorCode: state.errorCode,
    stale: state.stale
  }));
}

export function initialLabEvidenceClientState(enabled: boolean): LabEvidenceClientState {
  return {
    state: enabled ? 'idle' : 'disabled',
    resolution: null,
    errorCode: enabled ? null : 'disabled',
    retryCount: 0,
    stale: false,
    durationMs: 0,
    httpStatus: null
  };
}

export async function lookupLabEvidenceState(params: {
  enabled: boolean;
  client?: LabEvidenceFunctionClient | null;
  product: HealthiProductSnapshot;
  lotNumber?: string | null;
  configured: boolean;
  previous?: LabEvidenceClientState | null;
  maximumAttempts?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<LabEvidenceClientState> {
  if (!params.enabled) return initialLabEvidenceClientState(false);
  if (!params.configured || !params.client) {
    const state: LabEvidenceClientState = {
      state: 'not_configured', resolution: null, errorCode: 'not_configured', retryCount: 0,
      stale: false, durationMs: 0, httpStatus: null
    };
    logLabEvidence(state, params.product.barcode);
    return state;
  }

  const identity = identityFromProduct(params.product, params.lotNumber);
  const maximumAttempts = Math.min(2, Math.max(1, params.maximumAttempts ?? 2));
  const sleep = params.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const startedAt = Date.now();
  let lastFailure: LabEvidenceClientState | null = null;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      const { data, error } = await params.client.functions.invoke('lab-evidence-lookup', { body: { identity } });
      if (!error && isResolution(data)) {
        const state: LabEvidenceClientState = {
          state: stateFromResolution(data), resolution: data, errorCode: null,
          retryCount: attempt, stale: false, durationMs: Date.now() - startedAt, httpStatus: null
        };
        logLabEvidence(state, params.product.barcode);
        return state;
      }

      const normalized = error
        ? classifyLabEvidenceError(error)
        : { code: 'malformed_response' as const, state: 'unavailable' as const, retryable: false, httpStatus: null, retryAfterMs: null };
      lastFailure = {
        state: normalized.state, resolution: null, errorCode: normalized.code,
        retryCount: attempt, stale: false, durationMs: Date.now() - startedAt, httpStatus: normalized.httpStatus
      };
      if (!normalized.retryable || attempt === maximumAttempts - 1) break;
      await sleep(normalized.retryAfterMs ?? params.retryDelayMs ?? 500);
    } catch (error) {
      const normalized = classifyLabEvidenceError(error instanceof Error ? error : null);
      lastFailure = {
        state: normalized.state, resolution: null, errorCode: normalized.code,
        retryCount: attempt, stale: false, durationMs: Date.now() - startedAt, httpStatus: normalized.httpStatus
      };
      if (!normalized.retryable || attempt === maximumAttempts - 1) break;
      await sleep(normalized.retryAfterMs ?? params.retryDelayMs ?? 500);
    }
  }

  const previous = params.previous;
  if (previous?.resolution && (previous.state === 'available' || previous.state === 'none_found')) {
    const preserved: LabEvidenceClientState = {
      ...previous,
      errorCode: lastFailure?.errorCode ?? 'function_error',
      retryCount: lastFailure?.retryCount ?? 0,
      stale: true,
      durationMs: Date.now() - startedAt,
      httpStatus: lastFailure?.httpStatus ?? null
    };
    logLabEvidence(preserved, params.product.barcode);
    return preserved;
  }

  const state = lastFailure ?? {
    state: 'unavailable' as const, resolution: null, errorCode: 'function_error' as const,
    retryCount: 0, stale: false, durationMs: Date.now() - startedAt, httpStatus: null
  };
  logLabEvidence(state, params.product.barcode);
  return state;
}

export async function lookupLabEvidenceResolution(params: {
  client?: LabEvidenceFunctionClient | null;
  product: HealthiProductSnapshot;
  lotNumber?: string | null;
  configured: boolean;
}): Promise<LabEvidenceResolution> {
  const state = await lookupLabEvidenceState({ ...params, enabled: true, maximumAttempts: 1 });
  if (state.resolution) return state.resolution;
  const identity = identityFromProduct(params.product, params.lotNumber);
  return clientSafeResolution(createTerminalResolution({
    status: 'unavailable',
    identity,
    reasonCodes: [`lab_evidence_${state.errorCode ?? 'function_error'}`],
    availabilityReason: state.state === 'not_configured' ? 'not_configured' : 'temporarily_unavailable',
    sourcesChecked: [],
    retryable: state.state === 'unavailable'
  }));
}

export function labEvidenceStatusCopy(resolution: LabEvidenceResolution): { title: string; detail: string } {
  const copies: Record<LabEvidenceResolution['status'], { title: string; detail: string }> = {
    exact_lot: { title: 'Exact lot evidence', detail: 'Evidence was matched to the entered lot and product identity.' },
    exact_product: { title: 'Exact product evidence', detail: 'Evidence was matched to this product; the tested lot may differ.' },
    manufacturer_coa: { title: 'Manufacturer-provided evidence', detail: 'A manufacturer certificate or report is available for this product.' },
    current_certification: { title: 'Current certification', detail: 'A current certification record is available. Certification is not a numeric lab result.' },
    regulatory_alert: { title: 'Regulatory status', detail: 'An official alert was conservatively matched to this product or lot.' },
    related_variant: { title: 'Related variant evidence', detail: 'Evidence exists for a related variant, not the scanned product.' },
    brand_evidence: { title: 'Brand-level evidence', detail: 'Evidence exists at brand scope and does not establish results for this product.' },
    category_context: { title: 'Evidence context', detail: 'Category context is available. It is not testing of the scanned product.' },
    no_evidence: { title: 'No evidence found', detail: 'No current matching evidence was found in the sources checked. This is not negative evidence.' },
    unavailable: { title: 'Evidence lookup unavailable', detail: 'Lab Evidence could not be checked right now. Product Quality is unaffected.' },
    identity_unresolved: { title: 'Product identity unresolved', detail: 'A reliable product identity is needed before evidence can be matched.' }
  };
  return copies[resolution.status];
}

export function labEvidenceClientStateCopy(state: LabEvidenceClientState): { title: string; detail: string } {
  if (state.resolution) return labEvidenceStatusCopy(state.resolution);
  const copy: Record<LabEvidenceSemanticState, { title: string; detail: string }> = {
    disabled: { title: '', detail: '' },
    idle: { title: 'Evidence check ready', detail: 'Lab Evidence can be checked independently from Product Quality.' },
    checking: { title: 'Checking current evidence…', detail: 'Product Quality is ready while this optional check runs.' },
    available: { title: 'Verified information available', detail: 'Exact-product information is available.' },
    none_found: { title: 'No exact-product evidence found', detail: 'The checked sources contain no reliable exact-product evidence. This is not negative evidence.' },
    unavailable: { title: 'Evidence check unavailable', detail: 'This optional check could not finish. Product Quality is unaffected.' },
    not_configured: { title: 'Evidence check not configured', detail: 'Lab Evidence is not configured in this build. Product Quality is unaffected.' },
    auth_error: { title: 'Evidence check needs sign-in', detail: 'This optional check could not authenticate. Product Quality is unaffected.' },
    identity_unresolved: { title: 'Evidence identity unresolved', detail: 'Exact-product evidence requires a reliable product identity.' }
  };
  return copy[state.state];
}

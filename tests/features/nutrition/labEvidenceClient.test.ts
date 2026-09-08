import { describe, expect, it, vi } from 'vitest';

import {
  classifyLabEvidenceError,
  initialLabEvidenceClientState,
  labEvidenceClientStateCopy,
  labEvidenceStatusCopy,
  lookupLabEvidenceResolution,
  lookupLabEvidenceState
} from '../../../src/features/nutrition/labEvidence/labEvidenceClient';
import { clientSafeResolution, createTerminalResolution, emptyLabEvidenceIdentity, toLabEvidenceReferenceSnapshot } from '../../../src/features/nutrition/labEvidence/resolution';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import { productSnapshotValue, toUserFoodProductInsert } from '../../../src/features/nutrition/productLibraryPersistence';

const product: HealthiProductSnapshot = {
  barcode: '012345678905', canonical_barcode: '012345678905', provider: 'open_food_facts',
  name: 'Fixture oats', brand: 'Fixture Foods', categories_tags: ['breakfast-cereals'],
  calories_per_serving: 180, protein_g: 6, carbs_g: 32, fat_g: 3, fiber_g: 5, sugar_g: 2, sodium_mg: 80,
  ingredients_text: 'whole oats, seeds', quality_flags: [], confidence: 'high', reason_codes: ['product_label_data']
};

describe('Lab Evidence V2 client boundary', () => {
  it('keeps the legacy DTO boundary unavailable but non-retryable when the service is unconfigured', async () => {
    const result = await lookupLabEvidenceResolution({ product, configured: false });
    expect(result).toMatchObject({
      status: 'unavailable',
      retryable: false,
      availabilityReason: 'not_configured'
    });
    expect(labEvidenceStatusCopy(result).title).toBe('Evidence lookup unavailable');
  });

  it('makes zero requests while disabled and distinguishes missing configuration', async () => {
    const client = { functions: { invoke: vi.fn() } };
    await expect(lookupLabEvidenceState({
      enabled: false, configured: true, client, product
    })).resolves.toEqual(initialLabEvidenceClientState(false));
    expect(client.functions.invoke).not.toHaveBeenCalled();

    const notConfigured = await lookupLabEvidenceState({ enabled: true, configured: false, client, product });
    expect(notConfigured).toMatchObject({ state: 'not_configured', errorCode: 'not_configured', resolution: null });
    expect(labEvidenceClientStateCopy(notConfigured).title).toBe('Evidence check not configured');
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });

  it('maps exact-product evidence to available and non-exact context to none found', async () => {
    const exact = clientSafeResolution(createTerminalResolution({
      status: 'exact_product',
      identity: emptyLabEvidenceIdentity({ barcode: product.barcode, productName: product.name }),
      labEvidence: [{
        evidenceId: 'exact-1', sourceName: 'Reviewed fixture', sourceType: 'independent_lab_test',
        provenance: 'independent', matchLevel: 'exact_product', matchReason: 'Exact GTIN fixture match.',
        sampleDate: null, publicationDate: null, freshness: 'current', laboratory: null,
        laboratoryAccreditation: null, testingMethod: null, sampleAcquisition: 'unknown', analytes: [], confidence: 'high'
      }]
    }));
    const brandOnly = clientSafeResolution(createTerminalResolution({
      status: 'brand_evidence',
      identity: exact.identity,
      relatedEvidence: [{
        contextId: 'brand-1', title: 'Different product evidence', sourceName: 'Reviewed fixture',
        scope: 'brand', matchReason: 'Brand only.', summary: 'Not this product.', publicationDate: null, confidence: 'medium'
      }]
    }));

    const exactClient = { functions: { invoke: vi.fn().mockResolvedValue({ data: exact, error: null }) } };
    await expect(lookupLabEvidenceState({ enabled: true, configured: true, client: exactClient, product }))
      .resolves.toMatchObject({ state: 'available', resolution: exact });

    const contextClient = { functions: { invoke: vi.fn().mockResolvedValue({ data: brandOnly, error: null }) } };
    await expect(lookupLabEvidenceState({ enabled: true, configured: true, client: contextClient, product }))
      .resolves.toMatchObject({ state: 'none_found', resolution: brandOnly });
  });

  it.each([
    [401, 'auth_error', 'auth_required', false],
    [403, 'auth_error', 'forbidden', false],
    [404, 'not_configured', 'function_not_deployed', false],
    [408, 'unavailable', 'timeout', true],
    [429, 'unavailable', 'rate_limited', true],
    [500, 'unavailable', 'function_error', true],
    [502, 'unavailable', 'function_error', true],
    [503, 'unavailable', 'function_error', true]
  ] as const)('classifies HTTP %s as %s', async (status, state, code, retryable) => {
    expect(classifyLabEvidenceError({ status })).toMatchObject({ state, code, retryable, httpStatus: status });
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { status } }) } };
    await expect(lookupLabEvidenceState({
      enabled: true,
      configured: true,
      client,
      product,
      sleep: vi.fn().mockResolvedValue(undefined)
    })).resolves.toMatchObject({ state, errorCode: code, retryCount: retryable ? 1 : 0 });
    expect(client.functions.invoke).toHaveBeenCalledTimes(retryable ? 2 : 1);
  });

  it.each([
    ['network connection failed', 'network_error'],
    ['request timed out', 'timeout']
  ] as const)('normalizes a thrown %s failure', async (message, errorCode) => {
    const client = { functions: { invoke: vi.fn().mockRejectedValue(new Error(message)) } };
    await expect(lookupLabEvidenceState({
      enabled: true,
      configured: true,
      client,
      product,
      sleep: vi.fn().mockResolvedValue(undefined)
    })).resolves.toMatchObject({ state: 'unavailable', errorCode, retryCount: 1 });
    expect(client.functions.invoke).toHaveBeenCalledTimes(2);
  });

  it('distinguishes malformed responses, retries transient failure once, and never loops', async () => {
    const malformedClient = { functions: { invoke: vi.fn().mockResolvedValue({ data: { unexpected: true }, error: null }) } };
    await expect(lookupLabEvidenceState({
      enabled: true, configured: true, client: malformedClient, product
    })).resolves.toMatchObject({ state: 'unavailable', errorCode: 'malformed_response', retryCount: 0 });
    expect(malformedClient.functions.invoke).toHaveBeenCalledTimes(1);

    const terminal = clientSafeResolution(createTerminalResolution({
      status: 'no_evidence', identity: emptyLabEvidenceIdentity({ barcode: product.barcode, productName: product.name })
    }));
    const retryClient = { functions: { invoke: vi.fn()
      .mockResolvedValueOnce({ data: null, error: { status: 503 } })
      .mockResolvedValueOnce({ data: terminal, error: null }) } };
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(lookupLabEvidenceState({
      enabled: true, configured: true, client: retryClient, product, sleep
    })).resolves.toMatchObject({ state: 'none_found', retryCount: 1 });
    expect(retryClient.functions.invoke).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);

    const failedClient = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { status: 429 } }) } };
    await expect(lookupLabEvidenceState({
      enabled: true, configured: true, client: failedClient, product, sleep
    })).resolves.toMatchObject({ state: 'unavailable', errorCode: 'rate_limited', retryCount: 1 });
    expect(failedClient.functions.invoke).toHaveBeenCalledTimes(2);
  });

  it('preserves a previous successful result when a refresh fails', async () => {
    const terminal = clientSafeResolution(createTerminalResolution({
      status: 'exact_product',
      identity: emptyLabEvidenceIdentity({ barcode: product.barcode, productName: product.name }),
      labEvidence: [{
        evidenceId: 'exact-1', sourceName: 'Reviewed fixture', sourceType: 'independent_lab_test',
        provenance: 'independent', matchLevel: 'exact_product', matchReason: 'Exact GTIN fixture match.',
        sampleDate: null, publicationDate: null, freshness: 'current', laboratory: null,
        laboratoryAccreditation: null, testingMethod: null, sampleAcquisition: 'unknown', analytes: [], confidence: 'high'
      }]
    }));
    const previous = {
      ...initialLabEvidenceClientState(true), state: 'available' as const, resolution: terminal
    };
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { status: 503 } }) } };
    const result = await lookupLabEvidenceState({
      enabled: true, configured: true, client, product, previous,
      sleep: vi.fn().mockResolvedValue(undefined)
    });
    expect(result).toMatchObject({ state: 'available', resolution: terminal, stale: true, errorCode: 'function_error' });
    expect(client.functions.invoke).toHaveBeenCalledTimes(2);
  });

  it('returns unavailable on provider errors and passes through a valid terminal DTO', async () => {
    const errorClient = { functions: { invoke: async () => ({ data: null, error: { message: 'offline' } }) } };
    await expect(lookupLabEvidenceResolution({ product, configured: true, client: errorClient }))
      .resolves.toMatchObject({ status: 'unavailable', availabilityReason: 'temporarily_unavailable' });

    const terminal = clientSafeResolution(createTerminalResolution({
      status: 'no_evidence',
      identity: emptyLabEvidenceIdentity({
        barcode: product.barcode,
        canonicalBarcode: product.canonical_barcode,
        productName: product.name,
        brand: product.brand,
        categoryKeys: product.categories_tags
      }),
      sourcesChecked: ['healthi_curated_registry']
    }));
    const successClient = { functions: { invoke: async () => ({ data: terminal, error: null }) } };
    await expect(lookupLabEvidenceResolution({ product, configured: true, client: successClient }))
      .resolves.toEqual(terminal);
  });

  it('sends a null lot without blocking product-level evidence lookup', async () => {
    const terminal = clientSafeResolution(createTerminalResolution({
      status: 'exact_product',
      identity: emptyLabEvidenceIdentity({
        barcode: product.barcode,
        canonicalBarcode: product.canonical_barcode,
        productName: product.name,
        brand: product.brand,
        lotNumber: null,
        categoryKeys: product.categories_tags
      })
    }));
    let invokedBody: Record<string, unknown> | null = null;
    const successClient = {
      functions: {
        invoke: async (_name: string, options: { body: Record<string, unknown> }) => {
          invokedBody = options.body;
          return { data: terminal, error: null };
        }
      }
    };

    await expect(lookupLabEvidenceResolution({ product, configured: true, client: successClient }))
      .resolves.toMatchObject({ status: 'exact_product' });
    expect(invokedBody).toMatchObject({ identity: { lotNumber: null } });
  });

  it('stores references only and never embeds a global record or safe DTO in quality snapshots', () => {
    const resolution = clientSafeResolution(createTerminalResolution({
      status: 'exact_product',
      identity: emptyLabEvidenceIdentity({ barcode: product.barcode, productName: product.name }),
      labEvidence: [{
        evidenceId: 'evidence-1', sourceName: 'Reviewed fixture source', sourceType: 'independent_lab_test',
        provenance: 'independent', matchLevel: 'exact_product', matchReason: 'Exact fixture identity.',
        sampleDate: null, publicationDate: null, freshness: 'current', laboratory: null,
        laboratoryAccreditation: null, testingMethod: null, sampleAcquisition: 'unknown', analytes: [], confidence: 'high'
      }]
    }));
    const reference = toLabEvidenceReferenceSnapshot(resolution);
    const quality = calculateProductQuality(product);
    const payload = toUserFoodProductInsert({ ...product, lab_evidence_reference: reference, quality }, 'user-1');
    expect(payload.lab_evidence_state).toEqual(reference);
    expect(JSON.stringify(payload.lab_evidence_state)).not.toContain('Reviewed fixture source');
    expect(JSON.stringify(productSnapshotValue({ ...product, lab_evidence_resolution: resolution }, quality))).not.toContain('evidence-1');
  });

  it('does not change any Product Quality field when evidence state changes', () => {
    const baseline = calculateProductQuality(product);
    for (const status of ['exact_product', 'regulatory_alert', 'no_evidence', 'unavailable'] as const) {
      const resolution = clientSafeResolution(createTerminalResolution({
        status,
        identity: emptyLabEvidenceIdentity({ barcode: product.barcode, productName: product.name })
      }));
      expect(calculateProductQuality({ ...product, lab_evidence_resolution: resolution })).toEqual(baseline);
    }
  });

  it('uses neutral copy for absence and uncertainty', () => {
    const noEvidence = clientSafeResolution(createTerminalResolution({
      status: 'no_evidence',
      identity: emptyLabEvidenceIdentity({ barcode: product.barcode, productName: product.name })
    }));
    const unavailable = clientSafeResolution(createTerminalResolution({
      status: 'unavailable',
      identity: noEvidence.identity,
      availabilityReason: 'temporarily_unavailable'
    }));
    const copy = `${labEvidenceStatusCopy(noEvidence).detail} ${labEvidenceStatusCopy(unavailable).detail}`.toLowerCase();
    expect(copy).toContain('not negative evidence');
    expect(copy).not.toMatch(/safe|unsafe|clean|toxin-free|contaminant-free/);
  });
});

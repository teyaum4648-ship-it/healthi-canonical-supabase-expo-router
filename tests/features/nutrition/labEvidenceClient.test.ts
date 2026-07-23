import { describe, expect, it } from 'vitest';

import { labEvidenceStatusCopy, lookupLabEvidenceResolution } from '../../../src/features/nutrition/labEvidence/labEvidenceClient';
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
  it('returns unavailable rather than a loading state when the service is unconfigured', async () => {
    const result = await lookupLabEvidenceResolution({ product, configured: false });
    expect(result).toMatchObject({
      status: 'unavailable',
      retryable: true,
      availabilityReason: 'not_configured'
    });
    expect(labEvidenceStatusCopy(result).title).toBe('Evidence lookup unavailable');
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

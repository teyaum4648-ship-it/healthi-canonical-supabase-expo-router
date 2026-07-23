import { describe, expect, it, vi } from 'vitest';

import { canonicalAnalyteFor } from '../../../src/features/nutrition/labEvidence/analytes';
import { deterministicEvidenceMatch } from '../../../src/features/nutrition/labEvidence/matching';
import { badgeEligible, evidenceFreshness, sourceRightsDecision } from '../../../src/features/nutrition/labEvidence/policy';
import { futureLabEvidenceProviders } from '../../../src/features/nutrition/labEvidence/providerAdapters';
import {
  clientSafeResolution,
  createTerminalResolution,
  deriveResolutionStatus,
  emptyLabEvidenceIdentity,
  shouldRefreshLabEvidence,
  toLabEvidenceReferenceSnapshot
} from '../../../src/features/nutrition/labEvidence/resolution';
import { concentrationToServingAmount, convertLabUnit } from '../../../src/features/nutrition/labEvidence/unitConversion';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

const identity = emptyLabEvidenceIdentity({
  barcode: '012345678905',
  canonicalBarcode: '012345678905',
  productName: 'Fixture oats',
  brand: 'Fixture Foods'
});

describe('Lab Evidence V2 domain', () => {
  it.each([
    'exact_lot', 'exact_product', 'manufacturer_coa', 'current_certification', 'regulatory_alert',
    'related_variant', 'brand_evidence', 'category_context', 'no_evidence', 'unavailable', 'identity_unresolved'
  ] as const)('creates a serializable terminal %s resolution', (status) => {
    const resolution = createTerminalResolution({ status, identity });
    expect(resolution.status).toBe(status);
    expect(JSON.parse(JSON.stringify(resolution))).toEqual(resolution);
  });

  it('keeps coverage internal and persists references only', () => {
    const internal = createTerminalResolution({ status: 'no_evidence', identity, sourcesChecked: ['curated_registry'] });
    const safe = clientSafeResolution(internal);
    expect(safe).not.toHaveProperty('coverageLevel');
    const reference = toLabEvidenceReferenceSnapshot(safe);
    expect(reference).toEqual(expect.objectContaining({ schemaVersion: 2, status: 'no_evidence', evidenceIds: [] }));
    expect(JSON.stringify(reference)).not.toContain('sourceName');
  });

  it('allows evidence dimensions to coexist while deriving one terminal summary state', () => {
    const internal = createTerminalResolution({
      status: 'no_evidence',
      identity,
      certifications: [{
        certificationId: 'cert-1', certificationName: 'Fixture certification', certifyingBody: 'Fixture body',
        scope: 'product', matchReason: 'Reviewed fixture.', validFrom: null, validUntil: null,
        freshness: 'current', confidence: 'high'
      }],
      regulatoryAlerts: [{
        alertId: 'alert-1', authority: 'Fixture authority', title: 'Fixture alert', status: 'active',
        matchLevel: 'exact_product', matchReason: 'Reviewed exact identity.', publishedAt: null,
        sourceUrl: null, confidence: 'high'
      }]
    });
    const { status: _status, coverageLevel: _coverageLevel, ...dimensions } = internal;
    expect(deriveResolutionStatus(dimensions)).toBe('regulatory_alert');
    expect(dimensions.certifications).toHaveLength(1);
    expect(dimensions.regulatoryAlerts).toHaveLength(1);
  });

  it('keeps total and inorganic arsenic plus mercury species distinct', () => {
    expect(canonicalAnalyteFor('total arsenic').id).toBe('total_arsenic');
    expect(canonicalAnalyteFor('inorganic arsenic').id).toBe('inorganic_arsenic');
    expect(canonicalAnalyteFor('mercury').id).toBe('mercury');
    expect(canonicalAnalyteFor('methylmercury').id).toBe('methylmercury');
  });

  it('converts only compatible dimensions and requires mass for serving conversion', () => {
    expect(convertLabUnit(1, 'ppm', 'ppb')).toEqual({ ok: true, value: 1000, unit: 'ppb' });
    expect(convertLabUnit(1, 'ppb', 'mg')).toEqual({ ok: false, reason: 'incompatible_dimensions' });
    expect(concentrationToServingAmount(1, 'ppb', null, 'ug')).toEqual({ ok: false, reason: 'serving_mass_required' });
    expect(concentrationToServingAmount(100, 'ppb', 50, 'ug')).toEqual({ ok: true, value: 5, unit: 'ug' });
  });

  it('derives exact product and lot matches rather than trusting a declared level', () => {
    expect(deterministicEvidenceMatch(
      { barcode: '012345678905', productName: 'Fixture oats', brand: 'Fixture Foods', lotNumber: 'A-1' },
      { barcode: '012345678905', productName: 'Fixture oats', brand: 'Fixture Foods', lotNumber: 'A-1' }
    )).toMatchObject({ level: 'exact_lot', confidence: 'high' });
    expect(deterministicEvidenceMatch(
      { barcode: '012345678905', productName: 'Fixture oats', brand: 'Fixture Foods', variant: 'Plain' },
      { barcode: '012345678905', productName: 'Fixture oats', brand: 'Fixture Foods', variant: 'Cocoa' }
    )).toMatchObject({ level: 'related_variant' });
    expect(deterministicEvidenceMatch(
      { barcode: '012345678906', productName: 'Fixture oats', brand: 'Fixture Foods' },
      { barcode: '012345678906', productName: 'Fixture oats', brand: 'Fixture Foods' }
    )).toMatchObject({ level: null, reasonCodes: ['invalid_gtin_checksum'] });
  });

  it('enforces source rights, revocation, freshness, and badge policy', () => {
    const rights = { enabled: true, rightsStatus: 'approved' as const, allowClientSummary: true, allowNumericResults: true };
    expect(sourceRightsDecision(rights).usable).toBe(true);
    expect(evidenceFreshness({ publishedAt: '2026-01-01', revokedAt: '2026-06-01' }, Date.parse('2026-07-01'))).toBe('revoked');
    expect(badgeEligible({ sourceType: 'independent_lab_test', matchLevel: 'exact_product', freshness: 'current', rights })).toBe(true);
    expect(badgeEligible({ sourceType: 'manufacturer_coa', matchLevel: 'exact_product', freshness: 'current', rights })).toBe(false);
  });

  it('refreshes evidence independently from product-label freshness', () => {
    const safe = clientSafeResolution(createTerminalResolution({
      status: 'no_evidence',
      identity,
      refreshAfter: '2026-07-23T00:00:00.000Z'
    }));
    const reference = toLabEvidenceReferenceSnapshot(safe);
    expect(shouldRefreshLabEvidence(reference, Date.parse('2026-07-22T00:00:00.000Z'))).toBe(false);
    expect(shouldRefreshLabEvidence(reference, Date.parse('2026-07-24T00:00:00.000Z'))).toBe(true);
  });

  it('keeps all unconfigured future adapters disabled and network-free', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const provider of Object.values(futureLabEvidenceProviders)) {
      expect(provider.enabled).toBe(false);
      await expect(provider.lookup({ barcode: identity.barcode, productName: identity.productName, brand: identity.brand, variant: null }))
        .resolves.toMatchObject({ status: 'unavailable', reason: 'not_configured' });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does not change Product Quality outputs for any Lab Evidence V2 resolution', () => {
    const product: HealthiProductSnapshot = {
      barcode: identity.barcode, provider: 'open_food_facts', name: identity.productName, brand: identity.brand,
      serving_size: '50 g', serving_quantity_g: 50, calories_per_serving: 200, protein_g: 8, carbs_g: 30, fat_g: 5,
      fiber_g: 4, sugar_g: 3, sodium_mg: 120, ingredients_text: 'whole oats, seeds',
      quality_flags: [], confidence: 'high', reason_codes: ['product_label_data']
    };
    const baseline = calculateProductQuality(product);
    const resolution = clientSafeResolution(createTerminalResolution({ status: 'no_evidence', identity }));
    expect(calculateProductQuality({ ...product, lab_evidence_resolution: resolution })).toEqual(baseline);
  });
});

import { describe, expect, it } from 'vitest';

import { featureEnabled } from '../../../src/config/featureFlags';
import {
  derivePrimaryScannerState,
  primaryScannerStateCopy,
  type PrimaryScannerState
} from '../../../src/features/nutrition/productLookup/scannerState';

describe('primary scanner state machine', () => {
  it('keeps not found, provider unavailable, and insufficient evidence semantically distinct', () => {
    const terminalStates: PrimaryScannerState[] = [
      'product_not_found',
      'provider_temporarily_unavailable',
      'product_data_insufficient'
    ];
    expect(new Set(terminalStates.map(primaryScannerStateCopy)).size).toBe(3);
  });

  it('derives Product Quality availability independently from optional enrichment', () => {
    expect(derivePrimaryScannerState({
      lookupState: 'product_available', hasProduct: true, qualityResultState: 'final'
    })).toBe('product_quality_available');
    expect(derivePrimaryScannerState({
      lookupState: 'product_available', hasProduct: true, qualityResultState: 'estimated'
    })).toBe('product_quality_available');
    expect(derivePrimaryScannerState({
      lookupState: 'product_available', hasProduct: true, qualityResultState: 'more_data_needed'
    })).toBe('product_quality_more_data_needed');
  });

  it('keeps Lab Evidence disabled unless explicitly enabled', () => {
    expect(featureEnabled(undefined)).toBe(false);
    expect(featureEnabled('false')).toBe(false);
    expect(featureEnabled('true')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { barcodeLookupCandidates, shouldProcessBarcodeScan } from '../../../src/features/nutrition/productLookup/barcodeUtils';

describe('barcode scanner debounce', () => {
  it('prevents a repeated scan during the debounce window', () => {
    const previous = { barcode: '012345678905', scannedAt: 1_000 };

    expect(shouldProcessBarcodeScan(previous, '012345678905', 2_500)).toBe(false);
    expect(shouldProcessBarcodeScan(previous, '012345678905', 3_100)).toBe(true);
    expect(shouldProcessBarcodeScan(previous, '3017620422003', 1_100)).toBe(true);
  });

  it('tries equivalent UPC-A, EAN-13, and GTIN-14 forms without duplicating candidates', () => {
    expect(barcodeLookupCandidates('123456789012')).toEqual(['123456789012', '0123456789012', '00123456789012']);
    expect(barcodeLookupCandidates('0123456789012')).toEqual(['0123456789012', '123456789012', '00123456789012']);
    expect(barcodeLookupCandidates('3017620422003')).toEqual(['3017620422003']);
  });
});

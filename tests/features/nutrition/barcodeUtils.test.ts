import { describe, expect, it } from 'vitest';

import { shouldProcessBarcodeScan } from '../../../src/features/nutrition/productLookup/barcodeUtils';

describe('barcode scanner debounce', () => {
  it('prevents a repeated scan during the debounce window', () => {
    const previous = { barcode: '012345678905', scannedAt: 1_000 };

    expect(shouldProcessBarcodeScan(previous, '012345678905', 2_500)).toBe(false);
    expect(shouldProcessBarcodeScan(previous, '012345678905', 3_100)).toBe(true);
    expect(shouldProcessBarcodeScan(previous, '3017620422003', 1_100)).toBe(true);
  });
});

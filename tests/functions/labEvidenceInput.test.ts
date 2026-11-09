import { describe, expect, it } from 'vitest';

import { validIdentity, type LookupIdentity } from '../../supabase/functions/_shared/labEvidence';

const identity: LookupIdentity = {
  barcode: '012345678905', canonicalBarcode: '00012345678905', productName: 'Fixture oats',
  brand: 'Fixture Foods', variant: null, size: null, market: null, country: null,
  lotNumber: null, productionDate: null, categoryKeys: ['en:oats']
};

describe('Lab Evidence lookup identity boundary', () => {
  it('accepts the complete nullable-string wire contract sent by the app', () => {
    expect(validIdentity(identity)).toBe(true);
    expect(validIdentity({ ...identity, canonicalBarcode: null, brand: null })).toBe(true);
    expect(validIdentity({ ...identity, variant: 'Plain', size: '400 g', market: 'US', country: 'US', lotNumber: 'LOT-1', productionDate: '2026-01-01' })).toBe(true);
  });

  it.each(['canonicalBarcode', 'brand', 'variant', 'size', 'market', 'country', 'lotNumber', 'productionDate'])(
    'rejects malformed %s before lookup can call string methods', (field) => {
      for (const value of [123, true, {}, [], undefined]) {
        expect(validIdentity({ ...identity, [field]: value })).toBe(false);
      }
    }
  );

  it.each([null, undefined, false, 'identity', [], {}, { ...identity, barcode: 123 }, { ...identity, productName: null }, { ...identity, categoryKeys: 'en:oats' }, { ...identity, categoryKeys: [123] }])(
    'rejects malformed outer or required identity fields', (value) => {
      expect(validIdentity(value)).toBe(false);
    }
  );
});

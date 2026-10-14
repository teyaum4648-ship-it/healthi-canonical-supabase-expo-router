import { describe, expect, it } from 'vitest';

import { resolveFoodSearchEndpoint } from '../../../src/features/nutrition/productLookup/foodSearchClient';

describe('where food searches go', () => {
  it('uses the same-origin path in a browser', () => {
    expect(resolveFoodSearchEndpoint('/api/food-search', undefined, true)).toBe('/api/food-search');
  });

  it('joins the path to the site address on a phone', () => {
    expect(resolveFoodSearchEndpoint('/api/food-search', 'https://healthi-demo.example.workers.dev/', false))
      .toBe('https://healthi-demo.example.workers.dev/api/food-search');
  });

  it('searches the catalogue directly on a phone with no site address', () => {
    expect(resolveFoodSearchEndpoint('/api/food-search', undefined, false)).toBeUndefined();
    expect(resolveFoodSearchEndpoint('/api/food-search', '', false)).toBeUndefined();
  });

  it('refuses a plain-http site address on a phone', () => {
    expect(resolveFoodSearchEndpoint('/api/food-search', 'http://example.com', false)).toBeUndefined();
  });

  it('uses an absolute address as it is, anywhere', () => {
    expect(resolveFoodSearchEndpoint('https://search.example.com/q', undefined, false)).toBe('https://search.example.com/q');
    expect(resolveFoodSearchEndpoint(undefined, 'https://example.com', false)).toBeUndefined();
  });
});

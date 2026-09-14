import { describe, expect, it } from 'vitest';

import {
  photoEstimateRefusalTitle,
  requestPhotoEstimate,
  type PhotoEstimateInvoker
} from '../../../src/features/nutrition/photoEstimate/photoEstimateClient';

const NOW = '2026-09-14T12:00:00.000Z';

function clientReturning(data: unknown, error: unknown = null): PhotoEstimateInvoker {
  return { functions: { invoke: async () => ({ data, error }) } };
}

function clientThrowing(): PhotoEstimateInvoker {
  return { functions: { invoke: async () => { throw new Error('socket closed'); } } };
}

async function call(client: PhotoEstimateInvoker | null) {
  return requestPhotoEstimate({ client, imageBase64: 'abc', mediaType: 'image/jpeg', now: NOW });
}

const oneItem = {
  estimate: { items: [{ name: 'Salmon fillet', amount: 170, unit: 'g', nutrients: { calories: 350 }, identification_confidence: 'high', portion_confidence: 'medium' }] },
  model: 'test-model'
};

describe('requesting an estimate', () => {
  it('validates the reply through the same parser as any other payload', async () => {
    const result = await call(clientReturning(oneItem));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.estimate.items[0].name).toBe('Salmon fillet');
    expect(result.estimate.model).toBe('test-model');
    expect(result.estimate.requires_review).toBe(true);
  });

  it('sends the photo and the note to the function', async () => {
    const calls: unknown[] = [];
    const client: PhotoEstimateInvoker = {
      functions: { invoke: async (_name, options) => { calls.push(options.body); return { data: oneItem, error: null }; } }
    };
    await requestPhotoEstimate({ client, imageBase64: 'zzz', mediaType: 'image/png', note: 'half portion', now: NOW });
    expect(calls[0]).toEqual({ image_base64: 'zzz', media_type: 'image/png', note: 'half portion' });
  });
});

describe('every failure is a named refusal, never an exception', () => {
  it('treats an unconfigured deployment as an ordinary answer', async () => {
    const result = await call(clientReturning({ not_configured: true, detail: 'Not switched on here.' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe('not_configured');
    expect(result.refusal.detail).toBe('Not switched on here.');
  });

  it('refuses with no client rather than pretending to estimate', async () => {
    const result = await call(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.reason).toBe('not_configured');
  });

  it('maps the reported codes', async () => {
    const cases: Array<[string, string]> = [
      ['rate_limited', 'rate_limited'],
      ['too_unclear', 'too_unclear'],
      ['malformed_response', 'malformed_response'],
      ['invalid_image', 'unavailable'],
      ['something_new', 'unavailable']
    ];
    for (const [code, expected] of cases) {
      const result = await call(clientReturning({ error: code, detail: 'why' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.refusal.reason).toBe(expected);
    }
  });

  it('survives a thrown transport error', async () => {
    const result = await call(clientThrowing());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.reason).toBe('unavailable');
  });

  it('survives an error object and an empty body', async () => {
    const withError = await call(clientReturning(null, { message: 'boom' }));
    expect(withError.ok).toBe(false);
    const empty = await call(clientReturning('not an object'));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.refusal.reason).toBe('malformed_response');
  });

  it('reports an empty plate as no food rather than zero calories', async () => {
    const result = await call(clientReturning({ estimate: { items: [] }, model: 'test-model' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.reason).toBe('no_food_found');
  });

  it('gives every refusal a title', async () => {
    const reasons = ['not_configured', 'no_food_found', 'too_unclear', 'rate_limited', 'malformed_response', 'unavailable'] as const;
    for (const reason of reasons) {
      const title = photoEstimateRefusalTitle({ reason, detail: '' });
      expect(title.trim().length).toBeGreaterThan(0);
    }
  });
});

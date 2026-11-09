import { describe, expect, it } from 'vitest';
import { BodyTooLargeError, readLimitedJson } from '../../supabase/functions/_shared/requestLimits';

describe('bounded edge JSON reads', () => {
  it('accepts a small JSON response without changing Unicode text', async () => {
    expect(await readLimitedJson(new Response('{"name":"café"}'), 100)).toEqual({ name: 'café' });
  });
  it('rejects a declared oversize before consuming the body', async () => {
    const response = new Response('{}', { headers: { 'content-length': '1000' } });
    await expect(readLimitedJson(response, 10)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(response.bodyUsed).toBe(false);
  });
  it('enforces the real byte limit when Content-Length is absent or dishonest', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"n":"')); controller.enqueue(new Uint8Array(30)); },
      cancel() { cancelled = true; }
    });
    await expect(readLimitedJson(new Response(stream, { headers: { 'content-length': '1' } }), 10)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancelled).toBe(true);
  });
  it('rejects malformed JSON and handles an absent body', async () => {
    await expect(readLimitedJson(new Response('{'), 10)).rejects.toBeInstanceOf(SyntaxError);
    expect(await readLimitedJson(new Response(null), 10)).toBeNull();
  });
});

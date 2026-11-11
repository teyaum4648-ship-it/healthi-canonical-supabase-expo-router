import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BodyTooLargeError, readLimitedJson } from '../../supabase/functions/_shared/requestLimits';

function harness(fetcher: typeof fetch, quota: { data: unknown; error: unknown } = { data: true, error: null }, membership: 'free_launch' | 'active' | 'subscription_required' | 'unavailable' = 'free_launch') {
  let handler: (request: Request) => Promise<Response>;
  const source = readFileSync(new URL('../../supabase/functions/photo-estimate/index.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(compiled, {
    exports: {}, Request, Response, AbortController, setTimeout, clearTimeout, console,
    Deno: { env: { get: (key: string) => key === 'ANTHROPIC_API_KEY' ? 'test-only-key' : undefined }, serve: (fn: typeof handler) => { handler = fn; } },
    fetch: fetcher,
    require: (name: string) => name.includes('auth.ts') ? { authenticatedUser: async () => ({ id: 'synthetic-user' }), serviceClient: () => ({ rpc: async () => quota }) }
      : name.includes('premiumAccess.ts') ? { premiumAccessForUser: async () => membership }
      : name.includes('cors.ts') ? { corsHeaders: {}, jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }) }
      : { BodyTooLargeError, readLimitedJson }
  });
  return (request: Request) => handler(request);
}
function photoRequest() { return new Request('https://edge.example.invalid/photo-estimate', { method: 'POST', body: JSON.stringify({ image_base64: 'test-image', media_type: 'image/jpeg' }) }); }
afterEach(() => vi.useRealTimers());
describe('photo edge input and provider boundaries without live services', () => {
  it.each([
    [{ data: false, error: null }, 429],
    [{ data: null, error: new Error('missing migration') }, 503],
    [{ data: 'true', error: null }, 503]
  ] as const)('does not spend money when quota is denied or cannot be verified', async (quota, status) => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await harness(fetcher, quota)(photoRequest());
    expect(response.status).toBe(status); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ['subscription_required', 402],
    ['unavailable', 503]
  ] as const)('blocks expensive photo requests without server-approved membership', async (membership, status) => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await harness(fetcher, { data: true, error: null }, membership)(photoRequest());
    expect(response.status).toBe(status);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects oversized input before any paid provider call', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await harness(fetcher)(new Request('https://edge.example.invalid/photo-estimate', { method: 'POST', headers: { 'content-length': '99999999' }, body: '{}' }));
    expect(response.status).toBe(413); expect(fetcher).not.toHaveBeenCalled();
  });
  it('aborts a stalled provider within the deadline and returns a named refusal', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = harness(fetcher)(photoRequest());
    await vi.advanceTimersByTimeAsync(30_000);
    const response = await pending;
    expect(response.status).toBe(502); expect((await response.json()).error).toBe('unavailable');
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it('refuses a malformed provider content field without throwing', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ content: 'not an array' }));
    const response = await harness(fetcher)(photoRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).error).toBe('malformed_response');
  });
  it('forwards a successful bounded estimate without leaking provider credentials', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ content: [{ type: 'text', text: '{"items":[]}' }], model: 'test-model' }));
    const response = await harness(fetcher)(photoRequest());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ estimate: { items: [] }, model: 'test-model' });
  });
});

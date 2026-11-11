import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/web-checkout/index.ts', 'utf8');
const workerCode = readFileSync('workers/daywoven-pricing.js', 'utf8');
const sampleUser = '11111111-1111-4111-8111-111111111111';
const forgedUser = '22222222-2222-4222-8222-222222222222';
const baseEnv: Record<string, string> = {
  WEB_CHECKOUT_ENABLED: 'true',
  WEB_CHECKOUT_SIGNING_SECRET: 'test-only-fake-web-checkout-signing-key-123456789012345',
  REVENUECAT_WEB_PURCHASE_LINK: 'https://pay.rev.cat/FixtureProductionToken',
  REVENUECAT_WEB_MONTHLY_PACKAGE_ID: 'monthly_fixture'
};

function edgeHandler(env=baseEnv, authId: string | null = sampleUser, onboarding='completed') {
  let handler!: (request: Request) => Promise<Response>;
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const context = {
    exports: {}, URL, Request, Response, crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, console,
    Deno: { env: { get: (key: string) => env[key] }, serve: (fn: typeof handler) => { handler = fn; } },
    require: (name: string) => name.includes('auth.ts') ? {
      authenticatedUser: async () => authId ? { id: authId } : null,
      serviceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () =>
        ({ data: { onboarding_status: onboarding }, error: null }) }) }) }) })
    } : name.includes('cors.ts') ? { corsHeaders: {} } : {}
  };
  runInNewContext(compiled, context);
  return handler;
}

function appRequest(userId=forgedUser) {
  return new Request('https://edge.example.invalid/web-checkout', {
    method: 'POST', headers: { authorization: 'Bearer fixture-test-jwt' },
    body: JSON.stringify({ app_user_id: userId })
  });
}

describe('account-linked website checkout', () => {
  it('fails closed without real web billing configuration', async () => {
    const handler = edgeHandler({ ...baseEnv, WEB_CHECKOUT_ENABLED: 'false' });
    const r = await handler(appRequest());
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('web_checkout_not_configured');
  });
  it('requires a signed-in account that has finished the free assessment', async () => {
    expect((await edgeHandler(baseEnv, null)(appRequest())).status).toBe(401);
    expect((await edgeHandler(baseEnv, sampleUser, 'in_progress')(appRequest())).status).toBe(403);
  });
  it('signs the authenticated account ID and rejects an attacker-supplied ID', async () => {
    const handler = edgeHandler();
    const response = await handler(appRequest(forgedUser));
    expect(response.status).toBe(200);
    const issued = await response.json() as { url: string };
    const pricingUrl = new URL(issued.url);
    expect(pricingUrl.origin).toBe('https://daywovenapp.com');
    expect(pricingUrl.pathname).toBe('/pricing');
    expect(issued.url).not.toContain(sampleUser);
    expect(issued.url).not.toContain(forgedUser);
    const session = pricingUrl.searchParams.get('session');
    const forwarded = await handler(new Request('https://edge.example.invalid/web-checkout?session=' + encodeURIComponent(session ?? '') + '&plan=monthly'));
    expect(forwarded.status).toBe(302);
    const destination = new URL(forwarded.headers.get('location')!);
    expect(destination.origin).toBe('https://pay.rev.cat');
    expect(destination.pathname).toBe('/FixtureProductionToken/' + sampleUser);
    expect(destination.searchParams.get('package_id')).toBe('monthly_fixture');
    expect(destination.pathname).not.toContain(forgedUser);
    expect(forwarded.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects tampered checkout sessions and untrusted destination hosts', async () => {
    const handler = edgeHandler();
    const minted = await handler(appRequest());
    const session = new URL((await minted.json()).url).searchParams.get('session')!;
    const corrupted = session.slice(0, -2) + (session.endsWith('aa') ? 'bb' : 'aa');
    expect((await handler(new Request('https://edge.example.invalid/web-checkout?session=' + corrupted))).status).toBe(401);
    const badHost = edgeHandler({ ...baseEnv, REVENUECAT_WEB_PURCHASE_LINK: 'https://evil.example.invalid/checkout' });
    expect((await badHost(appRequest())).status).toBe(503);
  });
});

function workerResponse(request: Request): Promise<Response> {
  let respond: Promise<Response> | undefined;
  let listener: ((e: { request: Request; respondWith(p: Promise<Response>): void }) => void) | undefined;
  runInNewContext(workerCode, {
    URL, Request, Response, encodeURIComponent,
    addEventListener: (_event: string, callback: typeof listener) => { listener = callback; }
  });
  listener!({ request, respondWith: p => { respond = p; } });
  return respond!;
}

describe('isolated Daywoven pricing Worker', () => {
  it('renders public plans without a live checkout or invented prices', async () => {
    const response = await workerResponse(new Request('https://daywovenapp.com/pricing'));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('Membership plans');
    expect(html).toContain('Monthly');
    expect(html).toContain('Annual');
    expect(html).toContain('Complete your free assessment first');
    expect(html).not.toContain('href="/pricing/checkout?');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('does not redirect unsigned website visitors to billing', async () => {
    const r = await workerResponse(new Request('https://daywovenapp.com/pricing/checkout?session=fake&plan=monthly'));
    expect(r.status).toBe(400);
  });
  it('only forwards syntactically valid handoffs to the fixed Supabase endpoint', async () => {
    const session = 'A'.repeat(60) + '.' + 'B'.repeat(43);
    const r = await workerResponse(new Request('https://daywovenapp.com/pricing/checkout?session=' + session + '&plan=annual'));
    expect(r.status).toBe(302);
    const url = new URL(r.headers.get('location')!);
    expect(url.origin).toBe('https://lhqpexnepgvuohmhltnr.supabase.co');
    expect(url.pathname).toBe('/functions/v1/web-checkout');
    expect(url.searchParams.get('plan')).toBe('annual');
    expect(url.searchParams.get('session')).toBe(session);
  });
});

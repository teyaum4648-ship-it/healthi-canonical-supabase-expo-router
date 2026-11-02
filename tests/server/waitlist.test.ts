import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import worker from '../../src/server/foodSearch';
import { allowAttempt, handleWaitlist, parseSignup, WAITLIST_NOTICE_VERSION } from '../../src/server/waitlist';

const env = { SUPABASE_URL: 'https://project.supabase.co/', SUPABASE_ANON_KEY: 'anon-key' };
let ip = 0;
/** A fresh address per request, so the per-address limit never leaks between tests. */
function post(body: unknown, headers: Record<string, string> = {}) {
  ip += 1;
  return new Request('https://daywovenapp.com/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'CF-Connecting-IP': `10.0.0.${ip}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}
const ok = () => vi.fn(async () => new Response(null, { status: 204 }));

describe('parsing a sign-up', () => {
  it('keeps what was given and drops what does not fit', () => {
    expect(parseSignup({ email: ' a@b.co ', first_name: '  Sam   Lee ', platform: 'ios', source: 'Tank-Ad' })).toEqual({
      ok: true, value: { email: 'a@b.co', firstName: 'Sam Lee', platform: 'ios', source: 'tank-ad' }
    });
    expect(parseSignup({ email: 'a@b.co', platform: 'windows', source: 'x y' })).toEqual({
      ok: true, value: { email: 'a@b.co', firstName: null, platform: null, source: null }
    });
  });

  it('refuses an address that is not one', () => {
    expect(parseSignup({ email: 'not-an-email' })).toEqual({ ok: false, error: 'invalid_email' });
    expect(parseSignup({ email: `${'a'.repeat(250)}@b.co` })).toEqual({ ok: false, error: 'invalid_email' });
    expect(parseSignup(null)).toEqual({ ok: false, error: 'invalid_request' });
  });

  it('spots the honeypot', () => {
    expect(parseSignup({ email: 'a@b.co', company: 'Acme' })).toEqual({ ok: false, error: 'bot' });
  });
});

describe('the waitlist route', () => {
  it('writes through the database function with the notice version', async () => {
    const fetcher = ok();
    const response = await handleWaitlist(post({ email: 'a@b.co', platform: 'android', source: 'tank' }), env, fetcher);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/join_waitlist');
    expect(JSON.parse(String(init.body))).toEqual({
      p_email: 'a@b.co', p_first_name: null, p_platform: 'android', p_source: 'tank', p_notice_version: WAITLIST_NOTICE_VERSION
    });
  });

  it('tells a bot it worked and saves nothing', async () => {
    const fetcher = ok();
    const response = await handleWaitlist(post({ email: 'a@b.co', company: 'spam' }), env, fetcher);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses a bad address before calling the database', async () => {
    const fetcher = ok();
    const response = await handleWaitlist(post({ email: 'nope' }), env, fetcher);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'invalid_email' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses posts from another site', async () => {
    const response = await handleWaitlist(post({ email: 'a@b.co' }, { Origin: 'https://evil.example' }), env, ok());
    expect(response.status).toBe(403);
  });

  it('says plainly when it is not configured', async () => {
    const response = await handleWaitlist(post({ email: 'a@b.co' }), {}, ok());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'not_configured' });
  });

  it('never passes the upstream body back to the browser', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => new Response('{"message":"secret project detail"}', { status: 500 }));
    const response = await handleWaitlist(post({ email: 'a@b.co' }), env, fetcher);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('secret');
  });

  it('works without JavaScript: a form post comes back to the page', async () => {
    ip += 1;
    const form = new Request('https://daywovenapp.com/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': `10.0.1.${ip}` },
      body: 'email=a%40b.co&platform=ios&company='
    });
    const response = await handleWaitlist(form, env, ok());
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('https://daywovenapp.com/?joined=1#join');
  });

  it('slows down repeated tries from one address', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) expect(allowAttempt('same', now + i)).toBe(true);
    expect(allowAttempt('same', now + 10)).toBe(false);
    expect(allowAttempt('same', now + 61_000)).toBe(true);
  });
});

describe('the worker front door', () => {
  it('serves the waitlist page at / and leaves app paths to the app', async () => {
    const seen: string[] = [];
    const assets = { fetch: async (request: Request) => { seen.push(new URL(request.url).pathname); return new Response('ok'); } };
    const ctx = { waitUntil: () => undefined };
    await worker.fetch(new Request('https://daywovenapp.com/'), { ASSETS: assets }, ctx);
    await worker.fetch(new Request('https://daywovenapp.com/legal/privacy.html'), { ASSETS: assets }, ctx);
    expect(seen).toEqual(['/welcome/', '/legal/privacy.html']);
  });
});

describe('the page and the policy agree with the route', () => {
  const page = readFileSync('public/welcome/index.html', 'utf8');
  const policy = readFileSync('public/legal/privacy.html', 'utf8');

  it('posts to the route, with the fields it reads', () => {
    expect(page).toContain('action="/api/waitlist" method="post"');
    for (const field of ['name="email"', 'name="first_name"', 'name="platform"', 'name="company"']) expect(page).toContain(field);
  });

  it('links to a waitlist section that exists in the privacy policy', () => {
    expect(page).toContain('/legal/privacy.html#waitlist');
    expect(policy).toContain('id="waitlist"');
  });

  it('makes no medical claims', () => {
    expect(page).toContain('not a medical device');
    // The disclaimer is the one place those words may appear, and only to say what it is not.
    const withoutDisclaimer = page.replace(/It is not a medical device and does not diagnose or treat anything\./, '');
    expect(withoutDisclaimer.toLowerCase()).not.toMatch(/\b(diagnos\w*|cures?|treat(s|ment)?|prescri\w*)\b/);
  });
});

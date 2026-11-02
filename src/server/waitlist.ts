/**
 * POST /api/waitlist — the sign-up form on daywovenapp.com.
 *
 * Kept on the server rather than letting the page call Supabase directly so that the
 * checks a browser could skip happen here: the email is validated, the hidden honeypot
 * field turns bots away, posts from other sites are refused, and one address can only
 * try a handful of times a minute. The row itself is written by the `join_waitlist`
 * database function, which returns the same thing for a new or a repeat address.
 *
 * Works with and without JavaScript: a JSON request gets JSON back, and a plain form post
 * is redirected to the page with ?joined=1 or ?error=… so the page can say what happened.
 */

export type WaitlistEnv = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };

/** Which wording of the notice under the form a person saw. Bump when it changes. */
export const WAITLIST_NOTICE_VERSION = '2026-11-02.1';

export type WaitlistSignup = {
  email: string;
  firstName: string | null;
  platform: 'ios' | 'android' | null;
  source: string | null;
};

export type ParsedSignup =
  | { ok: true; value: WaitlistSignup }
  | { ok: false; error: 'invalid_email' | 'invalid_request' }
  | { ok: false; error: 'bot' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function parseSignup(body: unknown): ParsedSignup {
  if (!isRecord(body)) return { ok: false, error: 'invalid_request' };
  // People never see the honeypot, so anything in it was filled in by a script.
  if (text(body.company)) return { ok: false, error: 'bot' };
  const email = text(body.email);
  if (!email || email.length > 254 || !EMAIL.test(email)) return { ok: false, error: 'invalid_email' };
  const firstName = text(body.first_name).replace(/\s+/g, ' ').slice(0, 40) || null;
  const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : null;
  const source = text(body.source).toLowerCase();
  return {
    ok: true,
    value: { email, firstName, platform, source: /^[a-z0-9_-]{1,40}$/.test(source) ? source : null }
  };
}

const recent = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

/** Best effort and per isolate: enough to slow a script down, not a security boundary. */
export function allowAttempt(key: string, now = Date.now()): boolean {
  const attempts = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (attempts.length >= MAX_PER_WINDOW) {
    recent.set(key, attempts);
    return false;
  }
  attempts.push(now);
  if (recent.size > 5000) recent.clear();
  recent.set(key, attempts);
  return true;
}

type Outcome = { ok: true } | { ok: false; error: string; status: number };

function respond(request: Request, outcome: Outcome): Response {
  const wantsJson = (request.headers.get('Accept') ?? '').includes('application/json')
    || (request.headers.get('Content-Type') ?? '').includes('application/json');
  if (wantsJson) {
    return new Response(JSON.stringify(outcome.ok ? { ok: true } : { ok: false, error: outcome.error }), {
      status: outcome.ok ? 200 : outcome.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
  const target = new URL('/', request.url);
  if (outcome.ok) target.searchParams.set('joined', '1');
  else target.searchParams.set('error', outcome.error);
  target.hash = 'join';
  return new Response(null, { status: 303, headers: { Location: target.toString(), 'Cache-Control': 'no-store' } });
}

async function readBody(request: Request): Promise<unknown> {
  const type = request.headers.get('Content-Type') ?? '';
  if (type.includes('application/json')) return request.json().catch(() => null);
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    if (!form) return null;
    const read = form as unknown as { get(name: string): unknown };
    return Object.fromEntries(['email', 'first_name', 'platform', 'source', 'company'].map((name) => {
      const value = read.get(name);
      return [name, typeof value === 'string' ? value : ''];
    }));
  }
  return null;
}

export async function handleWaitlist(request: Request, env: WaitlistEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' }
    });
  }

  // A form on another site cannot post sign-ups here on someone's behalf.
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return respond(request, { ok: false, error: 'forbidden', status: 403 });

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!allowAttempt(ip)) return respond(request, { ok: false, error: 'rate_limited', status: 429 });

  const parsed = parseSignup(await readBody(request));
  // A bot is told it worked, so it has no reason to try a different way in.
  if (!parsed.ok && parsed.error === 'bot') return respond(request, { ok: true });
  if (!parsed.ok) return respond(request, { ok: false, error: parsed.error, status: 400 });

  const base = env.SUPABASE_URL?.replace(/\/+$/, '');
  if (!base || !env.SUPABASE_ANON_KEY) return respond(request, { ok: false, error: 'not_configured', status: 503 });

  try {
    const upstream = await fetcher(`${base}/rest/v1/rpc/join_waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        p_email: parsed.value.email,
        p_first_name: parsed.value.firstName,
        p_platform: parsed.value.platform,
        p_source: parsed.value.source,
        p_notice_version: WAITLIST_NOTICE_VERSION
      })
    });
    if (upstream.ok) return respond(request, { ok: true });
    const detail = await upstream.text().catch(() => '');
    if (detail.includes('invalid_email')) return respond(request, { ok: false, error: 'invalid_email', status: 400 });
    // The upstream body can carry project details; it is logged, never returned.
    console.error('waitlist upstream failure', upstream.status, detail.slice(0, 300));
    return respond(request, { ok: false, error: 'unavailable', status: 502 });
  } catch {
    return respond(request, { ok: false, error: 'unavailable', status: 502 });
  }
}

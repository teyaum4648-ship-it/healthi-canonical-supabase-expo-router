import { authenticatedUser, serviceClient } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Short-lived website handoff. No card data, payment IDs or secrets go to Expo.
// verify_jwt=false on this function so RevenueCat checkout redirects can be
// reached in a normal browser. POST still calls Supabase auth.getUser().
const SITE = 'https://daywovenapp.com';
const TTL_SECONDS = 15 * 60;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAY_LINK = /^https:\/\/pay\.rev\.cat\/[A-Za-z0-9_-]{6,}\/??$/;

type Ticket = { user: string; exp: number; nonce: string };
const enc = new TextEncoder();
const dec = new TextDecoder();
const headers = { ...corsHeaders, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
function json(body: unknown, status=200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}
function base64url(bytes: Uint8Array): string {
  let data = '';
  for (const b of bytes) data += String.fromCharCode(b);
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function unbase64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{1,600}$/.test(value)) throw new Error('invalid_token');
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function configuration() {
  const enabled = Deno.env.get('WEB_CHECKOUT_ENABLED') === 'true';
  const secret = Deno.env.get('WEB_CHECKOUT_SIGNING_SECRET') ?? '';
  const base = (Deno.env.get('REVENUECAT_WEB_PURCHASE_LINK') ?? '').trim().replace(/\/$/, '');
  return enabled && secret.length >= 32 && PAY_LINK.test(base) ? { secret, base } : null;
}
async function issueTicket(userId: string, secret: string): Promise<string> {
  const payload: Ticket = { user: userId, exp: Math.floor(Date.now()/1000) + TTL_SECONDS, nonce: crypto.randomUUID() };
  const encoded = base64url(enc.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(secret), enc.encode(encoded)));
  return encoded + '.' + base64url(signature);
}
async function readTicket(ticket: string, secret: string): Promise<Ticket | null> {
  const parts = ticket.split('.');
  if (parts.length !== 2 || parts[0].length > 600 || parts[1].length > 100) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await signingKey(secret), unbase64url(parts[1]), enc.encode(parts[0]));
    if (!valid) return null;
    const data = JSON.parse(dec.decode(unbase64url(parts[0]))) as Ticket;
    if (!USER_ID.test(data.user) || !Number.isSafeInteger(data.exp) || data.exp < Date.now()/1000 ||
        data.exp > Date.now()/1000 + TTL_SECONDS + 30 || typeof data.nonce !== 'string') return null;
    return data;
  } catch { return null; }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  const config = configuration();
  if (!config) return json({ error: 'web_checkout_not_configured' }, 503);

  if (request.method === 'POST') {
    // A user's app session is the only place allowed to mint a checkout link.
    const user = await authenticatedUser(request);
    if (!user || !USER_ID.test(user.id)) return json({ error: 'unauthorized' }, 401);
    const { data: profile, error } = await serviceClient().from('profiles')
      .select('onboarding_status').eq('id', user.id).maybeSingle();
    if (error) return json({ error: 'account_unavailable' }, 503);
    if (profile?.onboarding_status !== 'completed') return json({ error: 'complete_free_onboarding_first' }, 403);

    const token = await issueTicket(user.id, config.secret);
    return json({ url: SITE + '/pricing?session=' + encodeURIComponent(token), expires_in_seconds: TTL_SECONDS });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const token = url.searchParams.get('session') ?? '';
    const data = await readTicket(token, config.secret);
    if (!data) return json({ error: 'expired_or_invalid_checkout_session', hint: 'Return to Daywoven and reopen the website.' }, 401);
    const plan = url.searchParams.get('plan');
    if (plan && plan !== 'monthly' && plan !== 'annual') return json({ error: 'invalid_plan' }, 400);

    // Only allow the trusted RevenueCat production host. Never redirect to an
    // arbitrary URL from request parameters, and never use sandbox links.
    const destination = new URL(config.base + '/' + encodeURIComponent(data.user));
    const packageId = plan === 'monthly' ? Deno.env.get('REVENUECAT_WEB_MONTHLY_PACKAGE_ID') :
      plan === 'annual' ? Deno.env.get('REVENUECAT_WEB_ANNUAL_PACKAGE_ID') : null;
    if (packageId && /^[A-Za-z0-9_$.-]{1,128}$/.test(packageId)) destination.searchParams.set('package_id', packageId);
    return new Response(null, { status: 302, headers: { ...headers, Location: destination.toString() } });
  }

  return json({ error: 'method_not_allowed' }, 405);
});

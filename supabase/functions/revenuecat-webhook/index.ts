import { serviceClient } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { BodyTooLargeError, readLimitedJson } from '../_shared/requestLimits.ts';

/**
 * RevenueCat webhook events are NOT direct entitlement authority: we verify the
 * webhook bearer secret, then independently fetch live subscription status using
 * the server-only RevenueCat API key before changing any account row.
 *
 * This endpoint has verify_jwt=false because RevenueCat is not a Supabase user.
 * Its bearer secret must be high entropy and NEVER exposed through Expo.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIMIT = 32768;
const TIMEOUT = 6500;

type RevenueCatEntitlement = { expires_date?: string | null; grace_period_expires_date?: string | null };
type RevenueCatCustomer = { subscriber?: { entitlements?: Record<string, RevenueCatEntitlement | null> } };

function customerStatus(customer: RevenueCatCustomer, id: string): { active: boolean; expires: string | null } | null {
  const list = customer.subscriber?.entitlements;
  if (!list || typeof list !== 'object' || Array.isArray(list)) return null;
  const ent = list[id];
  if (!ent || typeof ent !== 'object') return { active: false, expires: null };
  if (ent.expires_date === null) return { active: true, expires: null };
  if (typeof ent.expires_date !== 'string') return { active: false, expires: null };
  if (Number.isFinite(Date.parse(ent.expires_date)) && Date.parse(ent.expires_date) > Date.now()) {
    return { active: true, expires: ent.expires_date };
  }
  const grace = ent.grace_period_expires_date;
  if (typeof grace === 'string' && Number.isFinite(Date.parse(grace)) && Date.parse(grace) > Date.now()) {
    return { active: true, expires: grace };
  }
  return { active: false, expires: null };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_TOKEN');
  if (!expected) return jsonResponse({ error: 'billing_not_configured' }, 503);
  if (request.headers.get('Authorization') !== 'Bearer ' + expected) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  const entitlementId = Deno.env.get('REVENUECAT_ENTITLEMENT_ID') || 'pro';
  if (!apiKey || !/^[A-Za-z0-9_-]{1,64}$/.test(entitlementId)) {
    return jsonResponse({ error: 'billing_not_configured' }, 503);
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, LIMIT);
  } catch (err) {
    return jsonResponse({ error: err instanceof BodyTooLargeError ? 'payload_too_large' : 'invalid_payload' }, 400);
  }
  const event = (body as { event?: { app_user_id?: unknown } } | null)?.event;
  const uid = event?.app_user_id;
  if (typeof uid !== 'string' || !UUID.test(uid)) return jsonResponse({ error: 'invalid_event' }, 400);

  // A customer may have deleted their Daywoven account before Apple or
  // RevenueCat delivers a delayed renewal/cancellation event. Acknowledge it
  // without re-creating an account or retrying forever on its deleted FK.
  const admin = serviceClient();
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('id').eq('id', uid).maybeSingle();
  if (profileError) return jsonResponse({ error: 'sync_unavailable' }, 503);
  if (!profile) return jsonResponse({ received: true });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch('https://api.revenuecat.com/v1/subscribers/' + encodeURIComponent(uid), {
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      signal: controller.signal
    });
    if (response.status === 429 || response.status >= 500) return jsonResponse({ error: 'upstream_unavailable' }, 503);
    if (response.status !== 200 && response.status !== 404) return jsonResponse({ error: 'verification_failed' }, 503);

    let result = { active: false, expires: null as string | null };
    if (response.status === 200) {
      const payload = await response.text();
      if (payload.length > 131072) return jsonResponse({ error: 'verification_failed' }, 503);
      const parsed = JSON.parse(payload) as RevenueCatCustomer;
      const verified = customerStatus(parsed, entitlementId);
      if (!verified) return jsonResponse({ error: 'verification_failed' }, 503);
      result = verified;
    }

    const { error } = await admin.from('subscription_status').upsert({
      user_id: uid,
      revenuecat_customer_id: uid,
      entitlement: result.active ? entitlementId : null,
      status: result.active ? 'active' : 'free',
      current_period_end: result.expires,
      raw_payload: {}
    }, { onConflict: 'user_id' });
    if (error) return jsonResponse({ error: 'sync_unavailable' }, 503);

    return jsonResponse({ received: true });
  } catch {
    return jsonResponse({ error: 'upstream_unavailable' }, 503);
  } finally {
    clearTimeout(timer);
  }
});

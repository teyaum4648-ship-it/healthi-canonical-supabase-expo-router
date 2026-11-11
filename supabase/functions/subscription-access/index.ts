import { authenticatedUser, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

// Server verification is authoritative for premium-backed API operations.
// The client SDK key is not sufficient here; this function requires a RevenueCat
// secret API key stored only as a Supabase Edge Function secret.
const MAX_RESPONSE_BYTES = 131072;
const TIMEOUT_MS = 6000;

type Entitlement = { expires_date?: string | null; grace_period_expires_date?: string | null };
type Customer = { subscriber?: { entitlements?: Record<string, Entitlement | null> } };

function verifiedEntitlement(customer: Customer, id: string): { active: boolean; expiresAt: string | null } {
  const entitlement = customer.subscriber?.entitlements?.[id];
  if (!entitlement || typeof entitlement !== 'object') return { active: false, expiresAt: null };
  const expiry = entitlement.expires_date;
  if (expiry == null) return { active: true, expiresAt: null }; // Verified non-expiring entitlement.
  const expiryMs = Date.parse(expiry);
  if (Number.isFinite(expiryMs) && expiryMs > Date.now()) return { active: true, expiresAt: expiry };
  const grace = entitlement.grace_period_expires_date;
  if (typeof grace === 'string' && Number.isFinite(Date.parse(grace)) && Date.parse(grace) > Date.now()) {
    return { active: true, expiresAt: grace };
  }
  return { active: false, expiresAt: null };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

    const secret = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    if (!secret) return jsonResponse({ error: 'billing_not_configured' }, 503);
    const entitlementId = Deno.env.get('REVENUECAT_ENTITLEMENT_ID') || 'pro';
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(entitlementId)) return jsonResponse({ error: 'billing_not_configured' }, 503);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch('https://api.revenuecat.com/v1/subscribers/' + encodeURIComponent(user.id), {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + secret, Accept: 'application/json' },
        signal: controller.signal
      });
    } finally { clearTimeout(timer); }

    if (response.status === 429 || response.status >= 500) return jsonResponse({ error: 'billing_temporarily_unavailable' }, 503);
    if (response.status !== 200 && response.status !== 404) return jsonResponse({ error: 'billing_verification_failed' }, 503);

    let customer: Customer = {};
    if (response.status === 200) {
      const raw = await response.text();
      if (raw.length > MAX_RESPONSE_BYTES) return jsonResponse({ error: 'billing_verification_failed' }, 503);
      customer = JSON.parse(raw) as Customer;
      if (!customer || !customer.subscriber || !customer.subscriber.entitlements || typeof customer.subscriber.entitlements !== 'object') {
        return jsonResponse({ error: 'billing_verification_failed' }, 503);
      }
    }

    const status = verifiedEntitlement(customer, entitlementId);
    const service = serviceClient();
    const { error } = await service.from('subscription_status').upsert({
      user_id: user.id,
      revenuecat_customer_id: user.id,
      entitlement: status.active ? entitlementId : null,
      status: status.active ? 'active' : 'free',
      current_period_end: status.expiresAt,
      raw_payload: {}
    }, { onConflict: 'user_id' });
    if (error) return jsonResponse({ error: 'billing_sync_unavailable' }, 503);
    return jsonResponse({ active: status.active, entitlement: status.active ? entitlementId : null, expires_at: status.expiresAt });
  } catch {
    // No API keys, JWTs, account IDs or purchase details in error logs.
    return jsonResponse({ error: 'billing_temporarily_unavailable' }, 503);
  }
});

import { authenticatedUser, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  resolveProductData,
  type CanonicalProductCacheRecord,
  type CanonicalProductCacheStore
} from '../_shared/productDataResolver.ts';

const publicLookupWindows = new Map<string, { startedAt: number; count: number }>();
const PUBLIC_LOOKUP_WINDOW_MS = 60_000;
const PUBLIC_LOOKUP_LIMIT = 60;

function isProjectPublicClient(request: Request): boolean {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  return Boolean(anonKey && request.headers.get('Authorization') === `Bearer ${anonKey}`);
}

async function mayResolvePublicProduct(request: Request): Promise<boolean> {
  if (isProjectPublicClient(request)) return true;
  return Boolean(await authenticatedUser(request));
}

function publicLookupAllowed(request: Request, now = Date.now()): boolean {
  if (!isProjectPublicClient(request)) return true;
  if (publicLookupWindows.size > 1_000) {
    for (const [key, window] of publicLookupWindows) {
      if (now - window.startedAt >= PUBLIC_LOOKUP_WINDOW_MS) publicLookupWindows.delete(key);
    }
  }
  const clientKey = (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || 'anonymous').slice(0, 128);
  const current = publicLookupWindows.get(clientKey);
  if (!current || now - current.startedAt >= PUBLIC_LOOKUP_WINDOW_MS) {
    publicLookupWindows.set(clientKey, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= PUBLIC_LOOKUP_LIMIT) return false;
  current.count += 1;
  return true;
}

function canonicalCache(): CanonicalProductCacheStore {
  const client = serviceClient();
  return {
    async get(canonicalGtin) {
      const { data, error } = await client
        .from('canonical_product_cache')
        .select('canonical_gtin, normalized_snapshot, provider_provenance, provider_conflicts, source_timestamps, resolver_version, fetched_at, fresh_until, last_successful_provider_at, payload_bytes')
        .eq('canonical_gtin', canonicalGtin)
        .maybeSingle();
      if (error || !data) return null;
      const resolution = data.normalized_snapshot as CanonicalProductCacheRecord['resolution'];
      if (resolution?.status !== 'resolved' || resolution.canonicalGtin !== canonicalGtin) return null;
      return {
        canonicalGtin: data.canonical_gtin,
        resolution,
        providerProvenance: data.provider_provenance,
        providerConflicts: data.provider_conflicts,
        sourceTimestamps: data.source_timestamps as Record<string, string | null>,
        resolverVersion: data.resolver_version,
        fetchedAt: data.fetched_at,
        freshUntil: data.fresh_until,
        lastSuccessfulProviderAt: data.last_successful_provider_at,
        payloadBytes: data.payload_bytes
      };
    },
    async put(record) {
      const { error } = await client.from('canonical_product_cache').upsert({
        canonical_gtin: record.canonicalGtin,
        normalized_snapshot: record.resolution,
        provider_provenance: record.providerProvenance,
        provider_conflicts: record.providerConflicts,
        source_timestamps: record.sourceTimestamps,
        resolver_version: record.resolverVersion,
        freshness_state: 'fresh',
        fetched_at: record.fetchedAt,
        fresh_until: record.freshUntil,
        last_successful_provider_at: record.lastSuccessfulProviderAt,
        payload_bytes: record.payloadBytes,
        updated_at: new Date().toISOString()
      }, { onConflict: 'canonical_gtin' });
      if (error) throw error;
    }
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!await mayResolvePublicProduct(request)) return jsonResponse({ error: 'unauthorized' }, 401);
  if (!publicLookupAllowed(request)) {
    const response = jsonResponse({ error: 'rate_limited' }, 429);
    response.headers.set('Retry-After', '60');
    return response;
  }

  const body = await request.json().catch(() => null) as { barcode?: unknown } | null;
  if (typeof body?.barcode !== 'string') return jsonResponse({ error: 'invalid_barcode' }, 400);
  const result = await resolveProductData({
    barcode: body.barcode,
    usdaApiKey: Deno.env.get('USDA_FDC_API_KEY'),
    cache: canonicalCache()
  });
  return jsonResponse(result);
});

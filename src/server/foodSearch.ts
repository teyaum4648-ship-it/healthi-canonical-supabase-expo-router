/** Same-origin search gateway. Only public catalog data is cached; never meals,
 * quiz answers, auth headers, or provider credentials. No arbitrary upstream URL.
 */
type Env = { USDA_API_KEY?: string; ASSETS?: { fetch(request: Request): Promise<Response> } };
type Context = { waitUntil(promise: Promise<unknown>): void };
type CacheLike = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };
type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);
const fields = ['code','product_name','brands','quantity','serving_size','serving_quantity','ingredients_text','categories_tags','countries_tags','nutriments','image_front_small_url','labels_tags','last_modified_t'];
const headers = { 'User-Agent': 'Healthi/0.1 (food diary search)', Accept: 'application/json' };
export type SearchPayload = { products: RecordValue[]; usdaFoods: RecordValue[]; sources: string[]; partial: boolean; stale?: boolean; usdaConfigured: boolean; fetchedAt: string };
const json = (body: unknown, status = 200, extra: Record<string,string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
async function requestJson(fetcher: typeof fetch, url: string, init: RequestInit, timeout = 4500) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetcher(url, { ...init, signal: controller.signal });
    if (!r.ok) throw new Error(`upstream_${r.status}`);
    return await r.json() as unknown;
  } finally { clearTimeout(timer); }
}
const clean = (rows: unknown) => Array.isArray(rows) ? rows.filter(record).slice(0, 24) : null;
export async function searchCatalog(query: string, env: Env, fetcher: typeof fetch = fetch): Promise<SearchPayload> {
  // Send plain text, not Lucene syntax. The deployed index treats quoted
  // unqualified terms as a literal wildcard-field query and returns no hits.
  const terms = query.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!terms.length) throw new Error('invalid_query');
  const off = async () => {
    try {
      const data = await requestJson(fetcher, 'https://search.openfoodfacts.org/search', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ q: terms.map(t => t.toLowerCase()).join(' '), langs: ['en'], fields, page_size: 24 }) });
      const rows = record(data) ? clean(data.hits) : null;
      if (!rows || (record(data) && data.timed_out === true)) throw new Error('invalid_search_response');
      return rows.map(p => ({ ...p, brands: Array.isArray(p.brands) ? p.brands.filter(v => typeof v === 'string').join(', ') : p.brands }));
    } catch {
      // One fallback, not a retry loop. Legacy endpoint remains a last resort.
      const data = await requestJson(fetcher, `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&fields=${fields.join(',')}`, { headers }, 3500);
      const rows = record(data) ? clean(data.products) : null;
      if (!rows) throw new Error('invalid_search_response');
      return rows;
    }
  };
  const usda = async () => {
    if (!env.USDA_API_KEY) return null;
    const data = await requestJson(fetcher, 'https://api.nal.usda.gov/fdc/v1/foods/search', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Api-Key': env.USDA_API_KEY }, body: JSON.stringify({ query, pageSize: 24, dataType: ['Branded', 'Foundation', 'SR Legacy', 'Survey (FNDDS)'] }) });
    const rows = record(data) ? clean(data.foods) : null;
    if (!rows) throw new Error('invalid_usda_response');
    return rows;
  };
  const [a, b] = await Promise.allSettled([off(), usda()]);
  if (a.status === 'rejected' && (b.status === 'rejected' || b.value === null)) throw new Error('provider_unavailable');
  return { products: a.status === 'fulfilled' ? a.value : [], usdaFoods: b.status === 'fulfilled' ? b.value ?? [] : [], sources: [a.status === 'fulfilled' ? 'Open Food Facts' : '', b.status === 'fulfilled' && b.value ? 'USDA FoodData Central' : ''].filter(Boolean), partial: a.status === 'rejected' || b.status === 'rejected', usdaConfigured: !!env.USDA_API_KEY, fetchedAt: new Date().toISOString() };
}
const inFlight = new Map<string, Promise<SearchPayload>>();
const recent = new Map<string, number>();
export async function handleFoodSearch(request: Request, env: Env, ctx: Context, cache?: CacheLike, fetcher: typeof fetch = fetch) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(request.url); const query = (url.searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 120 || !/[\p{L}\p{N}]/u.test(query)) return json({ error: 'invalid_query' }, 400);
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ error: 'origin_not_allowed' }, 403);
  const key = new Request(`${url.origin}/api/food-search-cache/v1?q=${encodeURIComponent(query.toLowerCase())}&usda=${env.USDA_API_KEY ? '1' : '0'}`);
  let cached: SearchPayload | null = null;
  try { const hit = await cache?.match(key); if (hit) cached = await hit.json() as SearchPayload; } catch { /* cache is optional */ }
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < 15 * 60_000) return json({ ...cached, cache: 'fresh' });
  // Coalesce identical requests per isolate. Cache provides cross-session reuse.
  const id = key.url;
  const shared = inFlight.get(id);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!shared && ip) {
    const last = recent.get(ip) ?? 0;
    if (Date.now() - last < 1000) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '1' });
    if (recent.size > 1000) recent.clear();
    recent.set(ip, Date.now());
  }
  const promise = shared ?? searchCatalog(query, env, fetcher);
  if (!shared) inFlight.set(id, promise);
  try {
    const result = await promise;
    if (!result.partial && (result.products.length || result.usdaFoods.length) && cache) ctx.waitUntil(cache.put(key, json(result, 200, { 'Cache-Control': 'public, max-age=86400' })).catch(() => undefined));
    return json({ ...result, cache: 'miss' });
  } catch {
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < 86400_000) return json({ ...cached, stale: true, cache: 'stale' });
    return json({ error: 'provider_unavailable', message: 'The food databases are temporarily unavailable. Your Recent and Saved foods still work.' }, 503);
  } finally { if (inFlight.get(id) === promise) inFlight.delete(id); }
}
export default {
  async fetch(request: Request, env: Env, ctx: Context) {
    const url = new URL(request.url);
    if (url.pathname === '/api/food-search') {
      const cache = (globalThis as unknown as { caches?: { default?: CacheLike } }).caches?.default;
      return handleFoodSearch(request, env, ctx, cache);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    if (!env.ASSETS) return new Response('App assets unavailable', { status: 503 });
    const result = await env.ASSETS.fetch(request);
    if (result.status === 404 && request.method === 'GET' && !url.pathname.split('/').pop()?.includes('.')) return env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), request));
    return result;
  }
};

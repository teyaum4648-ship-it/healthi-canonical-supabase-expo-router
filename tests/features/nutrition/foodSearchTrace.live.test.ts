import { appendFileSync, writeFileSync } from 'node:fs';
import { describe, it, vi } from 'vitest';

import { foodLoggingCompleteness, foodLoggingNutrition, partitionFoodSearchResults } from '../../../src/features/nutrition/foodLoggingNutrition';
import { searchFoods } from '../../../src/features/nutrition/productLookup/foodSearchClient';
import { normalizeOpenFoodFactsProduct, type OpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { buildFoodSearchUrl } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';

/*
 * Follows one search through the app, against the live catalogue: what the catalogue sent,
 * what normalisation kept, and which of the two lists each food landed in. For "why didn't
 * this food show up" reports, so the answer comes from the app's own code rather than a
 * re-implementation of it. Off unless HEALTHI_TRACE_SEARCH names a query; needs network.
 */
const query = process.env.HEALTHI_TRACE_SEARCH?.trim() ?? '';
const reliability = process.env.HEALTHI_TRACE_RELIABILITY === '1';
const engineForms = process.env.HEALTHI_TRACE_ENGINE === '1';
const out = process.env.HEALTHI_TRACE_OUT ?? 'food-search-trace.txt';
const countryTag = process.env.HEALTHI_TRACE_COUNTRY ?? 'united-states';

const MACROS = ['energy-kcal', 'proteins', 'carbohydrates', 'fat'] as const;
const log = (line = '') => appendFileSync(out, `${line}\n`);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Records every request the app makes, without changing how it makes them. */
function recordRequests() {
  const seen: string[] = [];
  const realFetch = globalThis.fetch;
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const started = Date.now();
    try {
      const response = await realFetch(input, init);
      const body = (await response.clone().text()).slice(0, 100).replace(/\s+/g, ' ');
      seen.push(`${response.status} in ${Date.now() - started} ms · retry-after ${response.headers.get('retry-after') ?? '-'} · ${String(input).replace(/&fields=[^&]*/, '').slice(0, 140)}${response.ok ? '' : ` · body: ${body}`}`);
      return response;
    } catch (error) {
      seen.push(`threw ${String(error)} in ${Date.now() - started} ms · ${String(input).slice(0, 140)}`);
      throw error;
    }
  });
  return { seen, restore: () => spy.mockRestore() };
}

describe.skipIf(!query)('live trace of one food search through the app', () => {
  it('shows where each catalogue product ends up', async () => {
    writeFileSync(out, '');

    const url = buildFoodSearchUrl(query, 'en', { countryTag });
    const response = await fetch(url, { headers: { 'User-Agent': 'Healthi/0.1 (search trace)', Accept: 'application/json' } });
    log(`Catalogue request: HTTP ${response.status}`);
    const payload = response.ok ? await response.json() as { count?: number; products?: OpenFoodFactsProduct[] } : {};
    const raw = payload.products ?? [];
    log(`Catalogue sent ${raw.length} of ${payload.count ?? '?'} matches for "${query}" (${countryTag})`);
    for (const product of raw) {
      const code = String((product as { code?: unknown }).code ?? '');
      const snapshot = normalizeOpenFoodFactsProduct(code, product);
      const nutriments = (product as { nutriments?: Record<string, unknown> }).nutriments ?? {};
      const label = MACROS.map((key) => `${key} 100g=${nutriments[`${key}_100g`] ?? '-'} serving=${nutriments[`${key}_serving`] ?? '-'}`).join(' · ');
      log(`\n${code} | ${String(product.brands ?? '(no brand)')} | ${String(product.product_name ?? '(no name)')}`);
      log(`   label: ${label} | serving_size=${String(product.serving_size ?? '-')} serving_quantity=${String((product as { serving_quantity?: unknown }).serving_quantity ?? '-')}`);
      if (!snapshot) { log('   DROPPED by normalisation (no readable name)'); continue; }
      const logging = foodLoggingNutrition(snapshot);
      const n = logging.nutrients;
      log(`   kept: completeness ${foodLoggingCompleteness(snapshot)} (2+ is "ready to log") · basis ${logging.basis} · kcal ${n.calories} P ${n.protein_g} C ${n.carbs_g} F ${n.fat_g}`);
      log(`   flags: ${snapshot.quality_flags.join(', ') || 'none'} | reasons: ${snapshot.reason_codes.slice(0, 8).join(', ') || 'none'}`);
    }

    await pause(8_000);
    const requests = recordRequests();
    const result = await searchFoods(query, { countryTag });
    requests.restore();
    const { ready, incomplete } = partitionFoodSearchResults(result.products);
    log(`\nThe app's search: ${result.status}${'message' in result && result.message ? ` (${result.message})` : ''}${result.notice ? ` — ${result.notice}` : ''}`);
    log('Requests the app made:');
    for (const line of requests.seen) log(`   ${line}`);
    log(`Shown as ready to log (${ready.length}):`);
    for (const p of ready) log(`   ${p.brand ?? '(no brand)'} | ${p.name} | ${p.provider}`);
    log(`Folded under "matches needing label details" (${incomplete.length}):`);
    for (const p of incomplete) log(`   ${p.brand ?? '(no brand)'} | ${p.name} | ${p.provider}`);
  }, 180_000);
});

/*
 * How often the catalogue answers each way of asking. The same words go out as the app
 * sends them today and with one thing changed at a time, so a difference in the answer
 * rate points at the thing that was changed.
 */
describe.skipIf(!reliability)('live reliability of the catalogue search', () => {
  it('compares ways of asking', async () => {
    writeFileSync(out, '');
    const queries = [
      'breyers butter pecan ice cream', 'chobani vanilla greek yogurt', 'daves killer bread good seed', 'tillamook sharp cheddar',
      'halo top birthday cake', 'annies mac and cheese', 'fairlife chocolate milk', 'kind dark chocolate nuts sea salt',
      'siete tortilla chips', 'olipop vintage cola'
    ];
    const named = { Accept: 'application/json', 'User-Agent': 'Healthi/0.1 (+https://github.com/teyaum4648-ship-it/healthi-canonical-supabase-expo-router)' };
    const variants: { id: string; url: (q: string) => string; headers: Record<string, string> }[] = [
      { id: 'app today (US filter, app headers)', url: (q) => buildFoodSearchUrl(q, 'en', { countryTag: 'united-states' }), headers: { Accept: 'application/json', 'X-User-Agent': 'Healthi/0.1' } },
      { id: 'US filter, named User-Agent', url: (q) => buildFoodSearchUrl(q, 'en', { countryTag: 'united-states' }), headers: named },
      { id: 'no country filter, named User-Agent', url: (q) => buildFoodSearchUrl(q, 'en'), headers: named },
      { id: 'no country filter, app headers', url: (q) => buildFoodSearchUrl(q, 'en'), headers: { Accept: 'application/json', 'X-User-Agent': 'Healthi/0.1' } }
    ];
    const tally = new Map(variants.map((v) => [v.id, { ok: 0, statuses: [] as string[], ms: 0 }]));
    for (const [index, q] of queries.entries()) {
      log(`\n"${q}"`);
      // Alternate the order, so no way of asking always goes second, onto a warmed cache.
      for (const variant of index % 2 ? [...variants].reverse() : variants) {
        const started = Date.now();
        let status = 'threw';
        let count = '-';
        try {
          const response = await fetch(variant.url(q), { headers: variant.headers, signal: AbortSignal.timeout(20_000) });
          status = String(response.status);
          if (response.ok) count = String(((await response.json()) as { count?: number }).count ?? '?');
        } catch (error) { status = `threw ${String(error).slice(0, 60)}`; }
        const row = tally.get(variant.id)!;
        row.statuses.push(status);
        row.ms += Date.now() - started;
        if (status === '200') row.ok += 1;
        log(`   ${variant.id}: ${status} · ${Date.now() - started} ms · count ${count}`);
        await pause(7_000);
      }
    }
    log('\nAnswered, of each way of asking:');
    for (const [id, row] of tally) log(`   ${id}: ${row.ok}/${queries.length} · average ${Math.round(row.ms / queries.length)} ms · ${row.statuses.join(' ')}`);
  }, 900_000);
});

/*
 * Open Food Facts' newer engine answered every request in these reports, where the
 * keyword search turned most away, but its plain-text ranking is loose. This compares
 * ways of phrasing the same words to it, by whether the typed brand leads the answer.
 */
describe.skipIf(!engineForms)('live phrasing of the newer catalogue engine', () => {
  it('compares query forms', async () => {
    writeFileSync(out, '');
    const cases: [string, string][] = [
      ['breyers', 'butter pecan ice cream'], ['chobani', 'vanilla greek yogurt'], ['daves killer bread', 'good seed'], ['tillamook', 'sharp cheddar'],
      ['halo top', 'birthday cake'], ['annies', 'mac and cheese'], ['fairlife', 'chocolate milk'], ['kind', 'dark chocolate nuts sea salt'],
      ['siete', 'tortilla chips'], ['olipop', 'vintage cola'], ['', 'greek yogurt'], ['', 'butter pecan ice cream']
    ];
    const fields = 'code,product_name,brands,countries_tags,serving_size,serving_quantity,nutriments,ingredients_text,categories_tags,image_front_small_url';
    const words = (text: string) => text.split(' ').filter(Boolean);
    const forms: { id: string; q: (brand: string, rest: string) => string }[] = [
      { id: 'plain words', q: (b, r) => `${b} ${r}`.trim() },
      { id: 'every word required', q: (b, r) => words(`${b} ${r}`).join(' AND ') },
      { id: 'every word + US', q: (b, r) => `${words(`${b} ${r}`).join(' AND ')} AND countries_tags:"en:united-states"` },
      { id: 'brand field + words + US', q: (b, r) => b ? `brands:"${b}" AND ${words(r).join(' AND ')} AND countries_tags:"en:united-states"` : `${words(r).join(' AND ')} AND countries_tags:"en:united-states"` }
    ];
    const tally = new Map(forms.map((f) => [f.id, { ok: 0, brandLed: 0 }]));
    let shownFields = false;
    for (const [brand, rest] of cases) {
      log(`\n"${`${brand} ${rest}`.trim()}"`);
      for (const form of forms) {
        const started = Date.now();
        const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(form.q(brand, rest))}&langs=en&page_size=24&fields=${fields}`;
        let line = '';
        try {
          const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Healthi/0.1 (engine phrasing report)' }, signal: AbortSignal.timeout(20_000) });
          const body = response.ok ? await response.json() as { count?: number; hits?: Record<string, unknown>[] } : {};
          const hits = body.hits ?? [];
          const brandOf = (hit: Record<string, unknown>) => (Array.isArray(hit.brands) ? hit.brands.join(', ') : String(hit.brands ?? '')).toLowerCase().replace(/['\u2019]/g, '');
          const led = brand ? hits.slice(0, 5).filter((hit) => brandOf(hit).includes(brand.split(' ')[0].replace(/s$/, ''))).length : 0;
          const row = tally.get(form.id)!;
          if (response.ok) row.ok += 1;
          if (brand && led >= 3) row.brandLed += 1;
          line = `${response.status} · ${Date.now() - started} ms · count ${body.count ?? '-'} · brand in top 5: ${brand ? led : 'n/a'} · ${hits.slice(0, 3).map((hit) => `${brandOf(hit) || '(no brand)'} | ${String(hit.product_name ?? '')}`).join(' ; ')}`;
          if (!shownFields && hits[0]) {
            shownFields = true;
            const first = hits[0];
            const nutriments = (first.nutriments ?? {}) as Record<string, unknown>;
            log(`   (fields on a hit: ${Object.keys(first).join(', ')}; nutriment keys: ${Object.keys(nutriments).slice(0, 12).join(', ')})`);
          }
        } catch (error) { line = `threw ${String(error).slice(0, 80)}`; }
        log(`   ${form.id}: ${line}`);
        await pause(1_500);
      }
    }
    log('\nAnswered, and brand led the top five, by phrasing (10 branded searches, 12 in all):');
    for (const [id, row] of tally) log(`   ${id}: answered ${row.ok}/${cases.length} · brand led ${row.brandLed}/10`);
  }, 600_000);
});

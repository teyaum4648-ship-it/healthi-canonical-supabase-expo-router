import { appendFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';

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
const out = process.env.HEALTHI_TRACE_OUT ?? 'food-search-trace.txt';
const countryTag = process.env.HEALTHI_TRACE_COUNTRY ?? 'united-states';

const MACROS = ['energy-kcal', 'proteins', 'carbohydrates', 'fat'] as const;

describe.skipIf(!query)('live trace of one food search through the app', () => {
  it('shows where each catalogue product ends up', async () => {
    writeFileSync(out, '');
    const log = (line = '') => appendFileSync(out, `${line}\n`);

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

    const result = await searchFoods(query, { countryTag });
    const { ready, incomplete } = partitionFoodSearchResults(result.products);
    log(`\nThe app's search: ${result.status}${'message' in result && result.message ? ` (${result.message})` : ''}${result.notice ? ` — ${result.notice}` : ''}`);
    log(`Shown as ready to log (${ready.length}):`);
    for (const p of ready) log(`   ${p.brand ?? '(no brand)'} | ${p.name} | ${p.provider}`);
    log(`Folded under "matches needing label details" (${incomplete.length}):`);
    for (const p of incomplete) log(`   ${p.brand ?? '(no brand)'} | ${p.name} | ${p.provider}`);
  }, 180_000);
});

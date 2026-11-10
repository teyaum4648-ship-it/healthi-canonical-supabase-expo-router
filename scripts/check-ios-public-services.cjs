#!/usr/bin/env node
/**
 * Read-only preflight for public URLs embedded in an iOS release.
 * The probe uses no real account, no API keys, and no provider billable search.
 * Run after setting the same EXPO_PUBLIC_* values as the release build.
 */
const TIMEOUT_MS = 10000;

function resolveUrls(environment) {
  const siteValue = environment.EXPO_PUBLIC_SITE_URL?.trim();
  const foodValue = environment.EXPO_PUBLIC_FOOD_SEARCH_URL?.trim();
  if (!siteValue) throw new Error('EXPO_PUBLIC_SITE_URL is required');
  if (!foodValue) throw new Error('EXPO_PUBLIC_FOOD_SEARCH_URL is required');

  const site = new URL(siteValue);
  if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash || site.pathname !== '/') {
    throw new Error('EXPO_PUBLIC_SITE_URL must be an HTTPS origin without path, query, or credentials');
  }
  const food = new URL(foodValue, site);
  if (food.protocol !== 'https:' || food.username || food.password || food.hash) {
    throw new Error('EXPO_PUBLIC_FOOD_SEARCH_URL must resolve to a safe HTTPS URL');
  }
  // An empty query exercises the public route's input validation, without calling food providers.
  food.searchParams.set('q', '');
  return {
    privacy: new URL('/legal/privacy.html', site).href,
    terms: new URL('/legal/terms.html', site).href,
    food: food.href
  };
}

async function runChecks(environment = process.env, request = globalThis.fetch) {
  const results = [];
  let urls;
  try {
    urls = resolveUrls(environment);
  } catch (error) {
    return { ok: false, results: [{ name: 'configuration', ok: false, reason: error.message }] };
  }
  for (const [name, url] of Object.entries(urls)) {
    try {
      const response = await request(url, {
        method: 'GET',
        headers: { Accept: name === 'food' ? 'application/json' : 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (name === 'food') {
        let payload;
        try { payload = await response.json(); } catch { payload = null; }
        // The repo's gateway returns this 400 without querying upstream food databases.
        const valid = response.status === 400 && payload?.error === 'invalid_query';
        results.push({ name, ok: valid, reason: valid ? 'food-search route responds correctly' : 'expected 400 {error:invalid_query}; received HTTP ' + response.status });
      } else {
        const html = await response.text();
        const expectedTitle = name === 'privacy' ? /<title>\s*Privacy Policy\b/i : /<title>\s*Terms of Service\b/i;
        const valid = response.ok && /<html\b/i.test(html) && expectedTitle.test(html) && !/\{\{[A-Z][A-Z_]*\}\}/.test(html);
        results.push({ name, ok: valid, reason: valid ? 'published HTML policy is reachable with no placeholders' : 'HTTP ' + response.status + ', or policy HTML is missing/unfinished' });
      }
    } catch (error) {
      results.push({ name, ok: false, reason: 'cannot reach URL: ' + error.message });
    }
  }
  return { ok: results.every(x => x.ok), results };
}

if (require.main === module) {
  runChecks().then(({ ok, results }) => {
    for (const result of results) console.log((result.ok ? 'PASS' : 'FAIL') + ' ' + result.name + ': ' + result.reason);
    if (!ok) {
      console.error('Public service preflight failed. Fix the URL or publish completed policies before submitting.');
      process.exitCode = 1;
    }
  }).catch(error => {
    console.error('Release preflight failed: ' + error.message);
    process.exitCode = 1;
  });
}
module.exports = { resolveUrls, runChecks };

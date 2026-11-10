const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveUrls, runChecks } = require('../../scripts/check-ios-public-services.cjs');

const env = {
  EXPO_PUBLIC_SITE_URL: 'https://release.example.org',
  EXPO_PUBLIC_FOOD_SEARCH_URL: '/api/food-search'
};
const goodHtml = kind => '<!doctype html><html><head><title>' + (kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service') + ' · daywoven</title></head><body>Complete policy</body></html>';

function mockFetch({ policy = null, food = { error: 'invalid_query' }, foodStatus = 400 } = {}) {
  return async url => url.includes('/api/food-search')
    ? { status: foodStatus, json: async () => food }
    : { status: 200, ok: true, text: async () => policy || goodHtml(url.includes('privacy') ? 'privacy' : 'terms') };
}

test('resolves legal pages from configured site and food URL independently', () => {
  assert.deepEqual(resolveUrls({ ...env, EXPO_PUBLIC_FOOD_SEARCH_URL: 'https://api.example.org/api/food-search' }), {
    privacy: 'https://release.example.org/legal/privacy.html',
    terms: 'https://release.example.org/legal/terms.html',
    food: 'https://api.example.org/api/food-search?q='
  });
});

test('rejects missing or unsafe production URLs', () => {
  assert.throws(() => resolveUrls({}), /EXPO_PUBLIC_SITE_URL/);
  assert.throws(() => resolveUrls({ ...env, EXPO_PUBLIC_SITE_URL: 'http://release.example.org' }), /HTTPS origin/);
  assert.throws(() => resolveUrls({ ...env, EXPO_PUBLIC_SITE_URL: 'https://release.example.org/something' }), /HTTPS origin/);
  assert.throws(() => resolveUrls({ ...env, EXPO_PUBLIC_FOOD_SEARCH_URL: 'http://api.example.org/api/food-search' }), /safe HTTPS URL/);
});

test('passes completed legal pages and a working input-validation-only food route', async () => {
  const result = await runChecks(env, mockFetch());
  assert.equal(result.ok, true);
  assert.equal(result.results.length, 3);
});

test('rejects missing legal pages and unfinished factual placeholders', async () => {
  const missing = await runChecks(env, async url => url.includes('food-search')
    ? { status: 400, json: async () => ({ error: 'invalid_query' }) }
    : { status: 404, ok: false, text: async () => '<html>Not Found</html>' });
  assert.equal(missing.ok, false);
  assert.equal(missing.results.filter(x => !x.ok).length, 2);
  const placeholder = await runChecks(env, mockFetch({ policy: '<html>{{LEGAL_ENTITY}}</html>' }));
  assert.equal(placeholder.ok, false);
});

test('rejects a 404 marketing site instead of a real food-search API', async () => {
  const result = await runChecks(env, mockFetch({ foodStatus: 404, food: { error: 'not_found' } }));
  assert.equal(result.ok, false);
  assert.equal(result.results.find(x => x.name === 'food').ok, false);
});

test('reports a network outage without throwing or sending secrets', async () => {
  const result = await runChecks(env, async () => { throw new Error('unreachable'); });
  assert.equal(result.ok, false);
  assert.equal(result.results.filter(x => !x.ok).length, 3);
});

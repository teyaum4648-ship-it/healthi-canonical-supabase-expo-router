import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
const roots: string[] = [];
const script = resolve('scripts/check-ios-release-config.cjs');
function check(overrides: Record<string, string | undefined> = {}, policy = 'Fixture policy') {
  const dir = mkdtempSync(join(tmpdir(), 'release-config-')); roots.push(dir);
  mkdirSync(join(dir, 'public/legal'), { recursive: true });
  writeFileSync(join(dir, 'public/legal/privacy.html'), policy);
  writeFileSync(join(dir, 'package.json'), '{"name":"release-check-fixture","version":"1.0.0"}');
  writeFileSync(join(dir, 'app.json'), JSON.stringify({ expo: { name: 'Fixture', slug: 'fixture', ios: { bundleIdentifier: 'com.daywoven.releasecheck' }, extra: { eas: { projectId: '81000000-0000-4000-8000-000000000001' } } } }));
  const env = { ...process.env, EXPO_PUBLIC_DEMO_MODE: 'false', EXPO_PUBLIC_SUPABASE_URL: 'https://releasecheck.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture_not_a_real_key_12345', EXPO_PUBLIC_SITE_URL: 'https://daywovenapp.com', EXPO_PUBLIC_FOOD_SEARCH_URL: '/api/food-search', ...overrides };
  return spawnSync(process.execPath, [script], { cwd: dir, env, encoding: 'utf8' });
}
afterEach(() => { roots.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
describe('iOS release configuration guard (synthetic configuration only)', () => {
  it('accepts relative food search backed by an HTTPS site', () => { expect(check().status).toBe(0); });
  it.each([{ EXPO_PUBLIC_DEMO_MODE: 'true' }, { EXPO_PUBLIC_SITE_URL: 'http://daywovenapp.com' }, { EXPO_PUBLIC_SUPABASE_URL: 'https://127.0.0.1' }, { EXPO_PUBLIC_SUPABASE_ANON_KEY: 'not-a-public-key' }])('rejects incomplete or unsafe configuration', overrides => { expect(check(overrides).status).toBe(1); });
  it('rejects privileged credentials without printing their values', () => {
    const secret = 'sb_secret_fixture_never_real_123456789'; const result = check({ EXPO_PUBLIC_SUPABASE_ANON_KEY: secret });
    expect(result.status).toBe(1); expect(result.stderr).toContain('privileged'); expect(result.stderr).not.toContain(secret);
  });
  it('blocks unfinished legal facts', () => { const result = check({}, '{{LEGAL_ENTITY}}'); expect(result.status).toBe(1); expect(result.stderr).toContain('privacy.html'); });
});

import { describe, expect, it, vi } from 'vitest';
import { accountKeyPrefixes, accountMapKeys, clearAccountData } from '../../../src/features/auth/accountDataCleanup';
const owner = '71000000-0000-4000-8000-000000000001';
const other = '71000000-0000-4000-8000-000000000002';
function storage(values: Record<string, string>) {
  return { getItem: vi.fn(async (key: string) => values[key] ?? null), setItem: vi.fn(async (key: string, value: string) => { values[key] = value; }), removeItem: vi.fn(async (key: string) => { delete values[key]; }) };
}
describe('Deleted account local data', () => {
  it('removes all known account stores while preserving other accounts and demo', async () => {
    const values: Record<string, string> = {};
    for (const key of accountMapKeys) values[key] = JSON.stringify({ [owner]: ['private'], [other]: ['keep'], demo: ['demo'] });
    for (const prefix of accountKeyPrefixes) { values[prefix + owner] = 'remove'; values[prefix + other] = 'keep'; }
    values['sb-project-auth-token'] = 'handled by Supabase signOut';
    await clearAccountData(storage(values), owner);
    for (const key of accountMapKeys) expect(JSON.parse(values[key])).toEqual({ [other]: ['keep'], demo: ['demo'] });
    for (const prefix of accountKeyPrefixes) { expect(values[prefix + owner]).toBeUndefined(); expect(values[prefix + other]).toBe('keep'); }
    expect(values['sb-project-auth-token']).toBe('handled by Supabase signOut');
  });
  it('preserves corrupt mixed-account data and reports incomplete cleanup', async () => {
    const s = storage({ [accountMapKeys[0]]: '{broken' });
    await expect(clearAccountData(s, owner)).rejects.toThrow(); expect(s.removeItem).not.toHaveBeenCalled();
  });
  it('rejects demo and invalid identities', async () => {
    const s = storage({}); await expect(clearAccountData(s, 'demo')).rejects.toThrow(); expect(s.getItem).not.toHaveBeenCalled();
  });
  it('reports failed writes rather than claiming local deletion worked', async () => {
    const s = storage({}); s.removeItem.mockRejectedValue(new Error('full'));
    await expect(clearAccountData(s, owner)).rejects.toThrow('full');
  });
});

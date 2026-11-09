import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { readLimitedJson } from '../../supabase/functions/_shared/requestLimits';

function harness(options: { user?: { id: string; email?: string } | null; passwordUser?: string; passwordError?: boolean; deleteError?: boolean } = {}) {
  const user = options.user === undefined ? { id: 'owner', email: 'owner@example.invalid' } : options.user;
  const deleteUser = vi.fn(async () => ({ error: options.deleteError ? new Error('private backend detail') : null }));
  const signInWithPassword = vi.fn(async () => ({ data: { user: { id: options.passwordUser ?? 'owner' } }, error: options.passwordError ? new Error('bad password') : null }));
  let handler!: (r: Request) => Promise<Response>;
  const source = readFileSync(new URL('../../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: {}, Request, Response,
    Deno: { env: { get: () => undefined }, serve: (fn: typeof handler) => { handler = fn; } },
    require: (name: string) => name.includes('esm.sh') ? { createClient: () => ({ auth: { signInWithPassword } }) }
      : name.includes('auth.ts') ? { authenticatedUser: async () => user, serviceClient: () => ({ auth: { admin: { deleteUser } } }) }
      : name.includes('requestLimits') ? { readLimitedJson }
      : { corsHeaders: {}, jsonResponse: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }) }
  });
  return { deleteUser, signInWithPassword, request: (body: unknown = { confirmation: 'DELETE', password: 'current-password' }, method = 'POST') => handler(new Request('https://example.invalid/delete-account', { method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) })) };
}

describe('Account deletion boundary', () => {
  it('hard deletes exactly the verified and reauthenticated owner', async () => {
    const h = harness(); const r = await h.request();
    expect(await r.json()).toEqual({ deleted: true });
    expect(h.signInWithPassword).toHaveBeenCalledWith({ email: 'owner@example.invalid', password: 'current-password' });
    expect(h.deleteUser).toHaveBeenCalledExactlyOnceWith('owner', false);
  });
  it.each([null, { id: 'owner' }])('rejects unauthenticated or email-less identities', async user => {
    const h = harness({ user }); expect((await h.request()).status).toBe(401); expect(h.deleteUser).not.toHaveBeenCalled();
  });
  it.each([{ passwordError: true }, { passwordUser: 'other' }])('rejects wrong password or another verified identity', async options => {
    const h = harness(options); expect((await h.request()).status).toBe(403); expect(h.deleteUser).not.toHaveBeenCalled();
  });
  it.each([{}, null, [], { confirmation: 'yes', password: 'password' }, { confirmation: 'DELETE', password: 'password', user_id: 'other' }, { confirmation: 'DELETE', password: 'x'.repeat(5000) }])('rejects malformed, oversized, or target-override requests', async body => {
    const h = harness(); expect((await h.request(body)).status).toBe(400); expect(h.signInWithPassword).not.toHaveBeenCalled(); expect(h.deleteUser).not.toHaveBeenCalled();
  });
  it('does not claim success or expose provider details if deletion fails', async () => {
    const h = harness({ deleteError: true }); const r = await h.request();
    expect(r.status).toBe(503); expect(await r.json()).toEqual({ error: 'deletion_failed' });
  });
  it('does not mutate data on GET or OPTIONS', async () => {
    const h = harness(); expect((await h.request(null, 'GET')).status).toBe(405); expect((await h.request(null, 'OPTIONS')).status).toBe(200); expect(h.deleteUser).not.toHaveBeenCalled();
  });
});

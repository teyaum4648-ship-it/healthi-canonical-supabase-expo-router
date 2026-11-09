import { describe, expect, it, vi } from 'vitest';
import { authRedirectUrl, exchangeAuthCallback, parseAuthCallback, passwordResetValidation } from '../../../src/features/auth/authLinks';

const nativeCallback = 'healthi://auth/callback';
const webCallback = 'https://app.example.test/auth/callback';

describe('auth email callback validation', () => {
  it('preserves the configured callback origin and native scheme', () => {
    expect(authRedirectUrl(nativeCallback, true)).toBe('healthi://auth/callback?flow=recovery');
    expect(authRedirectUrl(webCallback)).toBe(webCallback);
  });
  it('reads native implicit recovery credentials from fragments without exposing them in messages', () => {
    expect(parseAuthCallback(`${nativeCallback}?flow=recovery#access_token=example-access&refresh_token=example-refresh&type=recovery`, nativeCallback)).toEqual({
      kind: 'tokens', accessToken: 'example-access', refreshToken: 'example-refresh', recovery: true
    });
  });
  it('accepts the equivalent three-slash custom-scheme spelling', () => {
    expect(parseAuthCallback('healthi:///auth/callback?code=one-use-code', nativeCallback)).toEqual({ kind: 'code', code: 'one-use-code', recovery: false });
  });
  it('accepts PKCE callbacks on the expected web origin and route', () => {
    expect(parseAuthCallback(`${webCallback}?code=one-use-code&flow=recovery`, webCallback)).toEqual({ kind: 'code', code: 'one-use-code', recovery: true });
  });
  it.each([
    'https://other.example.test/auth/callback?code=secret-code',
    'https://app.example.test/other?code=secret-code',
    'http://app.example.test/auth/callback?code=secret-code',
    'https://user:password@app.example.test/auth/callback?code=secret-code',
    'javascript:alert(1)'
  ])('rejects a callback outside the expected location (%s)', value => {
    expect(() => parseAuthCallback(value, webCallback)).toThrow('could not be verified');
  });
  it.each([
    `${nativeCallback}#access_token=example-access`,
    `${nativeCallback}#refresh_token=example-refresh`,
    `${nativeCallback}?flow=recovery`,
    `${nativeCallback}?code=code#access_token=access&refresh_token=refresh`,
    `${nativeCallback}?error=access_denied&error_description=private-details`
  ])('rejects missing, mixed, or expired credentials without echoing sensitive data', value => {
    let message = '';
    try { parseAuthCallback(value, nativeCallback); } catch (error) { message = (error as Error).message; }
    expect(message).toContain('Request a new email');
    expect(message).not.toContain('example-access');
    expect(message).not.toContain('private-details');
  });
});

describe('verified callback exchange', () => {
  const session = { user: { id: 'test-user' } };
  const client = () => ({
    exchangeCodeForSession: vi.fn(async (_code: string) => ({ data: { session, redirectType: 'recovery' }, error: null })),
    setSession: vi.fn(async (_tokens: { access_token: string; refresh_token: string }) => ({ data: { session }, error: null }))
  });
  it('exchanges a code exactly through the code API and respects the provider recovery marker', async () => {
    const auth = client();
    await expect(exchangeAuthCallback(auth, { kind: 'code', code: 'test-code', recovery: false })).resolves.toEqual({ session, recovery: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    expect(auth.setSession).not.toHaveBeenCalled();
  });
  it('verifies an implicit link by establishing a session with both tokens', async () => {
    const auth = client();
    await expect(exchangeAuthCallback(auth, { kind: 'tokens', accessToken: 'test-access', refreshToken: 'test-refresh', recovery: true })).resolves.toEqual({ session, recovery: true });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'test-access', refresh_token: 'test-refresh' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('does not treat URL parameters as a session when Supabase refuses the link', async () => {
    const auth = { ...client(), setSession: vi.fn(async () => ({ data: { session: null }, error: { message: 'internal token details' } })) };
    await expect(exchangeAuthCallback(auth, { kind: 'tokens', accessToken: 'test-access', refreshToken: 'test-refresh', recovery: true })).rejects.toThrow('could not be verified');
  });
  it('requires a real session even if the provider returned no error', async () => {
    const auth = { ...client(), exchangeCodeForSession: vi.fn(async () => ({ data: { session: null }, error: null })) };
    await expect(exchangeAuthCallback(auth, { kind: 'code', code: 'test-code', recovery: true })).rejects.toThrow('could not be verified');
  });
});

describe('new password validation', () => {
  it('requires eight characters and matching confirmation without trimming a password', () => {
    expect(passwordResetValidation('short', 'short')).toContain('8 characters');
    expect(passwordResetValidation('long-password', 'different')).toContain('do not match');
    expect(passwordResetValidation(' long-password ', ' long-password ')).toBeNull();
  });
});

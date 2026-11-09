/** Auth email links are consumed explicitly on both native and web builds. */
export type AuthCallback =
  | { kind: 'code'; code: string; recovery: boolean }
  | { kind: 'tokens'; accessToken: string; refreshToken: string; recovery: boolean };

const INVALID_LINK = 'That sign-in link is missing, expired, or could not be verified. Request a new email and open its latest link.';

/** Uses the existing app scheme on native and the current origin on the web. */
export function authRedirectUrl(callbackUrl: string, recovery = false): string {
  const url = new URL(callbackUrl);
  if (recovery) url.searchParams.set('flow', 'recovery');
  return url.toString();
}

function isExpectedCallback(url: URL, expected: URL): boolean {
  if (url.protocol !== expected.protocol || url.username || url.password) return false;
  // Native deep links may spell the route with either two or three slashes.
  if (url.protocol === 'healthi:') {
    const route = (value: URL) => `${value.hostname}/${value.pathname}`.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    return route(url) === route(expected);
  }
  return url.host === expected.host && url.pathname.replace(/\/$/, '') === expected.pathname.replace(/\/$/, '');
}

/** Do not log callback URLs: implicit links carry bearer tokens in their fragment. */
export function parseAuthCallback(value: string, expectedCallbackUrl: string): AuthCallback {
  let url: URL;
  try {
    url = new URL(value);
    if (!isExpectedCallback(url, new URL(expectedCallbackUrl))) throw new Error(INVALID_LINK);
  } catch {
    throw new Error(INVALID_LINK);
  }
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const get = (key: string) => url.searchParams.get(key) ?? fragment.get(key);
  if (get('error') || get('error_code') || get('error_description')) throw new Error(INVALID_LINK);
  const recovery = get('type') === 'recovery' || get('flow') === 'recovery';
  const code = get('code');
  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  if (code && !accessToken && !refreshToken) return { kind: 'code', code, recovery };
  if (accessToken && refreshToken && !code) return { kind: 'tokens', accessToken, refreshToken, recovery };
  throw new Error(INVALID_LINK);
}

type CallbackResult<T> = {
  data: { session: T | null; redirectType?: string | null };
  error: { message: string } | null;
};
export type AuthCallbackClient<T> = {
  exchangeCodeForSession(code: string): Promise<CallbackResult<T>>;
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<CallbackResult<T>>;
};

/** Success requires a session verified by Supabase, never just URL parameters. */
export async function exchangeAuthCallback<T>(client: AuthCallbackClient<T>, callback: AuthCallback): Promise<{ session: T; recovery: boolean }> {
  const result = callback.kind === 'code'
    ? await client.exchangeCodeForSession(callback.code)
    : await client.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
  if (result.error || !result.data.session) throw new Error(INVALID_LINK);
  return { session: result.data.session, recovery: callback.recovery || result.data.redirectType === 'recovery' };
}

export function passwordResetValidation(password: string, confirmation: string): string | null {
  if (password.length < 8) return 'Choose a password with at least 8 characters.';
  if (password !== confirmation) return 'The passwords do not match.';
  return null;
}

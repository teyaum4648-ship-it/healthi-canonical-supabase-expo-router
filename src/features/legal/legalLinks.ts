import { Platform } from 'react-native';

import { LEGAL_FILENAMES, type LegalDocument } from './legalDocuments';

/**
 * Where the public legal pages live, and how a screen gets to one.
 *
 * The pages themselves are static HTML under `public/legal/`, not app routes. That is
 * deliberate: an App Store reviewer, a search crawler and a person with JavaScript
 * switched off all need to be able to read a privacy policy, and none of them should
 * have to boot a React app to do it.
 *
 * On the web export a relative path is enough, because the pages ship alongside the
 * bundle. A native build has no origin of its own, so it needs EXPO_PUBLIC_SITE_URL to
 * be set. When it isn't, `legalUrl` returns null rather than handing Linking a path it
 * cannot open, and callers fall back to plain text — a label that does nothing when
 * tapped is worse than a label that was never a link.
 */

export { CONSENT_VERSION, LEGAL_TITLES, MINIMUM_AGE, type LegalDocument } from './legalDocuments';

/** Trailing slashes are stripped so the join below cannot produce a double slash. */
function siteOrigin(): string | null {
  const configured = process.env.EXPO_PUBLIC_SITE_URL?.trim();
  return configured ? configured.replace(/\/+$/, '') : null;
}

export function legalUrl(doc: LegalDocument): string | null {
  const path = `/legal/${LEGAL_FILENAMES[doc]}`;
  const origin = siteOrigin();
  if (origin) return `${origin}${path}`;
  return Platform.OS === 'web' ? path : null;
}

export function legalIndexUrl(): string | null {
  const origin = siteOrigin();
  if (origin) return `${origin}/legal/`;
  return Platform.OS === 'web' ? '/legal/' : null;
}

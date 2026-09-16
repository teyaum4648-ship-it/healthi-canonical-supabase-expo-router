/**
 * The legal documents, as data.
 *
 * Kept free of react-native so tests can import it: `legalLinks.ts` needs `Platform` to
 * decide whether a relative path will resolve, and pulling react-native into a test run
 * makes the bundler parse Flow-typed JavaScript, which it cannot.
 */

export type LegalDocument =
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'refunds'
  | 'accessibility'
  | 'attributions';

export const LEGAL_FILENAMES: Record<LegalDocument, string> = {
  terms: 'terms.html',
  privacy: 'privacy.html',
  cookies: 'cookies.html',
  refunds: 'refunds.html',
  accessibility: 'accessibility.html',
  attributions: 'attributions.html'
};

export const LEGAL_TITLES: Record<LegalDocument, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  cookies: 'Cookies & local storage',
  refunds: 'Refund Policy',
  accessibility: 'Accessibility',
  attributions: 'Attributions & licences'
};

/**
 * The consent version recorded against a signup. Bump this when the wording of what a
 * person agreed to changes, so `user_consents.version` says which text they saw rather
 * than only that they ticked something once.
 */
export const CONSENT_VERSION = '2026-09-16.1';

export const MINIMUM_AGE = 18;

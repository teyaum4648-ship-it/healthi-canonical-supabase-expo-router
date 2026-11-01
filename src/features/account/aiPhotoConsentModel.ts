/**
 * Permission to send a meal photo to an outside AI service.
 *
 * A photo estimate uploads the picture to Anthropic, whose model identifies the foods.
 * App Store guideline 5.1.2(i) requires that an app say plainly when personal data goes
 * to a third-party AI and get explicit permission first, and the photo is personal data
 * even when it is only of a plate. So the permission is asked for on its own, before the
 * first photo, it starts as not given, and it can be turned off in Settings.
 *
 * Kept free of react-native and storage so it can be tested directly.
 */

/** Bump when the wording of the disclosure changes, so a stored grant says which text it answered. */
export const AI_PHOTO_CONSENT_VERSION = '2026-11-01.1';

export const AI_PHOTO_CONSENT_TYPE = 'ai_photo_estimate';

export type AiPhotoConsent = { granted: boolean; version: string | null; at: string | null };

export const NO_AI_PHOTO_CONSENT: AiPhotoConsent = { granted: false, version: null, at: null };

/** Anything unreadable, or a grant given to an older wording, reads as not given. */
export function parseAiPhotoConsent(raw: string | null): AiPhotoConsent {
  if (!raw) return NO_AI_PHOTO_CONSENT;
  try {
    const value = JSON.parse(raw) as Partial<AiPhotoConsent>;
    if (value.granted !== true || value.version !== AI_PHOTO_CONSENT_VERSION) return NO_AI_PHOTO_CONSENT;
    return { granted: true, version: value.version, at: typeof value.at === 'string' ? value.at : null };
  } catch {
    return NO_AI_PHOTO_CONSENT;
  }
}

/**
 * The row written to `user_consents`. Consent is an append-only log: a withdrawal is a
 * new row with `granted: false`, never an edit of the grant, so the history of what a
 * person said and when stays intact. The latest row for the type is the current answer.
 */
export function aiPhotoConsentRow(userId: string, granted: boolean, at: string) {
  return {
    user_id: userId,
    consent_type: AI_PHOTO_CONSENT_TYPE,
    granted,
    version: AI_PHOTO_CONSENT_VERSION,
    granted_at: granted ? at : null,
    revoked_at: granted ? null : at,
    metadata: { captured_at: 'photo_estimate', processor: 'anthropic' }
  };
}

export const AI_PHOTO_DISCLOSURE = {
  title: 'Send this photo to an AI service?',
  body:
    'To estimate a meal, daywoven sends the photo — and any note you add — to Anthropic, an ' +
    'AI company that provides the model which identifies the foods. Nothing else about you is ' +
    'sent with it: no name, no email, no health history. Anthropic processes it to return the ' +
    'estimate and does not use it to train its models. daywoven does not keep the photo.',
  footnote: 'You can turn this off any time in Menu → Your data and account. Searching or scanning a barcode never sends a photo.'
} as const;

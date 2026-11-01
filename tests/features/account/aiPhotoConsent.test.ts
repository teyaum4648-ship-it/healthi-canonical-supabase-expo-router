import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  AI_PHOTO_CONSENT_TYPE,
  AI_PHOTO_CONSENT_VERSION,
  AI_PHOTO_DISCLOSURE,
  aiPhotoConsentRow,
  parseAiPhotoConsent
} from '../../../src/features/account/aiPhotoConsentModel';

describe('AI photo consent', () => {
  it('starts as not given', () => {
    expect(parseAiPhotoConsent(null).granted).toBe(false);
    expect(parseAiPhotoConsent('not json').granted).toBe(false);
  });

  it('reads a grant to the current wording as given', () => {
    const raw = JSON.stringify({ granted: true, version: AI_PHOTO_CONSENT_VERSION, at: '2026-11-01T00:00:00Z' });
    expect(parseAiPhotoConsent(raw)).toEqual({ granted: true, version: AI_PHOTO_CONSENT_VERSION, at: '2026-11-01T00:00:00Z' });
  });

  it('asks again when the disclosure wording has changed', () => {
    expect(parseAiPhotoConsent(JSON.stringify({ granted: true, version: 'older' })).granted).toBe(false);
  });

  it('records a withdrawal as a new row rather than an edit', () => {
    const at = '2026-11-01T00:00:00Z';
    expect(aiPhotoConsentRow('u', true, at)).toMatchObject({ consent_type: AI_PHOTO_CONSENT_TYPE, granted: true, granted_at: at, revoked_at: null });
    expect(aiPhotoConsentRow('u', false, at)).toMatchObject({ consent_type: AI_PHOTO_CONSENT_TYPE, granted: false, granted_at: null, revoked_at: at });
  });

  it('matches the consent type the photo-estimate function checks', () => {
    const fn = readFileSync('supabase/functions/photo-estimate/index.ts', 'utf8');
    expect(fn).toContain(`.eq('consent_type', '${AI_PHOTO_CONSENT_TYPE}')`);
  });

  it('names the outside service and says what is and is not sent', () => {
    expect(AI_PHOTO_DISCLOSURE.body).toMatch(/Anthropic/);
    expect(AI_PHOTO_DISCLOSURE.body).toMatch(/no name, no email, no health history/);
    expect(AI_PHOTO_DISCLOSURE.footnote).toMatch(/turn this off/);
  });
});

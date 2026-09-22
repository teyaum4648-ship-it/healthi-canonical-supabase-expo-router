import { describe, expect, it } from 'vitest';

import { consentIsComplete, EMPTY_CONSENT } from '../../../src/features/legal/consentModel';
import {
  CONSENT_VERSION,
  LEGAL_FILENAMES,
  LEGAL_TITLES,
  MINIMUM_AGE
} from '../../../src/features/legal/legalDocuments';

describe('signup consent', () => {
  it('starts with nothing agreed to', () => {
    expect(EMPTY_CONSENT).toEqual({ agreement: false, healthData: false });
    expect(consentIsComplete(EMPTY_CONSENT)).toBe(false);
  });

  it('is incomplete while either box is unticked', () => {
    expect(consentIsComplete({ agreement: true, healthData: false })).toBe(false);
    expect(consentIsComplete({ agreement: false, healthData: true })).toBe(false);
  });

  it('is complete only when both are ticked', () => {
    expect(consentIsComplete({ agreement: true, healthData: true })).toBe(true);
  });

  it('keeps the health-data consent separate from the terms acceptance', () => {
    /*
     * Guards against someone collapsing these into one flag for tidiness. Bundling the
     * health-data permission into the terms acceptance is the specific thing Washington's
     * My Health My Data Act forbids, so the two have to stay independently settable.
     */
    const keys = Object.keys(EMPTY_CONSENT).sort();
    expect(keys).toEqual(['agreement', 'healthData']);
  });
});

describe('legal metadata', () => {
  it('records a consent version that can be compared', () => {
    // Dated form, so a stored consent says which wording the person actually saw.
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it('is an adults-only product', () => {
    expect(MINIMUM_AGE).toBe(18);
  });

  it('names every document the website publishes', () => {
    expect(Object.keys(LEGAL_FILENAMES).sort()).toEqual(Object.keys(LEGAL_TITLES).sort());
    expect(Object.keys(LEGAL_TITLES).sort()).toEqual([
      'accessibility',
      'attributions',
      'cookies',
      'privacy',
      'refunds',
      'terms'
    ]);
  });
});

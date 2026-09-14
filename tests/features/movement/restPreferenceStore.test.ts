import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REST_ENABLED,
  parseRestEnabled,
  restPreferenceScope
} from '../../../src/features/movement/restPreferenceStore';

describe('whether a set starts a rest timer', () => {
  it('runs unless someone has said otherwise', () => {
    // A missing or unreadable value must not silently take the timer away.
    expect(DEFAULT_REST_ENABLED).toBe(true);
    expect(parseRestEnabled(null)).toBe(true);
    expect(parseRestEnabled('')).toBe(true);
    expect(parseRestEnabled('nonsense')).toBe(true);
    expect(parseRestEnabled('on')).toBe(true);
  });

  it('honours an explicit off', () => {
    expect(parseRestEnabled('off')).toBe(false);
  });

  it('keeps one person’s answer away from another’s', () => {
    expect(restPreferenceScope('2f1a7e5c-9b3d-4a8e-8f21-5c6d7e8a9b01'))
      .toBe('2f1a7e5c-9b3d-4a8e-8f21-5c6d7e8a9b01');
    expect(restPreferenceScope(null)).toBe('demo');
    expect(restPreferenceScope('not-a-uuid')).toBe('demo');
  });
});

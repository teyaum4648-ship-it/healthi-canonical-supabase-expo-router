/**
 * The signup consent state, kept apart from the component that renders it so it can be
 * tested directly — screens in this repo keep their logic in a plain module for exactly
 * this reason.
 *
 * Two flags rather than one. `agreement` covers the contract — terms, privacy policy and
 * the age declaration, which stand or fall together. `healthData` is the separate,
 * specific permission to hold health information, which Washington's My Health My Data
 * Act requires be asked for on its own and not bundled into a terms acceptance.
 */

export type ConsentState = {
  agreement: boolean;
  healthData: boolean;
};

/** Nothing is pre-ticked. A consent that defaults to true is not a consent. */
export const EMPTY_CONSENT: ConsentState = { agreement: false, healthData: false };

export function consentIsComplete(state: ConsentState): boolean {
  return state.agreement && state.healthData;
}

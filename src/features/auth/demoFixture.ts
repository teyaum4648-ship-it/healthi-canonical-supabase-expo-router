import { demoOnboardingCompletedKey, demoSessionActiveKey } from './demoLifecycle';

/**
 * The storage a finished demo profile looks like.
 *
 * This exists because verifying a screen was harder than building it. The demo gates on
 * a signed-in session and a completed onboarding, so any attempt to open a tab without
 * walking the whole wizard lands back on the marketing page — and the wizard is slow,
 * has text inputs, and cannot be driven reliably.
 *
 * The values are the trap. `parseDemoOnboardingStatus` reads the literal string 'true'
 * as completed, so seeding the obvious-looking 'completed' parses as `not_started` and
 * bounces silently, which is precisely the wrong turn that cost this feature its first
 * look at itself. Deriving the pairs from the real key constants here means a rename
 * cannot leave a stale copy behind in a script.
 *
 * Only for local verification. Nothing in the app reads this, and it grants nothing: it
 * is the demo, which stores everything on the device and signs nobody in.
 */
export const DEMO_COMPLETED_STATE: ReadonlyArray<readonly [string, string]> = [
  [demoSessionActiveKey, 'true'],
  [demoOnboardingCompletedKey, 'true']
];

/** The same thing as a plain object, for handing to a browser's localStorage. */
export function demoCompletedStorage(): Record<string, string> {
  return Object.fromEntries(DEMO_COMPLETED_STATE.map(([key, value]) => [key, value]));
}

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export const accountMapKeys = [
  'healthi:coachingLoop:protocol:v1', 'healthi:coachingLoop:closeout:v1',
  'healthi:practice:breath:v1', 'healthi:practice:pulse:v1', 'healthi:mood:head:v1',
  'healthi:practice:daylight:v1', 'healthi:practice:zone:v1',
  'healthi:practice:habits:completions:v1', 'healthi:practice:habits:custom:v1',
  'healthi:practice:habits:routine:v1', 'healthi:health:steps:v1', 'healthi:biomarkers:v1',
  'healthi:readiness:history:v1', 'healthi:loadcheck:v1', 'healthi:sleep:morning-report:v1',
  'healthi:caffeine:v1', 'healthi.circadian.chronotype.v1', 'healthi.movement.screen.v1'
] as const;
export const accountKeyPrefixes = [
  'healthi:movement:weightUnit:v1:', 'healthi:movement:restTimerEnabled:v1:',
  'healthi:movement:routines:v1:', 'healthi:movement:workoutDraft:v1:',
  'healthi:nutrition:allergenProfile:v1:', 'healthi:onboarding:'
] as const;

/** Remove only the specified account. Never clear another account, demo, or shared catalogue. */
export async function clearAccountData(storage: Storage, userId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId)) throw new Error('Invalid account identity.');
  const updates: { key: string; value: string }[] = [];
  // Parse every mixed-account map first. Corruption must not erase other people's data.
  for (const key of accountMapKeys) {
    const raw = await storage.getItem(key);
    if (!raw) continue;
    const map: unknown = JSON.parse(raw);
    if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('Local account data needs recovery.');
    if (Object.prototype.hasOwnProperty.call(map, userId)) {
      const next = { ...map } as Record<string, unknown>;
      delete next[userId];
      updates.push({ key, value: JSON.stringify(next) });
    }
  }
  for (const { key, value } of updates) await storage.setItem(key, value);
  for (const prefix of accountKeyPrefixes) await storage.removeItem(`${prefix}${userId}`);
}

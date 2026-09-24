export const demoSessionActiveKey = 'healthi:demo:sessionActive';
export const demoOnboardingCompletedKey = 'healthi:demo:onboardingCompleted';

export function parseDemoOnboardingStatus(value: string | null): 'not_started' | 'in_progress' | 'completed' {
  return value === 'true' ? 'completed' : value === 'false' ? 'in_progress' : 'not_started';
}

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Explicit demo keys only. Never clear auth tokens or another user's scope. */
export const resettableDemoKeys = [
  demoOnboardingCompletedKey,
  'healthi:demo:onboardingResult',
  'healthi:onboarding:demo-user',
  'healthi:demo:nutrition:mealLogs',
  'healthi:demo:nutrition:postMealResponses',
  'healthi:demo:nutrition:foodPatternProfile',
  'healthi:demo:nutrition:userFoodProducts',
  'healthi:demo:nutrition:mealLogItems',
  'healthi:demo:nutrition:goalSetup',
  'healthi:demo:nutrition:mealCollection',
  'healthi:demo:nutrition:mealEditJournal',
  'healthi:demo:movement:exerciseLibrary',
  'healthi:demo:movement:workoutSessions',
  'healthi:demo:movement:workoutExerciseEntries',
  'healthi:demo:movement:workoutSetEntries',
  'healthi:demo:dayPlan:scheduleBlocks',
  'healthi.sleep-window.sessions.v1',
  'healthi:demo:hydration:entries',
  'healthi:demo:hydration:target',
  'healthi:demo:readiness-now:v1',
  'healthi:demo:foundations:scores'
] as const;

export async function resetDemoStorage(storage: Storage): Promise<void> {
  await Promise.all(resettableDemoKeys.map((key) => storage.removeItem(key)));
  for (const key of ['healthi:coachingLoop:protocol:v1', 'healthi:coachingLoop:closeout:v1']) {
    const raw = await storage.getItem(key);
    if (!raw) continue;
    // Corrupt mixed-account storage is preserved for recovery, never erased.
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const { demo: _removed, ...accounts } = parsed as Record<string, unknown>;
    await storage.setItem(key, JSON.stringify(accounts));
  }
  await storage.setItem(demoSessionActiveKey, 'true');
}

/** The installed web app launches at /. Wait for hydration before choosing a route. */
export function entryDestination(input: {
  isLoading: boolean;
  mode: 'demo' | 'account';
  hasSession: boolean;
  onboardingStatus?: 'not_started' | 'in_progress' | 'completed' | null;
}) {
  if (input.isLoading) return 'loading' as const;
  if (input.hasSession) return input.onboardingStatus === 'completed' ? '/(app)/(tabs)' as const : '/(onboarding)' as const;
  return input.mode === 'demo' ? 'demo' as const : 'welcome' as const;
}

import { Redirect, Stack } from 'expo-router';

import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { hasFinishedSetup } from '../../src/features/onboarding/questionnaireDraft';

export default function AuthLayout() {
  const { profile, session, isLoading, isPasswordRecovery } = useAuth();

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <SectionHeader title="daywoven" body="Checking your secure session." />
      </Screen>
    );
  }

  if (isPasswordRecovery && session) return <Redirect href="/auth/reset-password" />;

  if (session) {
    return (
      <Redirect
        href={hasFinishedSetup(profile?.onboarding_status) ? '/(app)/(tabs)' : '/(onboarding)'}
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false
      }}
    />
  );
}

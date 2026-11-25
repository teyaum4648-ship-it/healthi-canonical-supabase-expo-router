import { Redirect, Stack } from 'expo-router';

import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { hasFinishedSetup } from '../../src/features/onboarding/questionnaireDraft';

export default function OnboardingLayout() {
  const { profile, session, isLoading, isPasswordRecovery } = useAuth();

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <SectionHeader title="daywoven" body="Preparing your setup." />
      </Screen>
    );
  }

  if (isPasswordRecovery && session) return <Redirect href="/auth/reset-password" />;

  // The wellness questionnaire is previewable without an account.
  // The screen stores answers only on this device until signup consent is granted.

  if (hasFinishedSetup(profile?.onboarding_status)) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false
      }}
    />
  );
}

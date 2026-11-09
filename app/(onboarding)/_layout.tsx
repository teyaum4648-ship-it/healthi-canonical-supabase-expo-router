import { Redirect, Stack } from 'expo-router';

import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useAuth } from '../../src/features/auth/AuthProvider';

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

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (profile?.onboarding_status === 'completed') {
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

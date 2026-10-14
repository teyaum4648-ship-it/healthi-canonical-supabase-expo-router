import { Redirect, Stack } from 'expo-router';

import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useAuth } from '../../src/features/auth/AuthProvider';

export default function AuthLayout() {
  const { profile, session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <SectionHeader title="daywoven" body="Checking your secure session." />
      </Screen>
    );
  }

  if (session) {
    return (
      <Redirect
        href={profile?.onboarding_status === 'completed' ? '/(app)/(tabs)' : '/(onboarding)'}
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

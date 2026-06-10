import { Redirect } from 'expo-router';

import { Screen } from '../src/components/Screen';
import { SectionHeader } from '../src/components/SectionHeader';
import { useAuth } from '../src/features/auth/AuthProvider';

export default function IndexRoute() {
  const { profile, session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <SectionHeader title="Healthi" body="Loading your secure session." />
      </Screen>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Redirect
      href={profile?.onboarding_status === 'completed' ? '/(app)/(tabs)' : '/(onboarding)'}
    />
  );
}

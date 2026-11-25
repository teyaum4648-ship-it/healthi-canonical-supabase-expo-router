import { Redirect, Stack } from 'expo-router';

import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { useMembership } from '../../src/features/subscriptions/MembershipProvider';
import { hasFinishedSetup } from '../../src/features/onboarding/questionnaireDraft';

export default function ProtectedLayout() {
  const { profile, session, isLoading, isPasswordRecovery } = useAuth();
  const { status, billingRequired } = useMembership();

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <SectionHeader title="daywoven" body="Preparing your app." />
      </Screen>
    );
  }

  if (isPasswordRecovery && session) return <Redirect href="/auth/reset-password" />;

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!hasFinishedSetup(profile?.onboarding_status)) {
    return <Redirect href="/(onboarding)" />;
  }

  if (billingRequired && status === 'checking') {
    return <Screen scroll={false}><SectionHeader title="daywoven" body="Checking your membership." /></Screen>;
  }

  if (billingRequired && status !== 'active') return <Redirect href="/paywall" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false
      }}
    />
  );
}

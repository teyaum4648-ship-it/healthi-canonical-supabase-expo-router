import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/features/auth/AuthProvider';
import { MembershipScreen } from './(app)/subscription';
import { useMembership } from '../src/features/subscriptions/MembershipProvider';
import { colors, fonts } from '../src/styles/mobileTheme';

export default function OnboardingPaywall() {
  const { session, profile, isLoading, isPasswordRecovery, signOut } = useAuth();
  const { status, billingRequired, refreshMembership } = useMembership();

  if (isLoading) return <Screen><Text style={styles.note}>Preparing Daywoven.</Text></Screen>;
  if (isPasswordRecovery && session) return <Redirect href="/auth/reset-password" />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (profile?.onboarding_status !== 'completed') return <Redirect href="/(onboarding)" />;
  if (!billingRequired || status === 'active') return <Redirect href="/(app)/(tabs)" />;

  return (
    <View style={styles.container}>
      <MembershipScreen gated onUnlocked={refreshMembership} />
      <View style={styles.accountActions}>
        <Pressable accessibilityRole="button" onPress={() => void signOut().catch(() => undefined)}>
          <Text style={styles.note}>Sign out</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/account/delete')}>
          <Text style={styles.note}>Delete my account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  accountActions: { alignItems: 'center', flexDirection: 'row', gap: 28, justifyContent: 'center', paddingBottom: 24 },
  note: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 14 }
});

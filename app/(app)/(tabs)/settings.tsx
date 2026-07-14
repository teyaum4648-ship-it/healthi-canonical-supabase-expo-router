import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { loadProfileScreenModel } from '../../../src/features/profile/profileComposer';
import type { ProfileScreenModel } from '../../../src/features/profile/profileTypes';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import { colors, fonts, spacing } from '../../../src/styles/theme';

function statusLabel(value: 'ready' | 'partial' | 'calibrating'): string {
  return value === 'ready' ? 'Ready' : value === 'partial' ? 'Early pattern' : 'Calibrating';
}

export default function SettingsScreen() {
  const { signOut, user, profile } = useAuth();
  const [model, setModel] = useState<ProfileScreenModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const next = await loadProfileScreenModel({
      profile: profile
        ? {
            id: profile.id,
            display_name: profile.display_name,
            primary_goal: profile.primary_goal,
            onboarding_status: profile.onboarding_status
          }
        : null,
      email: user?.email,
      is_demo_mode: user?.id === 'demo-user' || !isSupabaseConfigured,
      supabase_client: supabase
    });
    setModel(next);
    setIsLoading(false);
  }, [profile, user?.email, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out right now.';
      Alert.alert('Sign out failed', message);
    }
  }

  const baseline = model?.baseline;

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Profile"
        title="You"
        body="Your baseline, preferences, and calibration status."
      />

      {isLoading || !model || !baseline ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Organizing your available data.</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.accountCard}>
            <Text style={styles.cardEyebrow}>ACCOUNT</Text>
            <Text style={styles.accountTitle}>{model.account.label}</Text>
            <Text style={styles.detail}>{model.account.detail}</Text>
            <Text style={styles.meta}>{model.account.source_label === 'demo' ? 'Local demo mode' : model.account.source_label === 'logged' ? 'Saved profile data' : 'Setup status'}</Text>
          </Card>

          <Card style={styles.baselineCard}>
            <Text style={styles.cardEyebrow}>YOUR BASELINE</Text>
            <Text style={styles.baselineTitle}>{baseline.headline}</Text>
            <Text style={styles.baselineDetail}>{baseline.detail}</Text>
            <Text style={styles.meta}>Confidence: {baseline.confidence}</Text>
          </Card>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Your profile</Text>
            <Text style={styles.sectionCaption}>Available signals</Text>
          </View>
          {baseline.profile_cards.length ? baseline.profile_cards.map((card) => (
            <Card key={card.id} style={styles.profileCard}>
              <Text style={styles.profileTitle}>{card.title}</Text>
              <Text style={styles.profileValue}>{card.value}</Text>
              <Text style={styles.detail}>{card.detail}</Text>
            </Card>
          )) : (
            <Card>
              <Text style={styles.profileTitle}>Baseline details</Text>
              <Text style={styles.detail}>Complete setup to add your goal and personal context.</Text>
            </Card>
          )}

          <Card style={styles.calibrationCard}>
            <Text style={styles.cardEyebrow}>CALIBRATION</Text>
            <Text style={styles.calibrationTitle}>{baseline.calibration.completion_label}</Text>
            <Text style={styles.detail}>{baseline.calibration.detail}</Text>
            <View style={styles.domainList}>
              {baseline.calibration.domains.map((domain) => (
                <View key={domain.domain} style={styles.domainRow}>
                  <View style={styles.domainText}>
                    <Text style={styles.domainLabel}>{domain.label}</Text>
                    <Text style={styles.domainDetail}>{domain.detail}</Text>
                  </View>
                  <Text style={[styles.domainStatus, domain.status === 'calibrating' && styles.domainStatusCalibrating]}>{statusLabel(domain.status)}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.cardEyebrow}>PREFERENCES</Text>
            {baseline.preferences.map((preference) => (
              <View key={preference.id} style={styles.preferenceRow}>
                <Text style={styles.preferenceTitle}>{preference.title}</Text>
                <Text style={styles.detail}>{preference.detail}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.nextStepsCard}>
            <Text style={styles.cardEyebrow}>NEXT STEPS</Text>
            {baseline.next_steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={styles.stepDot} />
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.detail}>{step.detail}</Text>
                </View>
              </View>
            ))}
          </Card>

          <Text style={styles.footer}>Healthi provides general wellness guidance based on available data.</Text>

          <Button label="Log out" onPress={handleSignOut} variant="secondary" />
          {model.load_error ? <Text style={styles.errorNote}>Some profile details are still calibrating while data becomes available.</Text> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 116 },
  loadingCard: { alignItems: 'center', justifyContent: 'center', minHeight: 150 },
  loadingText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  accountCard: { backgroundColor: colors.surfaceInset },
  baselineCard: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
  cardEyebrow: { color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.4 },
  accountTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33 },
  baselineTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  baselineDetail: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  detail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  meta: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: spacing.xs },
  sectionRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  sectionCaption: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  profileCard: { gap: spacing.xs },
  profileTitle: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  profileValue: { color: colors.text, fontFamily: fonts.display, fontSize: 23, lineHeight: 29 },
  calibrationCard: { gap: spacing.sm },
  calibrationTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  domainList: { borderTopColor: colors.hairline, borderTopWidth: 1, marginTop: spacing.xs },
  domainRow: { alignItems: 'center', borderBottomColor: colors.hairlineSoft, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', paddingVertical: spacing.sm },
  domainText: { flex: 1, gap: 2 },
  domainLabel: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 },
  domainDetail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  domainStatus: { color: colors.accentMid, fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: 'right' },
  domainStatusCalibrating: { color: colors.textMuted },
  preferenceRow: { gap: 2, paddingVertical: spacing.xs },
  preferenceTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 },
  nextStepsCard: { backgroundColor: colors.surfaceInset },
  stepRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  stepDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, marginTop: 7, width: 7 },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 },
  footer: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorNote: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'center' }
});

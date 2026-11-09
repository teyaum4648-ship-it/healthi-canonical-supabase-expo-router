import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { colors, type } from '../../src/styles/mobileTheme';

export default function AuthCallbackScreen() {
  const { mode, authCallbackUrl, completeAuthCallback } = useAuth();
  const [failure, setFailure] = useState<{ url: string; message: string } | null>(null);
  const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : authCallbackUrl;
  const error = failure?.url === url ? failure.message : '';
  useEffect(() => {
    if (!url || mode === 'demo') return;
    let active = true;
    void completeAuthCallback(url).then(result => {
      if (!active) return;
      // Remove bearer tokens and one-use codes from web history after consumption.
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', window.location.pathname);
      }
      router.replace(result === 'recovery' ? '/auth/reset-password' : '/');
    }).catch(() => {
      if (active) setFailure({ url, message: 'This link has expired or could not be verified. Request a new email and open its latest link.' });
    });
    return () => { active = false; };
  }, [url, mode, completeAuthCallback]);
  const unavailable = mode === 'demo';
  return <Screen>
    <SectionHeader title={error || unavailable ? 'Link unavailable' : 'Opening your account'} body="Confirming your email link securely." />
    <Card>
      {!error && !unavailable && url ? <ActivityIndicator color={colors.accent} /> : null}
      <Text accessibilityLiveRegion="polite" style={styles.message}>{unavailable ? 'Account email links are not enabled in this local demo.' : error || (url ? 'Please wait while we verify your link.' : 'Open the newest link from your account email on this device.')}</Text>
      {error || unavailable || !url ? <>
        <Link href="/(auth)/forgot-password" style={styles.link}>Request a new password-reset link</Link>
        <Link href="/(auth)/login" style={styles.link}>Back to login</Link>
      </> : null}
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({ message: { ...type.body, color: colors.textMuted }, link: { ...type.body, color: colors.accent } });

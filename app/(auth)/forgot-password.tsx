import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { DemoEntry } from '../../src/features/auth/DemoEntry';
import { colors, type } from '../../src/styles/mobileTheme';

export default function ForgotPasswordScreen() {
  const { mode, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await requestPasswordReset(email);
      // Same copy whether or not the email belongs to an account.
      setMessage('If an account uses that email, a password-reset link is on its way. Open the newest link on this device.');
    } catch {
      setMessage('Could not send a reset email right now. Please try again shortly.');
    } finally { setBusy(false); }
  }
  if (mode === 'demo') return <DemoEntry />;
  return <Screen>
    <SectionHeader title="Reset your password" body="Enter your account email and we’ll send a link to choose a new password." />
    <Card>
      <TextInput label="Email" autoComplete="email" inputMode="email" value={email} onChangeText={setEmail} placeholder="you@example.com" editable={!busy} />
      <Button label="Send reset link" isLoading={busy} onPress={() => void send()} />
      {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      <Link href="/(auth)/login" style={styles.link}>Back to login</Link>
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({ message: { ...type.body, color: colors.textMuted }, link: { ...type.body, color: colors.accent } });

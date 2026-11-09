import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { passwordResetValidation } from '../../src/features/auth/authLinks';
import { colors, type } from '../../src/styles/mobileTheme';

export default function ResetPasswordScreen() {
  const { session, isLoading, mode, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function save() {
    const invalid = passwordResetValidation(password, confirmation);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    setError('');
    try {
      await updatePassword(password);
      setPassword('');
      setConfirmation('');
      setSaved(true);
    } catch {
      setError('Could not update your password. Try again, or request a new reset link if this session has expired.');
    } finally { setBusy(false); }
  }
  if (isLoading) return <Screen><SectionHeader title="Checking your session" body="Please wait while your account opens." /></Screen>;
  // A URL alone never authorizes a password change; Supabase must establish a session.
  if (!session || mode === 'demo') return <Screen>
    <SectionHeader title="Open your reset email" body="Use the newest password-reset link to verify your account before choosing a password." />
    <Link href="/(auth)/forgot-password" style={styles.link}>Request a new reset link</Link>
  </Screen>;
  return <Screen>
    <SectionHeader title={saved ? 'Password updated' : 'Choose a new password'} body={saved ? 'You can use your new password next time you log in.' : 'Use at least eight characters and keep it unique to this account.'} />
    <Card>
      {saved ? <Button label="Continue to daywoven" onPress={() => router.replace('/')} /> : <>
        <TextInput label="New password" autoComplete="new-password" secureTextEntry value={password} onChangeText={setPassword} editable={!busy} />
        <TextInput label="Confirm new password" autoComplete="new-password" secureTextEntry value={confirmation} onChangeText={setConfirmation} editable={!busy} />
        <Button label="Save new password" isLoading={busy} onPress={() => void save()} />
        {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{error}</Text> : null}
        <Link href="/(auth)/forgot-password" style={styles.link}>Request another reset link</Link>
      </>}
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({ message: { ...type.body, color: colors.textMuted }, link: { ...type.body, color: colors.accent } });

import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { colors, type } from '../../src/styles/mobileTheme';

export default function DeleteAccountScreen() {
  const { deleteAccount, mode, session, isLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy || confirmation !== 'DELETE' || !password) return;
    setBusy(true);
    setError('');
    try {
      const result = await deleteAccount(password);
      setPassword('');
      if (!result.localCleanupComplete) Alert.alert('Account deleted', 'Your online account was deleted, but some local data could not be removed. Clear this app’s storage on this device before giving it to someone else.');
      router.replace('/(auth)/login');
    } catch {
      setPassword('');
      setError('Deletion was not confirmed. Check your password and connection, then try again. If you forgot your password, reset it from the login screen first.');
    } finally { setBusy(false); }
  }
  if (isLoading) return <Screen><Text style={styles.body}>Preparing your account.</Text></Screen>;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <Screen>
    <SectionHeader title="Delete your account" body="This permanently deletes your Daywoven account and its saved account data. You cannot undo this." />
    <Text style={styles.body}>Local Daywoven data for this account will also be removed from this device. Data in Apple Health stays in Apple Health. Other devices may retain local records; remove this app’s data there too. Backups expire according to our privacy policy.</Text>
    {mode === 'account' ? <>
      <TextInput label="Current password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} />
      <TextInput label="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} />
      {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
      <Button label="Permanently delete account" isLoading={busy} disabled={busy || confirmation !== 'DELETE' || !password} onPress={() => void remove()} />
    </> : <Text style={styles.body}>This is a local demo. Use “Start fresh demo” in Settings to remove demo history.</Text>}
    <Button label="Keep my account" variant="secondary" disabled={busy} onPress={() => router.back()} />
  </Screen>;
}
const styles = StyleSheet.create({ body: { ...type.body, color: colors.textMuted } });

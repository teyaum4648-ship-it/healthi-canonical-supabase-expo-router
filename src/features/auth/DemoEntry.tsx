import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SectionHeader } from '../../components/SectionHeader';
import { colors, type } from '../../styles/mobileTheme';
import { useAuth } from './AuthProvider';

export function DemoEntry() {
  const { startDemo } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState('');
  async function enter(fresh: boolean) {
    setBusy(true);
    setError('');
    try { await startDemo(fresh); }
    catch { setError('Your demo could not open. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <Screen appearance="mobile" contentStyle={{ justifyContent: 'center' }}>
      <SectionHeader appearance="mobile" eyebrow="Healthi preview" title="Start with your day" body="Explore your sleep, nourishment, movement, and daily plan with a clean profile." />
      <Card appearance="mobile">
        <Text style={{ ...type.body, color: colors.textMuted }}>This demo is saved on this device. It starts with onboarding and your own entries; sample health data is never added automatically.</Text>
        <Button appearance="mobile" label="Continue demo" isLoading={busy} onPress={() => void enter(false)} />
        <Button appearance="mobile" variant="secondary" label="Start a fresh demo" disabled={busy} onPress={() => setConfirmReset(true)} />
        {confirmReset ? <View style={{ gap: 12 }}>
          <Text style={{ ...type.body, color: colors.text }}>Reset the demo entries on this device and start onboarding again?</Text>
          <Button appearance="mobile" label="Reset demo and begin" isLoading={busy} onPress={() => void enter(true)} />
          <Button appearance="mobile" variant="secondary" label="Keep current demo" onPress={() => setConfirmReset(false)} />
        </View> : null}
        {error ? <Text accessibilityRole="alert" style={{ ...type.body, color: colors.text }}>{error}</Text> : null}
        <Text style={{ ...type.caption, color: colors.textMuted }}>Personal accounts and cross-device sync will be available when the beta account service is connected.</Text>
      </Card>
    </Screen>
  );
}

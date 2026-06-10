import { Alert, Text } from 'react-native';

import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { colors } from '../../../src/styles/theme';

export default function SettingsScreen() {
  const { signOut, user } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out right now.';
      Alert.alert('Sign out failed', message);
    }
  }

  return (
    <Screen>
      <SectionHeader
        eyebrow="Settings"
        title="Account"
        body="Privacy, consent, notifications, and profile controls will be expanded in later layers."
      />
      <Card>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          {user?.email ?? 'Signed in'}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>
          Supabase is managing this secure session.
        </Text>
        <Button label="Log out" onPress={handleSignOut} variant="secondary" />
      </Card>
    </Screen>
  );
}

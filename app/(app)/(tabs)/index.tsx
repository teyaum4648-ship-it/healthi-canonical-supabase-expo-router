import { Text } from 'react-native';

import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { colors } from '../../../src/styles/theme';

export default function DashboardScreen() {
  return (
    <Screen>
      <SectionHeader
        eyebrow="Dashboard"
        title="Today starts here"
        body="Your morning briefing will appear here after onboarding and deterministic scoring are added."
      />
      <Card>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Foundation ready</Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>
          Auth, protected navigation, and the main Healthi tabs are in place.
        </Text>
      </Card>
    </Screen>
  );
}

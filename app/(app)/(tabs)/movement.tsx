import { Text } from 'react-native';

import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { colors } from '../../../src/styles/theme';

export default function MovementScreen() {
  return (
    <Screen>
      <SectionHeader
        eyebrow="Movement"
        title="Movement capacity"
        body="Movement screens, permissions, and training adaptation will be added in a later phase."
      />
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>
          No workouts or progression logic are active yet.
        </Text>
      </Card>
    </Screen>
  );
}

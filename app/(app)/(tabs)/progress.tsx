import { Text } from 'react-native';

import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { colors } from '../../../src/styles/theme';

export default function ProgressScreen() {
  return (
    <Screen>
      <SectionHeader
        eyebrow="Progress"
        title="Signals over time"
        body="Trends and progress summaries will appear once metrics and engine outputs exist."
      />
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>
          Scores and readiness confidence are intentionally not implemented in this layer.
        </Text>
      </Card>
    </Screen>
  );
}

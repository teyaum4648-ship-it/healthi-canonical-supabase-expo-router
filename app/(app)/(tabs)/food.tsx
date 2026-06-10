import { Text } from 'react-native';

import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { colors } from '../../../src/styles/theme';

export default function FoodScreen() {
  return (
    <Screen>
      <SectionHeader
        eyebrow="Food"
        title="Nourishment"
        body="Food response, constraints, and shopping guidance will come after onboarding and scoring."
      />
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>
          This foundation does not recommend foods or evaluate products.
        </Text>
      </Card>
    </Screen>
  );
}

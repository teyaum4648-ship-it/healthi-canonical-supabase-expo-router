import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, type } from '../../styles/mobileTheme';
import { ProductVerdict } from './ProductVerdict';
import { calculateProductQuality } from './productLookup/productQuality';
import { buildProductQualityScorePresentation } from './productLookup/productQualityPresentation';
import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';
import { explainSnapshotScore } from './productLookup/scoreExplanation';

const PROVIDER_LABEL: Record<HealthiProductSnapshot['provider'], string> = {
  open_food_facts: 'Open Food Facts',
  usda_food_data_central: 'USDA FoodData Central',
  manual: 'Entered or built-in',
  photo_estimate: 'Photo estimate',
  demo: 'Demo'
};

/**
 * The full verdict for one food, as the scanner shows it: the grade, the score, what the
 * label is made of and what moved the number. Opened from any score ring, so a number in
 * a list always leads to its reasons.
 */
export function ScoreBreakdown({ product }: { product: HealthiProductSnapshot }) {
  const quality = useMemo(() => calculateProductQuality(product), [product]);
  const explanation = useMemo(() => explainSnapshotScore(product, quality), [product, quality]);
  const certainty = quality.grade_certainty?.state === 'stable' ? null : buildProductQualityScorePresentation(quality).gradeCertaintyLine ?? null;
  return (
    <View style={styles.stack}>
      <ProductVerdict
        brand={product.brand}
        certaintyNote={certainty}
        explanation={explanation}
        grade={quality.letter_grade ?? null}
        name={product.name}
        score={quality.score ?? null}
        sourceNote={`Read from the label · ${PROVIDER_LABEL[product.provider] ?? product.provider}`}
      />
      <Text style={styles.note}>The score rates the food itself, not your meal or your day. General wellness guidance, not a medical assessment.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  note: { ...type.caption, color: colors.textMuted }
});

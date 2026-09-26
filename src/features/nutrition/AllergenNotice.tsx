import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, type } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import {
  allergenMatchText,
  assessAllergens,
  flaggedMatches,
  matchAllergenProfile,
  type AllergenGroup
} from './allergens';
import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';

/**
 * What a product's label declares about the groups a person asked to avoid.
 *
 * The copy is deliberately about the record rather than the food. When nothing is
 * declared it says the record is silent and to check the packet — it never says the food
 * is free of anything, because a missing statement is missing information and treating it
 * as reassurance is the one failure here that could actually hurt someone.
 *
 * Renders nothing when no groups are being watched, so it stays invisible to everyone who
 * has not asked for it.
 */
export function AllergenNotice({ product, avoiding }: {
  product: HealthiProductSnapshot;
  avoiding: AllergenGroup[];
}) {
  if (avoiding.length === 0) return null;

  const assessment = assessAllergens(product);
  const matches = matchAllergenProfile(assessment, avoiding);
  const flagged = flaggedMatches(matches);

  if (flagged.length > 0) {
    const declares = flagged.some((match) => match.status === 'contains');
    return (
      <View style={[styles.panel, declares ? styles.panelDeclared : styles.panelAdvisory]}>
        <View style={styles.head}>
          <Ionicons
            color={declares ? colors.danger : colors.text}
            name={declares ? 'alert-circle' : 'information-circle-outline'}
            size={18}
          />
          <Text style={styles.title}>
            {declares ? 'On your avoid list' : 'Cross-contact advisory'}
          </Text>
        </View>
        {flagged.map((match) => (
          <Text key={match.group} style={styles.line}>
            {allergenMatchText(match, assessment.statement)}
          </Text>
        ))}
        {flagged.map((match) => match.declaration).filter(Boolean).slice(0, 1).map((declaration) => (
          <Text key={declaration!.evidence} style={styles.evidence}>
            From the label: {declaration!.evidence}
          </Text>
        ))}
      </View>
    );
  }

  // Nothing declared against their list. This states the record's silence; it is not a
  // clearance, and the copy must never be shortened into one.
  return (
    <View style={[styles.panel, styles.panelQuiet]}>
      <View style={styles.head}>
        <Ionicons color={colors.textMuted} name="help-circle-outline" size={18} />
        <Text style={styles.title}>Nothing on your avoid list is declared</Text>
      </View>
      <Text style={styles.line}>
        {assessment.statement === 'declared'
          ? 'This record has an allergen statement and none of your groups appear in it. A statement can still be incomplete — check the packet.'
          : 'This record carries no allergen statement at all, which is not the same as being free of them. Check the packet.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 6, padding: 12, borderRadius: 14, borderWidth: 1 },
  panelDeclared: { backgroundColor: colors.surfaceInset, borderColor: colors.danger },
  panelAdvisory: { backgroundColor: colors.surfaceInset, borderColor: tabAccent.food },
  panelQuiet: { backgroundColor: colors.surfaceInset, borderColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...type.body, color: colors.text, fontWeight: '600', flex: 1 },
  line: { ...type.body, color: colors.textMuted },
  evidence: { ...type.label, color: colors.textFaint }
});

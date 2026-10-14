import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import { pillarTint, tabAccent } from '../../styles/pillarColors';
import { HEAD_OPTIONS, headWord, type HeadRating } from './headCheck';

const accent = tabAccent.mood;

/**
 * "How's your head?" as one row of five steps, overloaded on the left and clear on the
 * right. One tap answers it.
 *
 * Five labelled buttons do not fit a phone's width in a row, and a two-row wrap reads as
 * a form. A scale with its two ends named and the chosen word shown beneath it reads as a
 * single question, which is what it is.
 */
export function HeadScale({ title, value, onSelect, hint, compact = false }: {
  title: string;
  value: HeadRating | null;
  onSelect: (rating: HeadRating) => void;
  hint?: string;
  compact?: boolean;
}) {
  const chosen = value ? HEAD_OPTIONS.find((option) => option.rating === value) : null;
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Text style={styles.title}>{title}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.steps}>
        {HEAD_OPTIONS.map((option) => {
          const selected = option.rating === value;
          return (
            <Pressable
              key={option.rating}
              accessibilityRole="radio"
              accessibilityLabel={`${option.word}: ${option.detail}`}
              accessibilityState={{ checked: selected }}
              hitSlop={4}
              onPress={() => onSelect(option.rating)}
              style={({ pressed }) => [
                styles.step,
                { backgroundColor: selected ? accent : pillarTint('mind_life_load', 0.1 + option.rating * 0.04) },
                pressed && styles.pressed
              ]}
            >
              <View style={[styles.pip, selected && styles.pipSelected]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{headWord(1)}</Text>
        <Text style={[styles.end, styles.endRight]}>{headWord(5)}</Text>
      </View>
      {chosen ? (
        <Text accessibilityLiveRegion="polite" style={styles.chosen}>
          {chosen.word}<Text style={styles.chosenDetail}> · {chosen.detail}</Text>
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  compact: { gap: 8 },
  title: { ...type.label, color: colors.text },
  steps: { flexDirection: 'row', gap: 8 },
  step: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: hairlineWidth,
    flex: 1,
    height: 44,
    justifyContent: 'center'
  },
  pip: { backgroundColor: 'rgba(245, 247, 250, 0.35)', borderRadius: 4, height: 8, width: 8 },
  pipSelected: { backgroundColor: colors.textInverse },
  pressed: { opacity: 0.75 },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  end: { ...type.caption, color: colors.textFaint },
  endRight: { textAlign: 'right' },
  chosen: { ...type.label, color: colors.text },
  chosenDetail: { ...type.caption, color: colors.textMuted },
  hint: { ...type.caption, color: colors.textMuted }
});

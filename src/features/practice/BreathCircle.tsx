import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors, type } from '../../styles/mobileTheme';
import { onPillar, pillarTint, tabAccent } from '../../styles/pillarColors';

/**
 * The circle itself, with no opinion about what is driving it.
 *
 * Pulled out because two interactions need the identical visual and nothing else: the
 * cycling pacer, which repeats until you stop it, and the rounds runner, which advances
 * itself through fixed stages. Those are genuinely different state machines, but a person
 * should not be able to tell that from looking at them — so the shape, the three layers
 * and the reduced-motion behaviour live in one place.
 *
 * Takes a 0-to-1 driver. Scale under normal motion, brightness under reduced motion.
 */

export type BreathPalette = {
  accent: string;
  accentSoft: string;
  text: string;
  faint: string;
  primaryText: string;
};

/* The Mood tab's own colour: breathing is that pillar's main action. */
export const DEFAULT_BREATH_PALETTE: BreathPalette = {
  accent: tabAccent.mood,
  accentSoft: pillarTint('mind_life_load', 0.16),
  text: colors.text,
  faint: colors.textFaint,
  primaryText: onPillar
};

export function BreathCircle({
  wave,
  label,
  palette = DEFAULT_BREATH_PALETTE,
  reduced
}: {
  wave: Animated.Value;
  /** What sits in the middle — a clock, a count, or a word. */
  label: string;
  palette?: BreathPalette;
  reduced: boolean;
}) {
  const scale = wave.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : 1.28] });
  const glowOpacity = wave.interpolate({
    inputRange: [0, 1],
    outputRange: reduced ? [0.25, 0.75] : [0.45, 0.45]
  });

  return (
    <View style={styles.frame}>
      <Animated.View style={[styles.glow, { backgroundColor: palette.accentSoft, opacity: glowOpacity, transform: [{ scale }] }]} />
      <Animated.View style={[styles.ring, { borderColor: palette.accent, transform: [{ scale }] }]} />
      <Animated.View style={[styles.core, { backgroundColor: palette.accent, transform: [{ scale }] }]}>
        <Text numberOfLines={1} style={[styles.coreText, { color: palette.primaryText }]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', height: 210, justifyContent: 'center', width: 210 },
  glow: { borderRadius: 105, height: 210, position: 'absolute', width: 210 },
  ring: { borderRadius: 82, borderWidth: 1, height: 164, position: 'absolute', width: 164 },
  core: { alignItems: 'center', borderRadius: 66, height: 132, justifyContent: 'center', paddingHorizontal: 8, width: 132 },
  coreText: { ...type.label, fontVariant: ['tabular-nums'] }
});

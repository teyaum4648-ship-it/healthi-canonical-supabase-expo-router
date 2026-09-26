import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { FluidPressable } from '../../../components/mobile/FluidPressable';
import { useReducedMotion } from '../../../components/mobile/useReducedMotion';
import { cardSurface, colors, motion, surfaces, type, zones, type ZoneTone } from '../../../styles/mobileTheme';
import { MetricRing } from './MetricRing';
import { ZoneChip } from './ZoneChip';

const curve = Easing.bezier(...motion.bezier);

/**
 * Component A: the one number on Home.
 *
 * The ring shows the readiness estimate and its zone; one line under it says what that
 * means for today. Everything deeper — the overnight biomarkers — waits behind a tap on
 * the ring, so the first glance is a single score and a single sentence.
 */
export function ReadinessHub({
  score,
  zone,
  word,
  insight,
  note,
  meta,
  primaryLabel,
  primaryAccessibilityLabel,
  onPrimary,
  onWhy,
  details
}: {
  score: number | null;
  zone: ZoneTone;
  word: string;
  insight: string;
  /** A second, quieter line: the one thing the engine says to watch, when there is one. */
  note?: string;
  meta: string;
  primaryLabel: string;
  primaryAccessibilityLabel?: string;
  onPrimary: () => void;
  onWhy?: () => void;
  /** Revealed when the ring is tapped. */
  details: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [reveal] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: open ? 1 : 0,
      duration: reducedMotion ? 0 : motion.duration,
      easing: curve,
      useNativeDriver: Platform.OS !== 'web'
    }).start();
  }, [open, reducedMotion, reveal]);

  const ringColor = zones[zone].solid;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.eyebrow}>Readiness</Text>
        <ZoneChip tone={zone} label={word} />
      </View>

      <FluidPressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${score === null ? 'No readiness estimate yet' : `Readiness ${score} out of 100, ${word}`}. ${open ? 'Hide' : 'Show'} biomarker breakdown`}
        onPress={() => setOpen((value) => !value)}
        pressedScale={0.97}
        style={styles.ringButton}
      >
        <MetricRing value={score} size={184} stroke={14} color={ringColor}>
          <Text style={[styles.score, score === null && styles.scoreEmpty]}>{score === null ? '—' : score}</Text>
          <Text style={styles.scoreCaption}>{score === null ? 'No estimate' : 'of 100'}</Text>
        </MetricRing>
      </FluidPressable>

      <Text style={styles.insight}>{insight}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Text style={styles.meta}>{meta}</Text>

      <View style={styles.actions}>
        <FluidPressable
          accessibilityRole="button"
          accessibilityLabel={primaryAccessibilityLabel ?? primaryLabel}
          onPress={onPrimary}
          style={[styles.action, styles.primary]}
          hoverStyle={styles.primaryHover}
        >
          <Text numberOfLines={1} style={styles.primaryText}>{primaryLabel}</Text>
        </FluidPressable>
        {onWhy ? (
          <FluidPressable accessibilityRole="button" onPress={onWhy} style={[styles.action, styles.secondary]} hoverStyle={styles.secondaryHover}>
            <Text numberOfLines={1} style={styles.secondaryText}>Why this estimate?</Text>
          </FluidPressable>
        ) : null}
      </View>

      <FluidPressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        pressedScale={1}
        style={styles.disclosure}
        hoverStyle={styles.disclosureHover}
      >
        <Text style={styles.disclosureText}>{open ? 'Hide biomarkers' : 'Biomarkers'}</Text>
        <Animated.View style={{ transform: [{ rotate: reveal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <Ionicons accessible={false} color={colors.textMuted} name="chevron-down" size={16} />
        </Animated.View>
      </FluidPressable>

      {open ? (
        <Animated.View style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }}>
          {details}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardSurface,
    alignItems: 'center',
    borderColor: surfaces.edge,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 18
  },
  headRow: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { ...type.label, color: colors.text, fontSize: 17, lineHeight: 22 },
  ringButton: { alignItems: 'center', borderRadius: 999, marginTop: 2 },
  score: { color: colors.text, fontSize: 56, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -2, lineHeight: 60 },
  scoreEmpty: { color: colors.textMuted, fontSize: 36, lineHeight: 44 },
  scoreCaption: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  insight: { ...type.body, color: colors.text, fontSize: 17, fontWeight: '500', lineHeight: 24, textAlign: 'center' },
  note: { ...type.body, color: colors.textMuted, fontSize: 15, lineHeight: 21, marginTop: -6, textAlign: 'center' },
  meta: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  actions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 2 },
  action: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 8 },
  primary: { backgroundColor: colors.primary },
  primaryHover: { backgroundColor: colors.primaryPressed },
  primaryText: { ...type.label, color: colors.primaryText, fontSize: 15 },
  secondary: { backgroundColor: colors.surfaceInset, flex: 1.2 },
  secondaryHover: { backgroundColor: '#ECECF0' },
  secondaryText: { ...type.label, color: colors.text, fontSize: 15 },
  disclosure: { alignItems: 'center', alignSelf: 'stretch', borderRadius: 14, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 44 },
  disclosureHover: { backgroundColor: 'rgba(0, 0, 0, 0.03)' },
  disclosureText: { ...type.label, color: colors.textMuted }
});

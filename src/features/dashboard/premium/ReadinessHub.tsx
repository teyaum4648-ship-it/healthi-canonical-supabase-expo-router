import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { FluidPressable } from '../../../components/mobile/FluidPressable';
import { useReducedMotion } from '../../../components/mobile/useReducedMotion';
import { colors, motion, type, zones, type ZoneTone } from '../../../styles/mobileTheme';
import { pillarColors } from '../../../styles/pillarColors';
import { ScoreDial, StatRing } from '../../../components/mobile/kit';
import { PILLAR_ORDER, type PillarReading } from './PillarRing';
import { pillarFill } from './pillarRingModel';

const PILLAR_NAMES: Record<PillarReading['domain'], string> = {
  recovery_rhythm: 'Recovery',
  nourishment: 'Nourish',
  movement_capacity: 'Movement',
  mind_life_load: 'Mind'
};

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
  trend,
  primaryLabel,
  primaryAccessibilityLabel,
  onPrimary,
  onWhy,
  onOpenDetail,
  details,
  pillars
}: {
  score: number | null;
  zone: ZoneTone;
  word: string;
  insight: string;
  /** A second, quieter line: the one thing the engine says to watch, when there is one. */
  note?: string;
  meta: string;
  /** Today against the person's own recent days, e.g. "4 above your 14-day baseline". */
  trend?: { text: string; direction: 'up' | 'down' | 'flat' } | null;
  primaryLabel: string;
  primaryAccessibilityLabel?: string;
  onPrimary: () => void;
  onWhy?: () => void;
  /** Opens the full readiness breakdown. */
  onOpenDetail?: () => void;
  /** The overnight biomarkers, revealed on a tap. */
  details: ReactNode;
  /** What each foundation moved the estimate, shown as four rings. */
  pillars?: readonly PillarReading[];
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
  const dial = (
    <ScoreDial
      color={ringColor}
      fraction={score === null ? null : score / 100}
      label="Readiness"
      value={score === null ? '—' : String(score)}
      word={word}
      wordColor={zones[zone].text}
      size={208}
      accessibilityLabel={score === null ? 'No readiness estimate yet' : `Readiness ${score} out of 100, ${word}`}
    />
  );

  return (
    <View style={styles.open}>
      {onOpenDetail ? (
        <FluidPressable accessibilityRole="button" accessibilityHint="Opens the readiness breakdown" onPress={onOpenDetail} pressedScale={0.98} style={styles.ringButton}>
          {dial}
        </FluidPressable>
      ) : dial}

      {trend ? (
        <View style={styles.trendRow}>
          <Ionicons accessible={false} color={trend.direction === 'down' ? zones.warning.text : zones.optimal.text} name={trend.direction === 'up' ? 'caret-up' : trend.direction === 'down' ? 'caret-down' : 'remove'} size={11} />
          <Text style={styles.trendText}>{trend.text}</Text>
        </View>
      ) : null}

      <Text style={styles.insight}>{insight}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}

      {pillars ? (
        <View style={styles.pillarCard}>
          {PILLAR_ORDER.map((domain) => {
            const reading = pillars.find((pillar) => pillar.domain === domain);
            const fill = pillarFill(reading);
            return (
              <StatRing
                key={domain}
                color={pillarColors[domain]}
                fraction={fill}
                label={PILLAR_NAMES[domain]}
                value={fill === null ? '—' : String(Math.round(fill * 100))}
                onPress={onOpenDetail}
              />
            );
          })}
        </View>
      ) : null}

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
      <Text style={styles.meta}>{meta}</Text>

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
        <Animated.View style={[styles.details, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }]}>
          {details}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  open: { alignItems: 'center', gap: 12, paddingTop: 4 },
  ringButton: { alignItems: 'center', borderRadius: 999 },
  trendRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: -14 },
  trendText: { ...type.caption, color: colors.textMuted, fontSize: 13 },
  insight: { ...type.body, color: colors.text, fontSize: 16, fontWeight: '500', lineHeight: 22, paddingHorizontal: 12, textAlign: 'center' },
  note: { ...type.body, color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: -4, paddingHorizontal: 12, textAlign: 'center' },
  pillarCard: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: 20, flexDirection: 'row', marginTop: 4, paddingHorizontal: 8, paddingVertical: 14 },
  actions: { alignSelf: 'stretch', flexDirection: 'row', gap: 8 },
  action: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  primary: { backgroundColor: colors.primary },
  primaryHover: { backgroundColor: colors.primaryPressed },
  primaryText: { ...type.label, color: colors.primaryText, fontSize: 15 },
  secondary: { backgroundColor: colors.surface, flex: 1.2 },
  secondaryHover: { backgroundColor: colors.surfaceInset },
  secondaryText: { ...type.label, color: colors.text, fontSize: 15 },
  meta: { ...type.caption, color: colors.textFaint, fontSize: 12, textAlign: 'center' },
  disclosure: { alignItems: 'center', alignSelf: 'stretch', borderRadius: 14, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 40 },
  disclosureHover: { backgroundColor: 'rgba(235, 240, 255, 0.05)' },
  disclosureText: { ...type.label, color: colors.textMuted, fontSize: 14 },
  details: { alignSelf: 'stretch' }
});

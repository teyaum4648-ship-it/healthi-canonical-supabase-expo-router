import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { RotatingChevron } from '../../../components/thread/RotatingChevron';
import { ThreadButton } from '../../../components/thread/ThreadParts';
import { bone, font, pillar, radius, space, type, zoneWord } from '../../../styles/daywoven1c';
import type { ZoneTone } from '../../../styles/mobileTheme';
import { PILLAR_ORDER, PillarRing, type PillarReading } from './PillarRing';
import { PILLAR_NAMES, points, readinessRingLabel, splitFirstSentence } from './readinessHubModel';

/** The ring's largest size, and the room it leaves at the sides on a narrow phone. */
const RING_MAX = 248;
const RING_SIDE_ROOM = 56;

/**
 * Component A: the one number on Today, drawn in the 1c band.
 *
 * The original readiness ring, brought into 1c: large and centred, split into the four
 * foundations (recovery, nourishment, movement, mind, clockwise from 12), with the score
 * and its zone word in the middle. Under it, what each foundation moved the estimate, then
 * the engine's line about what that means for today, the meta line (day mode, source,
 * confidence), and the two things to do next. "Why this estimate?" either opens the inline
 * panel it is given (account) or calls `onWhy` (the demo's own sheet), never both.
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
  whyPanel,
  pillars
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
  /** Opens an explanation elsewhere (the demo's sheet). */
  onWhy?: () => void;
  /** The explanation, expanded inline under the buttons (account). Wins over `onWhy`. */
  whyPanel?: ReactNode;
  /**
   * Formerly revealed by tapping the ring. In 1c the biomarker breakdown lives under
   * "Explore your analysis" on Today, so this is accepted for compatibility and not drawn.
   */
  details?: ReactNode;
  /** What each foundation moved the estimate. */
  pillars?: readonly PillarReading[];
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const copy = splitFirstSentence(insight);
  const wordColor = zoneWord[zone as keyof typeof zoneWord] ?? bone.muted;
  const readings = pillars ?? [];
  const hasWhy = Boolean(whyPanel) || Boolean(onWhy);
  const { width } = useWindowDimensions();
  /* Full size on most phones; on a narrow one it shrinks rather than crowding the edges. */
  const ringSize = Math.max(184, Math.min(RING_MAX, width - space.gutter * 2 - RING_SIDE_ROOM));
  const ringStroke = Math.round(ringSize * 0.052);

  return (
    <View>
      <View style={styles.hub}>
        <PillarRing
          pillars={readings}
          size={ringSize}
          stroke={ringStroke}
          gap={ringStroke * 0.9}
          accessibilityLabel={readinessRingLabel(score, word, pillars)}
        >
          <Text style={styles.ringLabel}>READINESS</Text>
          <Text style={[styles.score, { fontSize: ringSize * 0.31, lineHeight: ringSize * 0.33 }, score === null && styles.scoreEmpty]}>{score === null ? '—' : score}</Text>
          <View style={styles.status}>
            <View style={[styles.statusDot, { backgroundColor: wordColor }]} />
            <Text numberOfLines={1} style={[styles.word, { color: wordColor, maxWidth: ringSize - ringStroke * 2 - 40 }]}>{word}</Text>
          </View>
        </PillarRing>
      </View>

      <View style={styles.pillarRow}>
        {PILLAR_ORDER.map((domain) => {
          const reading = readings.find((item) => item.domain === domain);
          const known = Boolean(reading && !reading.missing);
          const value = known && reading ? points(reading.contribution) : '—';
          return (
            <View key={domain} accessible accessibilityLabel={`${PILLAR_NAMES[domain]}: ${known ? `${value} points` : 'no signal yet'}`} style={styles.pillar}>
              <View style={styles.pillarName}>
                <View style={[styles.swatch, { backgroundColor: pillar[domain] }]} />
                <Text numberOfLines={1} style={styles.pillarLabel}>{PILLAR_NAMES[domain]}</Text>
              </View>
              <Text style={[styles.pillarValue, !known && styles.pillarMissing]}>{value}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.copy}>
        <Text style={styles.headline}>{copy.headline}</Text>
        {copy.rest ? <Text style={styles.sub}>{copy.rest}</Text> : null}
        {note ? <Text style={styles.sub}>{note}</Text> : null}
        <Text style={styles.meta}>{meta}</Text>
      </View>

      <View style={styles.actions}>
        <ThreadButton
          tone="band"
          label={primaryLabel}
          accessibilityLabel={primaryAccessibilityLabel ?? primaryLabel}
          onPress={onPrimary}
          style={styles.action}
        />
        {hasWhy ? (
          <ThreadButton
            tone="band"
            variant="secondary"
            label="Why this estimate?"
            accessibilityState={whyPanel ? { expanded: whyOpen } : undefined}
            accessibilityHint={whyPanel ? undefined : 'Opens what went into the estimate'}
            onPress={whyPanel ? () => setWhyOpen((open) => !open) : () => onWhy?.()}
            trailing={whyPanel ? <RotatingChevron open={whyOpen} color={bone.text} size={13} /> : null}
            style={styles.action}
          />
        ) : null}
      </View>

      {whyPanel && whyOpen ? <View style={styles.why}>{whyPanel}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hub: { alignItems: 'center', marginTop: 22 },
  ringLabel: { ...type.readinessLabel, color: bone.label, fontSize: 11, letterSpacing: 1.6 },
  score: { color: bone.text, fontFamily: font.display, fontVariant: ['tabular-nums'], letterSpacing: -1, marginTop: 2 },
  scoreEmpty: { color: bone.muted },
  status: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 2 },
  statusDot: { borderRadius: 4, height: 7, width: 7 },
  word: { ...type.readinessWord, fontSize: 14 },
  pillarRow: { borderTopColor: bone.hairline, borderTopWidth: 1, flexDirection: 'row', marginTop: 22 },
  pillar: { alignItems: 'center', flex: 1, minWidth: 0, paddingTop: 12 },
  pillarName: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  swatch: { borderRadius: radius.swatch, height: 8, width: 8 },
  pillarLabel: { ...type.small, color: bone.soft, flexShrink: 1 },
  pillarValue: { ...type.pillarValue, color: bone.text, fontVariant: ['tabular-nums'], marginTop: 7 },
  pillarMissing: { color: bone.label },
  copy: { alignItems: 'center', marginTop: 20 },
  headline: { ...type.readinessHeadline, color: bone.text, textAlign: 'center' },
  sub: { ...type.body, lineHeight: 18.85, color: bone.soft, marginTop: 6, textAlign: 'center' },
  meta: { ...type.small, lineHeight: 16.7, color: bone.faint, marginTop: 10, textAlign: 'center' },
  /* Side by side on most phones; on a narrow one they stack rather than cut a label short. */
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  action: { flexBasis: 160, flexGrow: 1 },
  why: { marginTop: 14 }
});

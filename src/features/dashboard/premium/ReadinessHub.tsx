import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RotatingChevron } from '../../../components/thread/RotatingChevron';
import { ThreadButton } from '../../../components/thread/ThreadParts';
import { bone, pillar, radius, ring, type, zoneWord } from '../../../styles/daywoven1c';
import type { ZoneTone } from '../../../styles/mobileTheme';
import { PILLAR_ORDER, PillarRing, type PillarReading } from './PillarRing';
import { PILLAR_NAMES, points, readinessRingLabel, splitFirstSentence } from './readinessHubModel';

/**
 * Component A: the one number on Today, drawn in the 1c band.
 *
 * The ring shows the readiness estimate split into its four foundations, with the zone word
 * under the score. Beside it, the engine's line about what that means for today, and the
 * meta line (day mode, source, confidence). Under it, what each foundation moved the
 * estimate, then the two things to do next. "Why this estimate?" either opens the inline
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

  return (
    <View>
      <View style={styles.hub}>
        <PillarRing pillars={readings} accessibilityLabel={readinessRingLabel(score, word, pillars)}>
          <Text style={styles.ringLabel}>READINESS</Text>
          <Text style={[styles.score, score === null && styles.scoreEmpty]}>{score === null ? '—' : score}</Text>
          <Text numberOfLines={1} style={[styles.word, { color: wordColor }]}>{word}</Text>
        </PillarRing>
        <View style={styles.copy}>
          <Text style={styles.headline}>{copy.headline}</Text>
          {copy.rest ? <Text style={styles.sub}>{copy.rest}</Text> : null}
          {note ? <Text style={styles.sub}>{note}</Text> : null}
          <Text style={styles.meta}>{meta}</Text>
        </View>
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
  hub: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 18 },
  ringLabel: { ...type.readinessLabel, color: bone.label },
  score: { ...type.readinessScore, color: bone.text, fontVariant: ['tabular-nums'], marginTop: 4 },
  scoreEmpty: { color: bone.muted },
  word: { ...type.readinessWord, marginTop: 4, maxWidth: ring.size - ring.stroke * 2 - 12, textAlign: 'center' },
  copy: { flex: 1, minWidth: 0 },
  headline: { ...type.readinessHeadline, color: bone.text },
  sub: { ...type.body, lineHeight: 18.85, color: bone.soft, marginTop: 6 },
  meta: { ...type.small, lineHeight: 16.7, color: bone.faint, marginTop: 10 },
  pillarRow: { borderTopColor: bone.hairline, borderTopWidth: 1, flexDirection: 'row', marginTop: 18 },
  pillar: { flex: 1, minWidth: 0, paddingTop: 12 },
  pillarName: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  swatch: { borderRadius: radius.swatch, height: 8, width: 8 },
  pillarLabel: { ...type.small, color: bone.soft, flexShrink: 1 },
  pillarValue: { ...type.pillarValue, color: bone.text, fontVariant: ['tabular-nums'], marginTop: 7 },
  pillarMissing: { color: bone.label },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  action: { flex: 1 },
  why: { marginTop: 14 }
});

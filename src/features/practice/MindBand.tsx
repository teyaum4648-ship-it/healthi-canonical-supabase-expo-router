import { StyleSheet, Text, View } from 'react-native';

import { SegmentRing } from '../../components/thread/SegmentRing';
import { Eyebrow, ThreadButton } from '../../components/thread/ThreadParts';
import type { MindScore } from '../../engines/mind/calculateMindScore';
import { accent, bone, pillar, radius, type } from '../../styles/daywoven1c';
import type { MoodRing } from './moodDashboardModel';

/* Each of today's levers keeps one colour on the band: breath, light (amber), habits, release. */
const LEVER_COLOUR: Record<MoodRing['id'], string> = {
  breathing: pillar.mind_life_load,
  light: accent.amber,
  habits: bone.text,
  release: pillar.recovery_rhythm
};

/**
 * The Mind header band (design language P1): eyebrow, the engine's Mind + Life Load
 * summary as the headline, its confidence and coverage, then the screen's one ring (P11):
 * today's four levers as segments, the score in the middle, each lever named underneath.
 * An empty segment is a lever not started yet, never a mark against anyone.
 */
export function MindBand({ score, rings, onPractice }: { score: MindScore; rings: MoodRing[]; onPractice: () => void }) {
  const label = score.score === null
    ? 'No Mind and Life Load estimate yet.'
    : `Mind and Life Load ${score.score} out of 100. ${rings.map((ring) => `${ring.label} ${ring.value}`).join(', ')}.`;
  return (
    <View>
      <View style={styles.eyebrow}><Eyebrow tone="band">Mind</Eyebrow></View>
      <View style={styles.hub}>
        <SegmentRing
          accessibilityLabel={label}
          segments={rings.map((ring) => ({ key: ring.id, color: LEVER_COLOUR[ring.id], fill: ring.fraction > 0 ? ring.fraction : null }))}
        >
          <Text style={styles.ringLabel}>MIND</Text>
          <Text style={[styles.score, score.score === null && styles.scoreEmpty]}>{score.score === null ? '—' : score.score}</Text>
          <Text style={styles.ringWord}>{score.score === null ? 'No estimate' : 'of 100'}</Text>
        </SegmentRing>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>{score.summary}</Text>
          {score.score !== null ? <Text style={styles.meta}>{score.confidence} confidence · {Math.round(score.coverage * 100)}% of the signals we look at</Text> : null}
        </View>
      </View>
      <View style={styles.levers}>
        {rings.map((ring) => (
          <View key={ring.id} accessible accessibilityLabel={`${ring.label}: ${ring.value}`} style={styles.lever}>
            <View style={styles.leverName}>
              <View style={[styles.swatch, { backgroundColor: LEVER_COLOUR[ring.id] }]} />
              <Text numberOfLines={1} style={styles.leverLabel}>{ring.label}</Text>
            </View>
            <Text numberOfLines={1} style={styles.leverValue}>{ring.value}</Text>
          </View>
        ))}
      </View>
      <ThreadButton tone="band" label="Start a practice" onPress={onPractice} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: 22 },
  hub: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 14 },
  ringLabel: { ...type.readinessLabel, color: bone.label },
  score: { ...type.readinessScore, color: bone.text, fontVariant: ['tabular-nums'], marginTop: 4 },
  scoreEmpty: { color: bone.muted },
  ringWord: { ...type.readinessWord, color: bone.muted, marginTop: 4 },
  copy: { flex: 1, minWidth: 0 },
  title: { ...type.readinessHeadline, color: bone.text },
  meta: { ...type.small, color: bone.faint, marginTop: 10 },
  levers: { borderTopColor: bone.hairline, borderTopWidth: 1, flexDirection: 'row', marginTop: 18 },
  lever: { flex: 1, minWidth: 0, paddingTop: 12 },
  leverName: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  swatch: { borderRadius: radius.swatch, height: 8, width: 8 },
  leverLabel: { ...type.small, color: bone.soft, flexShrink: 1 },
  leverValue: { color: bone.text, fontFamily: type.bodyStrong.fontFamily, fontSize: 13, fontVariant: ['tabular-nums'], marginTop: 6 },
  button: { marginTop: 18 }
});

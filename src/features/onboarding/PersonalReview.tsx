import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Eyebrow, SectionTitle, ThreadBand } from '../../components/thread/ThreadParts';
import { accent, bone, font, ink, radius, space, surface, type } from '../../styles/daywoven1c';
import type { PersonalReview as Review, ScoredDomain } from './personalReviewModel';

const ICONS: Record<ScoredDomain, keyof typeof Ionicons.glyphMap> = {
  recovery_rhythm: 'moon-outline',
  nourishment: 'leaf-outline',
  mind_life_load: 'cloud-outline',
  movement_capacity: 'walk-outline'
};

/** Content never stretches into a long line on a wide window; on a phone this is the full width. */
const READABLE_WIDTH = 560;

/** Three short segments for how much attention a foundation wants now. Amber is "look here", never red. */
function AttentionMeter({ level }: { level: 1 | 2 | 3 }) {
  return (
    <View style={styles.meter}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={[styles.meterStep, step <= level && { backgroundColor: level === 1 ? ink.text : accent.amber }]} />
      ))}
    </View>
  );
}

/**
 * The Personal Review (design language 1c): the reward for finishing the questionnaire. The
 * band carries the one thing to take away, the 14-day focus. The canvas explains it from the
 * person's own answers, shows the four foundations in plain words, previews the first two
 * weeks, and ends on one action.
 */
export function PersonalReviewScreen({ review, ctaLabel, onContinue, isSubmitting, note }: {
  review: Review;
  ctaLabel: string;
  onContinue: () => void;
  isSubmitting: boolean;
  /** A line above the action, e.g. that a preview is stored on this device only. */
  note?: string | null;
}) {
  const band = (
    <ThreadBand>
      <View style={styles.readable}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>daywoven<Text style={styles.dot}>.</Text></Text>
          <Eyebrow tone="band">Personal review</Eyebrow>
        </View>
        <Text accessibilityRole="header" style={styles.headline}>Your starting point, understood.</Text>
        <Text style={styles.sub}>A first read of your answers: a place to start, not a verdict or a fixed label.</Text>

        <View accessible accessibilityLabel={`Your 14-day focus: ${review.focus.name}. ${review.focus.summary}`} style={styles.focusCard}>
          <Text style={styles.focusKicker}>YOUR 14-DAY FOCUS</Text>
          <Text style={styles.focusName}>{review.focus.name}</Text>
          <Text style={styles.focusSummary}>{review.focus.summary}</Text>
          <View style={styles.chips}>
            <Text style={styles.chip}>{review.focus.priority} · provisional</Text>
            <Text style={styles.chip}>{review.focus.confidence}</Text>
            {review.focus.secondary ? <Text style={styles.chip}>Also watching {review.focus.secondary}</Text> : null}
          </View>
        </View>
      </View>
    </ThreadBand>
  );

  return (
    <Screen band={band} contentStyle={styles.content}>
      <View style={styles.readable}>
        <View style={styles.section}>
          <SectionTitle>Why this focus</SectionTitle>
          <Text style={styles.caption}>From what you told us.</Text>
          <View style={styles.answers}>
            {review.why.goal ? <AnswerRow label="Your main goal" value={review.why.goal} /> : null}
            {review.why.flagged ? <AnswerRow label="Wanted support with" value={review.why.flagged} /> : null}
            {review.why.rows.map((row) => <AnswerRow key={row.label} label={row.label} value={row.value} />)}
          </View>
          {review.stoodOut.length ? (
            <View style={styles.stoodOut}>
              <Text style={styles.subhead}>What stood out most</Text>
              {review.stoodOut.map((reason, index) => (
                <View key={`${reason.domain}-${reason.label}`} accessible style={styles.reason}>
                  <Text style={styles.reasonIndex}>{index + 1}</Text>
                  <View style={styles.reasonCopy}>
                    <Text style={styles.reasonDomain}>{reason.domain}</Text>
                    <Text style={styles.reasonLabel}>{reason.label}</Text>
                    <Text style={styles.reasonDetail}>{reason.explanation}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.caption}>Nothing stood out strongly. A few logged days will sharpen the picture.</Text>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>Your four foundations</SectionTitle>
          <Text style={styles.caption}>How much attention each one wants right now. More attention is not worse health.</Text>
          <View style={styles.grid}>
            {review.foundations.map((item) => (
              <View
                key={item.id}
                accessible
                accessibilityLabel={`${item.name}: ${item.attention}. ${item.lead}. Attention signal ${item.score} of 100.${item.isFocus ? ' Your focus.' : ''}`}
                style={[styles.foundation, item.isFocus && styles.foundationFocus]}
              >
                <View style={styles.foundationTop}>
                  <Ionicons accessible={false} color={ink.text} name={ICONS[item.id]} size={18} />
                  {item.isFocus ? <Text style={styles.focusTag}>Focus</Text> : null}
                </View>
                <Text style={styles.foundationName}>{item.name}</Text>
                <AttentionMeter level={item.level} />
                <Text style={styles.foundationAttention}>{item.attention}</Text>
                <Text style={styles.foundationLead}>{item.lead}</Text>
                <Text style={styles.foundationScore}>Signal {item.score} of 100</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle>Your first 14 days</SectionTitle>
          <View style={styles.timeline}>
            {review.firstFourteenDays.map((step, index) => (
              <View key={step.when} style={styles.step}>
                <View style={styles.stepRail}>
                  <View style={[styles.stepDot, index === 0 && styles.stepDotNow]} />
                  {index < review.firstFourteenDays.length - 1 ? <View style={styles.stepLine} /> : null}
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepWhen}>{step.when}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {step.lines.map((line) => <Text key={line} style={styles.stepLine2}>{line}</Text>)}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.action}>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <Button disabled={isSubmitting} isLoading={isSubmitting} label={ctaLabel} onPress={onContinue} />
        </View>
      </View>
    </Screen>
  );
}

function AnswerRow({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.answer}>
      <Text style={styles.answerLabel}>{label}</Text>
      <Text style={styles.answerValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  readable: { alignSelf: 'center', maxWidth: READABLE_WIDTH, width: '100%' },
  content: { gap: 0, paddingBottom: 40, paddingTop: 0 },
  brandRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  wordmark: { ...type.wordmark, color: bone.text },
  dot: { color: accent.amber },
  headline: { color: bone.text, fontFamily: font.display, fontSize: 34, letterSpacing: -0.4, lineHeight: 39, marginTop: 18 },
  sub: { ...type.body, color: bone.soft, marginTop: 10 },
  focusCard: { backgroundColor: bone.raised, borderColor: bone.hairline, borderRadius: radius.card, borderWidth: 1, marginTop: 22, padding: 18 },
  focusKicker: { color: accent.amber, fontFamily: font.bodySemibold, fontSize: 11, letterSpacing: 1.2 },
  focusName: { color: bone.text, fontFamily: font.display, fontSize: 30, lineHeight: 35, marginTop: 8 },
  focusSummary: { ...type.body, color: bone.soft, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { borderColor: bone.outline, borderRadius: radius.pill, borderWidth: 1, color: bone.text, fontFamily: font.bodyMedium, fontSize: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  section: { marginTop: space.section },
  caption: { ...type.caption, color: ink.muted, marginTop: 6 },
  answers: { borderBottomColor: ink.hairline, borderBottomWidth: 1, marginTop: 12 },
  answer: { borderTopColor: ink.hairline, borderTopWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 44, paddingVertical: 11 },
  answerLabel: { ...type.body, color: ink.muted, flex: 1 },
  answerValue: { color: ink.text, flex: 1.2, fontFamily: font.bodyMedium, fontSize: 14, lineHeight: 20, textAlign: 'right' },
  stoodOut: { marginTop: 20 },
  subhead: { color: ink.text, fontFamily: font.bodySemibold, fontSize: 14 },
  reason: { flexDirection: 'row', gap: 12, marginTop: 14 },
  reasonIndex: { color: accent.amberDeep, fontFamily: font.display, fontSize: 20, lineHeight: 22, width: 18 },
  reasonCopy: { flex: 1, gap: 2 },
  reasonDomain: { ...type.caption, color: ink.muted },
  reasonLabel: { ...type.bodyStrong, color: ink.text },
  reasonDetail: { ...type.body, color: ink.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  foundation: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, flexBasis: '46%', flexGrow: 1, minWidth: 148, padding: 14 },
  foundationFocus: { borderColor: ink.text },
  foundationTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 22 },
  focusTag: { backgroundColor: ink.text, borderRadius: radius.pill, color: bone.text, fontFamily: font.bodySemibold, fontSize: 10.5, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  foundationName: { color: ink.text, fontFamily: font.bodySemibold, fontSize: 15, marginTop: 10 },
  meter: { flexDirection: 'row', gap: 4, marginTop: 10 },
  meterStep: { backgroundColor: ink.track, borderRadius: 2, flex: 1, height: 5 },
  foundationAttention: { color: ink.text, fontFamily: font.bodyMedium, fontSize: 13, marginTop: 8 },
  foundationLead: { ...type.caption, color: ink.muted, marginTop: 4 },
  foundationScore: { color: ink.muted, fontFamily: font.body, fontSize: 11.5, fontVariant: ['tabular-nums'], marginTop: 10 },
  timeline: { marginTop: 14 },
  step: { flexDirection: 'row', gap: 14 },
  stepRail: { alignItems: 'center', width: 12 },
  stepDot: { backgroundColor: surface.canvas, borderColor: ink.text, borderRadius: 6, borderWidth: 2, height: 12, marginTop: 4, width: 12 },
  stepDotNow: { backgroundColor: accent.amber, borderColor: accent.amber },
  stepLine: { backgroundColor: ink.hairline, flex: 1, marginVertical: 4, width: 2 },
  stepCopy: { flex: 1, gap: 4, paddingBottom: 20 },
  stepWhen: { color: accent.amberDeep, fontFamily: font.bodySemibold, fontSize: 12, letterSpacing: 0.3 },
  stepTitle: { color: ink.text, fontFamily: font.display, fontSize: 19 },
  stepLine2: { ...type.body, color: ink.muted },
  action: { gap: 12, marginTop: 12 },
  note: { ...type.caption, color: ink.muted, textAlign: 'center' }
});

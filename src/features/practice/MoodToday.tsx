import { StyleSheet, Text, View } from 'react-native';

import type { MindScore, MindSuggestion } from '../../engines/mind';
import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import { pillarTint, tabAccent } from '../../styles/pillarColors';
import { MetricRow, MiniProgress, RowGroup, ScoreDial, SectionLabel } from '../../components/mobile/kit';
import type { MoodRing, MoodWeekDay } from './moodDashboardModel';

const accent = tabAccent.mood;

/**
 * The Mood tab's Today view: where the day's load stands, what is weighing on it, the one
 * thing worth doing about it, and what has been done so far.
 *
 * Laid out the way Movement's card is, so the pillars read as one app: the number with its
 * confidence beside it, the heaviest limiters named, then a single action. With too little
 * known there is no number at all, only what would help — absence is not drawn as a score.
 */
export function MoodToday({ score, rings, week, onSuggestion }: {
  score: MindScore;
  rings: MoodRing[];
  week: MoodWeekDay[];
  onSuggestion: (suggestion: MindSuggestion) => void;
}) {
  const busiest = Math.max(5, ...week.map((day) => day.minutes));
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const confidenceWord = `${score.confidence[0]!.toUpperCase()}${score.confidence.slice(1)} confidence`;
  return (
    <>
      <View style={styles.lead}>
        <ScoreDial
          color={accent}
          fraction={score.score === null ? null : score.score / 100}
          label="Mind + Life Load"
          value={score.score === null ? '—' : String(score.score)}
          word={score.score === null ? 'Calibrating' : confidenceWord}
          wordColor={score.score === null ? colors.textMuted : accent}
          accessibilityLabel={score.score === null ? 'Mind and life load: not enough to read yet' : `Mind and life load ${score.score} out of 100, ${confidenceWord}`}
        />
        <Text style={styles.summary}>{score.summary}</Text>
        {score.score !== null ? <Text style={styles.meta}>{Math.round(score.coverage * 100)}% of the signals we look at</Text> : null}
      </View>

      <RowGroup>
        <MetricRow
          last
          title={score.suggestion.title}
          detail={score.suggestion.detail}
          onPress={() => onSuggestion(score.suggestion)}
          accessibilityLabel={`${score.suggestion.title}. ${score.suggestion.detail}`}
        />
      </RowGroup>

      {score.limiters.length ? (
        <View>
          <SectionLabel>Weighing on it</SectionLabel>
          <RowGroup>
            {score.limiters.map((limiter, index) => (
              <MetricRow key={limiter.id} color={colors.textFaint} title={limiter.label} detail={limiter.detail} last={index === score.limiters.length - 1} />
            ))}
          </RowGroup>
        </View>
      ) : null}

      <View>
        <SectionLabel>Today so far</SectionLabel>
        <RowGroup>
          {rings.map((ring, index) => (
            <MetricRow
              key={ring.id}
              color={accent}
              title={ring.label}
              visual={<MiniProgress color={accent} fraction={ring.fraction} />}
              value={ring.value}
              last={index === rings.length - 1}
            />
          ))}
        </RowGroup>
      </View>

      <View>
        <SectionLabel right={`${weekMinutes} min breathing`}>This week</SectionLabel>
        <View style={styles.panel}>
          <View accessible accessibilityLabel={week.map((day) => `${day.letter} ${day.minutes} minutes`).join(', ')} style={styles.bars}>
            {week.map((day) => (
              <View key={day.day} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  {day.minutes > 0 ? <View style={[styles.bar, { height: `${Math.max(12, (day.minutes / busiest) * 100)}%`, backgroundColor: day.isToday ? accent : pillarTint('mind_life_load', 0.55) }]} /> : null}
                </View>
                <Text style={[styles.barLetter, day.isToday && styles.barLetterToday]}>{day.letter}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderRadius: 20, gap: 12, padding: 16 },
  lead: { alignItems: 'center', gap: 4 },
  flex: { flex: 1, minWidth: 0 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  eyebrow: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0 },
  summary: { ...type.body, color: colors.text, fontSize: 16, fontWeight: '500', lineHeight: 22, paddingHorizontal: 12, textAlign: 'center' },
  scoreBlock: { alignItems: 'flex-end' },
  score: { ...type.numberLg, color: accent },
  scoreUnit: { ...type.caption, color: colors.textMuted },
  meta: { ...type.caption, color: colors.textFaint },
  limiters: { gap: 10 },
  limiterRow: { flexDirection: 'row', gap: 10 },
  dot: { backgroundColor: accent, borderRadius: 4, height: 8, marginTop: 7, width: 8 },
  limiterLabel: { ...type.label, color: colors.text },
  limiterDetail: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  action: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 56, paddingTop: 14 },
  actionIcon: { alignItems: 'center', backgroundColor: pillarTint('mind_life_load', 0.16), borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  actionTitle: { ...type.label, color: colors.text },
  actionDetail: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  pressed: { opacity: 0.7 },
  rings: { flexDirection: 'row', justifyContent: 'space-between' },
  ringCell: { alignItems: 'center', flex: 1, gap: 6 },
  ringLabel: { ...type.caption, color: colors.text, textAlign: 'center' },
  ringValue: { ...type.caption, color: colors.textMuted, fontVariant: ['tabular-nums'], textAlign: 'center' },
  weekHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  weekTotal: { ...type.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  bars: { flexDirection: 'row', gap: 8, height: 84 },
  barColumn: { alignItems: 'center', flex: 1, gap: 6 },
  barTrack: { backgroundColor: colors.surfaceInset, borderRadius: 6, flex: 1, justifyContent: 'flex-end', overflow: 'hidden', width: '100%' },
  bar: { borderRadius: 6, width: '100%' },
  barLetter: { ...type.caption, color: colors.textFaint },
  barLetterToday: { color: colors.text }
});

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MindScore, MindSuggestion } from '../../engines/mind';
import { colors, glassSurface, hairlineWidth, type } from '../../styles/mobileTheme';
import { pillarTint, tabAccent } from '../../styles/pillarColors';
import { IntakeRing } from '../nutrition/DietDashboard';
import type { MoodRing, MoodWeekDay } from './moodDashboardModel';

const RING_ICONS = { breathing: 'leaf-outline', light: 'sunny-outline', habits: 'checkmark-done-outline', release: 'body-outline' } as const;
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
  return (
    <>
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>Mind + Life Load</Text>
            <Text style={styles.summary}>{score.summary}</Text>
          </View>
          {score.score !== null ? (
            <View accessible accessibilityLabel={`Mind and life load ${score.score} out of 100`} style={styles.scoreBlock}>
              <Text style={styles.score}>{score.score}</Text>
              <Text style={styles.scoreUnit}>/ 100</Text>
            </View>
          ) : null}
        </View>
        {score.score !== null ? (
          <Text style={styles.meta}>{score.confidence} confidence · {Math.round(score.coverage * 100)}% of the signals we look at</Text>
        ) : null}
        {score.limiters.length ? (
          <View style={styles.limiters}>
            {score.limiters.map((limiter) => (
              <View key={limiter.id} style={styles.limiterRow}>
                <View style={styles.dot} />
                <View style={styles.flex}>
                  <Text style={styles.limiterLabel}>{limiter.label}</Text>
                  <Text style={styles.limiterDetail}>{limiter.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityHint={score.suggestion.techniqueId ? 'Opens the breathing practice' : 'Opens Practice'}
          onPress={() => onSuggestion(score.suggestion)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <View style={styles.actionIcon}><Ionicons accessible={false} color={accent} name="sparkles-outline" size={18} /></View>
          <View style={styles.flex}>
            <Text style={styles.actionTitle}>{score.suggestion.title}</Text>
            <Text style={styles.actionDetail}>{score.suggestion.detail}</Text>
          </View>
          <Ionicons accessible={false} color={colors.textFaint} name="chevron-forward" size={17} />
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Today so far</Text>
        <View style={styles.rings}>
          {rings.map((ring) => (
            <View key={ring.id} accessible accessibilityLabel={`${ring.label}: ${ring.value}`} style={styles.ringCell}>
              <IntakeRing color={accent} fraction={ring.fraction} icon={RING_ICONS[ring.id]} size={58} />
              <Text style={styles.ringLabel}>{ring.label}</Text>
              <Text style={styles.ringValue}>{ring.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.weekHead}>
          <Text style={styles.eyebrow}>This week</Text>
          <Text style={styles.weekTotal}>{weekMinutes} min breathing</Text>
        </View>
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
    </>
  );
}

const styles = StyleSheet.create({
  panel: { ...glassSurface, borderColor: colors.border, borderRadius: 18, borderWidth: hairlineWidth, gap: 12, padding: 18 },
  flex: { flex: 1, minWidth: 0 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  eyebrow: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0 },
  summary: { ...type.heading, color: colors.text, marginTop: 4 },
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

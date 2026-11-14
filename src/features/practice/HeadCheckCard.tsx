import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import { techniqueById } from './breathTechniques';
import { headWord, type HeadCheck, type HeadRating, type HeadShift } from './headCheck';
import { HeadScale } from './HeadScale';

const accent = tabAccent.mood;

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Today's "How's your head?", answerable any time, with what has helped this person
 * before: the techniques whose before-and-after pairs moved them most.
 */
export function HeadCheckCard({ latest, helps, onAnswer }: {
  latest: HeadCheck | null;
  helps: Array<{ techniqueId: string; sessions: number; averageChange: number }>;
  onAnswer: (rating: HeadRating) => void;
}) {
  const best = helps.find((row) => row.averageChange > 0);
  return (
    <View style={styles.panel}>
      <HeadScale
        hint="One tap. It counts toward Mind + Life Load and today’s readiness."
        onSelect={onAnswer}
        title="How’s your head?"
        value={latest?.rating ?? null}
      />
      {latest ? <Text style={styles.meta}>Last answered {timeLabel(latest.at)}. Tap again any time it changes.</Text> : null}
      {best ? (
        <View style={styles.helps}>
          <Text style={styles.eyebrow}>What helps you</Text>
          <Text style={styles.helpsLine}>
            {techniqueById(best.techniqueId).name} moves you up {best.averageChange.toFixed(1)} on average, over {best.sessions} {best.sessions === 1 ? 'session' : 'sessions'}.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The check-in around a breathing session: an optional answer before starting, a prompt
 * once it ends, and the shift in the person's own words.
 */
export function PracticeHeadCheck({ before, awaitingAfter, shift, onBefore, onAfter, onSkip }: {
  before: HeadRating | null;
  awaitingAfter: boolean;
  shift: HeadShift | null;
  onBefore: (rating: HeadRating) => void;
  onAfter: (rating: HeadRating) => void;
  onSkip: () => void;
}) {
  if (awaitingAfter) {
    return (
      <View style={styles.inline}>
        <HeadScale compact onSelect={onAfter} title={before ? `And now? Before, you said ${headWord(before).toLowerCase()}.` : 'How’s your head now?'} value={null} />
        <Pressable accessibilityRole="button" onPress={onSkip} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.inline}>
      {shift ? <Text accessibilityLiveRegion="polite" style={styles.shift}>{shift.line}</Text> : null}
      <HeadScale
        compact
        hint="Optional. Answer again after, and see what it does for you."
        onSelect={onBefore}
        title="Before you start: how’s your head?"
        value={before}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderRadius: 20, gap: 12, padding: 16 },
  inline: { borderTopColor: colors.border, borderTopWidth: hairlineWidth, gap: 10, paddingTop: 14 },
  meta: { ...type.caption, color: colors.textFaint },
  eyebrow: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0 },
  helps: { borderTopColor: colors.border, borderTopWidth: hairlineWidth, gap: 4, paddingTop: 12 },
  helpsLine: { ...type.body, color: colors.text },
  shift: { ...type.label, color: accent },
  skip: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center', paddingHorizontal: 8 },
  skipText: { ...type.caption, color: colors.textMuted },
  pressed: { opacity: 0.7 }
});

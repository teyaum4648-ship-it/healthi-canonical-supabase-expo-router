import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../../src/features/auth/AuthProvider';
import { protocolScope } from '../../../src/features/dailyProtocol';
import { PacedBreath } from '../../../src/features/practice/PacedBreath';
import {
  BREATH_RHYTHMS,
  practiceDayLine,
  summarisePracticeDay,
  type PracticeSession
} from '../../../src/features/practice/practiceModel';
import { localPracticeStore } from '../../../src/features/practice/practiceStore';
import { colors, hairlineWidth, type } from '../../../src/styles/mobileTheme';

/**
 * Mood — the fourth pillar, and the one that does something rather than reporting.
 *
 * The app was already three quarters of Chek's four doctors without saying so: Diet,
 * Movement and Sleep are Dr. Diet, Dr. Movement and Dr. Quiet. The fourth seat was held
 * by a calendar, which is a tool rather than a pillar.
 *
 * This is that seat, and it opens with a lever instead of a readout. A mood slider would
 * be self-report in and self-report out — no mechanism, impossible to be wrong, and
 * telling you nothing you did not know when you moved it. It would also repeat the
 * mistake the food scorer had to be rescued from: crediting the absence of a bad day
 * instead of measuring the presence of a good one.
 *
 * So the first thing here is the one intervention that works in under two minutes, is
 * free, needs no hardware, and can be measured working. The rest of the tab — the load
 * reading, the zone prescriptions that follow from it — arrives when the questionnaire
 * engine behind it does. Until then this screen shows what it can actually do, because
 * a block with nothing to say does not get rendered.
 */

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function MoodScreen() {
  const { user } = useAuth();
  const scope = useMemo(() => protocolScope(user?.id), [user?.id]);
  const date = today();

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [rhythmId, setRhythmId] = useState(BREATH_RHYTHMS[0].id);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void localPracticeStore.read(scope).then((rows) => {
        if (active) setSessions(rows);
      });
      return () => { active = false; };
    }, [scope])
  );

  const day = useMemo(() => summarisePracticeDay(sessions, date), [sessions, date]);
  const rhythm = BREATH_RHYTHMS.find((item) => item.id === rhythmId) ?? BREATH_RHYTHMS[0];

  async function record(seconds: number) {
    const session: PracticeSession = {
      id: `breath-${Date.now()}`,
      date,
      rhythmId: rhythm.id,
      seconds,
      finishedAt: new Date().toISOString()
    };
    /* Optimistic, so the count moves the instant the circle stops. */
    setSessions((current) => [...current, session]);
    setSessions(await localPracticeStore.append(scope, session));
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MOOD</Text>
          <Text style={styles.title}>Something you can do now</Text>
          <Text style={styles.meta}>{practiceDayLine(day)}</Text>
        </View>

        <View style={styles.panel}>
          <PacedBreath onSession={(seconds) => void record(seconds)} rhythm={rhythm} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.eyebrow}>PACE</Text>
          <View style={styles.chips}>
            {BREATH_RHYTHMS.map((item) => {
              const active = item.id === rhythm.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={item.id}
                  onPress={() => setRhythmId(item.id)}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.purpose}>{rhythm.purpose}</Text>
          <Text style={styles.ratio}>
            {Math.round(rhythm.inhaleMs / 1000)} in
            {rhythm.holdMs > 0 ? ` · ${Math.round(rhythm.holdMs / 1000)} hold` : ''}
            {` · ${Math.round(rhythm.exhaleMs / 1000)} out`}
          </Text>
        </View>

        {day.sessions.length > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>TODAY</Text>
            {day.sessions.map((session, index) => {
              const item = BREATH_RHYTHMS.find((entry) => entry.id === session.rhythmId);
              const minutes = Math.floor(session.seconds / 60);
              return (
                <View key={session.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.row}>
                    <Text style={styles.rowName}>{item?.name ?? 'Breathing'}</Text>
                    <Text style={styles.rowValue}>
                      {minutes > 0 ? `${minutes}m ${session.seconds % 60}s` : `${session.seconds}s`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  scroll: { gap: 14, paddingBottom: 40, paddingHorizontal: 18, paddingTop: 8 },

  header: { gap: 4, paddingVertical: 6 },
  eyebrow: { ...type.label, color: colors.textFaint, fontSize: 12, letterSpacing: 1.1 },
  title: { ...type.title, color: colors.text },
  meta: { ...type.body, color: colors.textMuted },

  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: hairlineWidth,
    gap: 12,
    padding: 18
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 999,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { ...type.label, color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  purpose: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  ratio: { ...type.label, color: colors.textFaint, fontVariant: ['tabular-nums'] },

  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rowName: { ...type.body, color: colors.text },
  rowValue: { ...type.body, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  divider: { backgroundColor: colors.border, height: hairlineWidth, marginVertical: 10 },
  pressed: { opacity: 0.7 }
});

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LOAD_AREAS, LOAD_ITEMS, scoreLoadCheck, type LoadAnswers, type LoadBand, type LoadPoints, type ObservedLoadAnswers } from '../../src/engines/loadCheck';
import { READINESS_BASELINE } from '../../src/engines/readiness';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { protocolScope } from '../../src/features/dailyProtocol';
import { latestLoadCheck, localLoadCheckStore } from '../../src/features/loadCheck/loadCheckStore';
import { loadObservedAnswers } from '../../src/features/loadCheck/loadCheckSources';
import { useLocalToday } from '../../src/features/navigation/useLocalToday';
import { colors, glassSurface, hairlineWidth, radii, spacing, type } from '../../src/styles/mobileTheme';
import { hues } from '../../src/styles/tokens';

/**
 * The load check: a short questionnaire about the past month that sets where readiness
 * starts each day, instead of the same 70 for everyone.
 *
 * Questions the logs can answer are answered from the logs and say so. Everything can be
 * skipped; skipping lowers confidence, not the result. Symptoms that deserve a doctor's
 * eye are named as such alongside the score, never folded silently into it.
 */

const BAND_WORD: Record<LoadBand, string> = { light: 'Light', moderate: 'Moderate', heavy: 'Heavy' };
const BAND_COLOR: Record<LoadBand, string> = { light: colors.accent, moderate: colors.textMuted, heavy: hues.amber };

export default function LoadCheckScreen() {
  const { user, mode } = useAuth();
  const today = useLocalToday();
  const scope = useMemo(() => protocolScope(user?.id), [user?.id]);
  const [answers, setAnswers] = useState<LoadAnswers>({});
  const [observed, setObserved] = useState<ObservedLoadAnswers>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hadCheck, setHadCheck] = useState(false);

  useEffect(() => {
    let active = true;
    void localLoadCheckStore.read(scope).then((rows) => {
      const latest = latestLoadCheck(rows);
      if (!active || !latest) return;
      setAnswers(latest.answers);
      setHadCheck(true);
    });
    void loadObservedAnswers({ mode, userId: user?.id, scope, today }).then((found) => {
      if (active) setObserved(found);
    });
    return () => { active = false; };
  }, [mode, scope, today, user?.id]);

  const result = useMemo(() => scoreLoadCheck(answers, observed), [answers, observed]);

  function choose(itemId: string, points: LoadPoints) {
    setSaved(false);
    setAnswers((current) => {
      const next = { ...current };
      // Tapping the chosen answer again clears it: skipping is always allowed.
      if (next[itemId] === points) delete next[itemId];
      else next[itemId] = points;
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await localLoadCheckStore.append(scope, { id: `load-${Date.now()}`, completedAt: new Date().toISOString(), answers, observed });
      setSaved(true);
      setHadCheck(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.topTitle}>Load check</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.introBlock}>
          <Text style={styles.title}>Where your days start</Text>
          <Text style={styles.intro}>
            About thirty quick questions on the past month. Your answers set where readiness starts each day for you, instead of the same {READINESS_BASELINE} for everyone. Skip anything you would rather not answer.
          </Text>
          <Text style={styles.meta}>{result.answered} of {result.total} answered{Object.keys(observed).length ? ` · ${Object.keys(observed).length} from your logs` : ''}</Text>
        </View>

        {LOAD_AREAS.map((area) => (
          <View key={area.id} style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{area.title}</Text>
              <Text style={styles.sectionBlurb}>{area.blurb}</Text>
            </View>
            {LOAD_ITEMS.filter((item) => item.area === area.id).map((item) => {
              const fromLogs = observed[item.id];
              const value = fromLogs?.points ?? answers[item.id] ?? null;
              return (
                <View key={item.id} style={styles.question}>
                  <Text style={styles.prompt}>{item.prompt}</Text>
                  {fromLogs ? (
                    <View style={styles.observed}>
                      <Ionicons color={colors.accent} name="analytics-outline" size={15} />
                      <Text style={styles.observedText}>
                        <Text style={styles.observedAnswer}>{item.options.find((option) => option.points === fromLogs.points)?.label}. </Text>
                        {fromLogs.basis}
                      </Text>
                    </View>
                  ) : (
                    <View accessibilityLabel={item.prompt} accessibilityRole="radiogroup" style={styles.options}>
                      {item.options.map((option) => {
                        const active = value === option.points;
                        return (
                          <Pressable
                            key={option.label}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            onPress={() => choose(item.id, option.points)}
                            style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
                          >
                            <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          disabled={saving || result.answered === 0}
          onPress={() => void save()}
          style={({ pressed }) => [styles.saveButton, (saving || result.answered === 0) && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.saveText}>{saving ? 'Saving…' : hadCheck ? 'Update my starting point' : 'See my starting point'}</Text>
        </Pressable>

        {saved ? (
          <View accessibilityLiveRegion="polite" style={styles.resultCard}>
            {result.baseline !== null ? (
              <>
                <Text style={styles.resultEyebrow}>Your starting point</Text>
                <View style={styles.baselineRow}>
                  <Text style={styles.baseline}>{result.baseline}</Text>
                  <Text style={styles.baselineNote}>instead of {READINESS_BASELINE} · {result.confidence} confidence</Text>
                </View>
                <Text style={styles.resultBody}>
                  Readiness starts here each day, then moves with last night’s sleep, what you eat, how you move and how your head is. You still need to log something each day to see a number.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.resultEyebrow}>Not enough to go on yet</Text>
                <Text style={styles.resultBody}>Answer at least half the questions in three of the areas and your starting point will be set. Until then readiness starts at {READINESS_BASELINE}.</Text>
              </>
            )}
            <View style={styles.areas}>
              {result.areas.map((area) => (
                <View key={area.area} style={styles.areaRow}>
                  <Text style={styles.areaName}>{area.title}</Text>
                  <Text style={[styles.areaBand, area.band ? { color: BAND_COLOR[area.band] } : null]}>
                    {area.band ? `${BAND_WORD[area.band]} load` : 'Not enough answered'}
                  </Text>
                </View>
              ))}
            </View>
            {result.flags.length ? (
              <View style={styles.flags}>
                <Text style={styles.resultEyebrow}>Worth getting checked</Text>
                {result.flags.map((flag) => (
                  <View key={flag.itemId} style={styles.flagRow}>
                    <Ionicons color={hues.amber} name="medkit-outline" size={16} />
                    <Text style={styles.flagText}>{flag.message}</Text>
                  </View>
                ))}
                <Text style={styles.footnote}>This sits alongside your score; it does not change it. Healthi is general wellness guidance and cannot tell you what is causing a symptom.</Text>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  topTitle: { ...type.label, color: colors.text },
  scroll: { gap: spacing.lg, paddingBottom: 96, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  introBlock: { gap: 8 },
  title: { ...type.largeTitle, color: colors.text },
  intro: { ...type.body, color: colors.textMuted },
  meta: { ...type.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  section: { ...glassSurface, borderColor: colors.hairline, borderRadius: radii.lg, borderWidth: hairlineWidth, gap: 18, padding: spacing.lg },
  sectionHead: { gap: 2 },
  sectionTitle: { ...type.heading, color: colors.text },
  sectionBlurb: { ...type.caption, color: colors.textMuted },
  question: { gap: 10 },
  prompt: { ...type.label, color: colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderColor: colors.hairline, borderRadius: radii.full, borderWidth: hairlineWidth, minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  optionActive: { backgroundColor: colors.accentWash, borderColor: colors.accent },
  optionText: { ...type.caption, color: colors.textMuted },
  optionTextActive: { color: colors.accent },
  observed: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  observedText: { ...type.caption, color: colors.textMuted, flex: 1, lineHeight: 19 },
  observedAnswer: { color: colors.text },
  saveButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, justifyContent: 'center', minHeight: 52 },
  saveText: { ...type.label, color: colors.textInverse },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.82 },
  resultCard: { ...glassSurface, borderColor: colors.hairline, borderRadius: radii.lg, borderWidth: hairlineWidth, gap: 12, padding: spacing.lg },
  resultEyebrow: { ...type.eyebrow, color: colors.textFaint },
  baselineRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  baseline: { ...type.numberLg, color: colors.text },
  baselineNote: { ...type.caption, color: colors.textMuted },
  resultBody: { ...type.body, color: colors.textMuted },
  areas: { borderTopColor: colors.hairlineSoft, borderTopWidth: hairlineWidth, gap: 8, paddingTop: 12 },
  areaRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  areaName: { ...type.body, color: colors.text, flex: 1 },
  areaBand: { ...type.label, color: colors.textFaint },
  flags: { borderTopColor: colors.hairlineSoft, borderTopWidth: hairlineWidth, gap: 8, paddingTop: 12 },
  flagRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  flagText: { ...type.body, color: colors.text, flex: 1 },
  footnote: { ...type.caption, color: colors.textFaint },
  doneButton: { alignItems: 'center', borderColor: colors.hairline, borderRadius: radii.md, borderWidth: hairlineWidth, justifyContent: 'center', minHeight: 48 },
  doneText: { ...type.label, color: colors.text }
});

import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { FluidPressable } from '../../components/mobile/FluidPressable';
import type { MorningReport } from '../../engines/circadian/sleepRecoveryAdapter';
import type { SleepRecoverySummary } from '../../engines/circadian/types';
import { isPlausibleMorningHR, PLAUSIBLE_MORNING_HR, type Restedness } from '../../engines/sleepEnergy';
import { cardSurface, type, zones } from '../../styles/mobileTheme';

export type MorningCheckInPalette = {
  border: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  primary: string;
  primaryText: string;
  chip: string;
};

const RESTEDNESS: { value: Restedness; label: string }[] = [
  { value: 1, label: 'Exhausted' },
  { value: 2, label: 'Tired' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Rested' },
  { value: 5, label: 'Very rested' }
];

/* Rounded answers are what people can actually recall; "Not sure" is always an answer. */
const LATENCY: { value: number | null; label: string }[] = [
  { value: null, label: 'Not sure' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hr+' }
];

const AWAKE: { value: number | null; label: string }[] = [
  { value: null, label: 'Not sure' },
  { value: 0, label: 'Slept through' },
  { value: 10, label: '~10 min' },
  { value: 20, label: '~20 min' },
  { value: 45, label: '~45 min' },
  { value: 75, label: '1 hr+' }
];

const AWAKENINGS = [1, 2, 3, 4, 5];

function recoveryWords(score: number): { tone: 'optimal' | 'warning' | 'critical'; label: string } {
  if (score >= 80) return { tone: 'optimal', label: 'Well recovered' };
  if (score >= 55) return { tone: 'warning', label: 'Partly recovered' };
  return { tone: 'critical', label: 'Under-recovered' };
}

function Chip({ label, selected, onPress, palette }: { label: string; selected: boolean; onPress: () => void; palette: MorningCheckInPalette }) {
  return (
    <FluidPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      pressedScale={0.96}
      style={[styles.chip, { backgroundColor: selected ? palette.primary : palette.chip }]}
    >
      <Text style={[styles.chipText, { color: selected ? palette.primaryText : palette.text }]}>{label}</Text>
    </FluidPressable>
  );
}

/**
 * This morning's check-in under last night's window, and what it adds up to.
 *
 * The score leads because it is the answer; the questions follow because they are how
 * to make it sharper. Every question can be skipped, and the confidence line says what
 * skipping costs.
 */
export function MorningCheckIn({ palette, hasNight, report, awakeFromWindow, recovery, savedPulse, onChange, onSavePulse }: {
  palette: MorningCheckInPalette;
  hasNight: boolean;
  report: MorningReport | null;
  /** Awake periods already marked on the window, which take the place of the question. */
  awakeFromWindow: { count: number; minutes: number } | null;
  recovery: SleepRecoverySummary | null;
  savedPulse: number | null;
  onChange: (patch: MorningReport) => void;
  onSavePulse: (bpm: number) => Promise<void>;
}) {
  const [pulseText, setPulseText] = useState('');
  const [pulseError, setPulseError] = useState<string | null>(null);
  const [savingPulse, setSavingPulse] = useState(false);
  const answers = report ?? {};
  const awake = answers.awakeDuringNightMinutes;

  async function savePulse() {
    const bpm = Number(pulseText.trim());
    if (!pulseText.trim() || !isPlausibleMorningHR(bpm)) {
      setPulseError(`Enter a pulse between ${PLAUSIBLE_MORNING_HR.min} and ${PLAUSIBLE_MORNING_HR.max} bpm. Count for 30 seconds and double it.`);
      return;
    }
    setSavingPulse(true);
    setPulseError(null);
    try {
      await onSavePulse(Math.round(bpm));
      setPulseText('');
    } catch {
      setPulseError('That pulse could not be saved. Try again.');
    } finally {
      setSavingPulse(false);
    }
  }

  const words = recovery ? recoveryWords(recovery.score) : null;

  return (
    <View style={styles.pad}>
      <View style={[styles.card, { borderColor: palette.border }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>This morning</Text>

        {recovery && words ? (
          <View style={styles.result} accessible accessibilityLabel={`Sleep score ${recovery.score}, ${words.label}. Prediction confidence ${recovery.confidence} percent.`}>
            <View style={styles.scoreRow}>
              <Text style={[styles.score, { color: palette.text }]}>{recovery.score}</Text>
              <View style={styles.scoreCopy}>
                <Text style={[styles.scoreLabel, { color: palette.muted }]}>Sleep score</Text>
                <View style={[styles.zone, { backgroundColor: zones[words.tone].background }]}>
                  <Text style={[styles.zoneText, { color: zones[words.tone].text }]}>{words.label}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.body, { color: palette.text }]}>
              Today is likely to feel about {Math.round(recovery.multiplier * 100)}% as strong as a fully rested day. The timing of your peaks and dips stays the same.
            </Text>
            {recovery.contributors.slice(0, 3).map((contributor) => (
              <View key={contributor.id} style={styles.contributor}>
                <View style={[styles.dot, { backgroundColor: contributor.impact === 'negative' ? zones.critical.text : contributor.impact === 'neutral' ? zones.warning.text : zones.optimal.text }]} />
                <Text style={[styles.contributorText, { color: palette.muted }]}>{contributor.message}</Text>
              </View>
            ))}
            {recovery.notes.map((note) => <Text key={note} style={[styles.note, { color: palette.faint }]}>{note}</Text>)}
            <Text style={[styles.note, { color: palette.faint }]}>Prediction confidence {recovery.confidence}%. An estimate from what you logged, not a measurement.</Text>
          </View>
        ) : (
          <Text style={[styles.body, { color: palette.muted }]}>
            {hasNight ? 'Answer what you can below for today’s energy prediction.' : 'Log last night’s window above, then answer what you can here for today’s energy prediction.'}
          </Text>
        )}

        <View style={[styles.rule, { backgroundColor: palette.border }]} />

        <Text style={[styles.question, { color: palette.text }]}>How rested do you feel?</Text>
        <View style={styles.chips}>
          {RESTEDNESS.map((option) => (
            <Chip key={option.value} label={option.label} palette={palette} selected={answers.morningRestedness === option.value} onPress={() => onChange({ morningRestedness: answers.morningRestedness === option.value ? null : option.value })} />
          ))}
        </View>

        <Text style={[styles.question, { color: palette.text }]}>How long did it take to fall asleep?</Text>
        <View style={styles.chips}>
          {LATENCY.map((option) => (
            <Chip key={option.label} label={option.label} palette={palette} selected={(answers.sleepLatencyMinutes ?? null) === option.value} onPress={() => onChange({ sleepLatencyMinutes: option.value })} />
          ))}
        </View>

        <Text style={[styles.question, { color: palette.text }]}>Time awake during the night</Text>
        {awakeFromWindow ? (
          <Text style={[styles.body, { color: palette.muted }]}>
            From your window: {awakeFromWindow.count} {awakeFromWindow.count === 1 ? 'time' : 'times'}, {Math.round(awakeFromWindow.minutes)} min in all.
          </Text>
        ) : (
          <>
            <View style={styles.chips}>
              {AWAKE.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  palette={palette}
                  selected={(awake ?? null) === option.value}
                  onPress={() => onChange({ awakeDuringNightMinutes: option.value, awakeningCount: option.value === 0 ? 0 : option.value === null ? null : answers.awakeningCount ?? null })}
                />
              ))}
            </View>
            {typeof awake === 'number' && awake > 0 ? (
              <>
                <Text style={[styles.subQuestion, { color: palette.muted }]}>How many times do you remember waking?</Text>
                <View style={styles.chips}>
                  {AWAKENINGS.map((count) => (
                    <Chip key={count} label={count === 5 ? '5+' : String(count)} palette={palette} selected={answers.awakeningCount === count} onPress={() => onChange({ awakeningCount: answers.awakeningCount === count ? null : count })} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: palette.text }]}>I’m not sure of my sleep times</Text>
          <Switch accessibilityLabel="I’m not sure of my sleep times" value={Boolean(answers.timesUncertain)} onValueChange={(value) => onChange({ timesUncertain: value })} />
        </View>

        <View style={[styles.rule, { backgroundColor: palette.border }]} />

        <Text style={[styles.question, { color: palette.text }]}>Morning pulse <Text style={{ color: palette.faint, fontWeight: '400' }}>(optional)</Text></Text>
        <Text style={[styles.note, { color: palette.muted }]}>
          Before you get up, rest two fingers on the thumb side of your wrist, count the beats for 30 seconds and double it.
        </Text>
        <View style={styles.pulseRow}>
          <TextInput
            accessibilityLabel="Morning pulse in beats per minute"
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={(value) => { setPulseText(value.replace(/[^0-9]/g, '')); setPulseError(null); }}
            placeholder={savedPulse ? String(savedPulse) : '58'}
            placeholderTextColor={palette.faint}
            style={[styles.pulseInput, { backgroundColor: palette.chip, color: palette.text }]}
            value={pulseText}
          />
          <Text style={[styles.body, { color: palette.muted }]}>bpm</Text>
          <FluidPressable accessibilityRole="button" disabled={savingPulse} onPress={() => void savePulse()} style={[styles.pulseSave, { backgroundColor: palette.primary }]}>
            <Text style={[styles.chipText, { color: palette.primaryText }]}>{savingPulse ? 'Saving…' : 'Save'}</Text>
          </FluidPressable>
        </View>
        {savedPulse ? <Text style={[styles.note, { color: palette.faint }]}>Saved for today: {savedPulse} bpm.</Text> : null}
        {pulseError ? <Text accessibilityRole="alert" style={[styles.note, { color: zones.critical.text }]}>{pulseError}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingTop: 16 },
  card: { ...cardSurface, borderRadius: 22, borderWidth: 1, gap: 10, padding: 18 },
  title: { ...type.label, fontSize: 17, lineHeight: 22 },
  result: { gap: 8 },
  scoreRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  score: { fontSize: 44, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -1.5, lineHeight: 48 },
  scoreCopy: { gap: 4 },
  scoreLabel: { ...type.caption, fontWeight: '600' },
  zone: { alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 },
  zoneText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  body: { ...type.body, fontSize: 15, lineHeight: 21 },
  contributor: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  dot: { borderRadius: 3, height: 6, marginTop: 7, width: 6 },
  contributorText: { ...type.body, flex: 1, fontSize: 14, lineHeight: 20 },
  note: { ...type.caption, fontSize: 12.5, lineHeight: 17 },
  rule: { height: 1, marginVertical: 4 },
  question: { ...type.label, fontSize: 15, marginTop: 4 },
  subQuestion: { ...type.caption, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderCurve: 'continuous', borderRadius: 14, justifyContent: 'center', minHeight: 36, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 14, fontWeight: '600' },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 6 },
  switchLabel: { ...type.body, flex: 1, fontSize: 15 },
  pulseRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  pulseInput: { borderRadius: 14, fontSize: 20, fontVariant: ['tabular-nums'], fontWeight: '600', minHeight: 44, paddingHorizontal: 14, width: 90 },
  pulseSave: { alignItems: 'center', borderRadius: 14, justifyContent: 'center', marginLeft: 'auto', minHeight: 40, paddingHorizontal: 16 }
});

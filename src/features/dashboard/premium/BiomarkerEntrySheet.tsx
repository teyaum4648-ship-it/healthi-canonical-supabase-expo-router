import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { EntrySheet } from '../../../components/mobile/EntrySheet';
import { FluidPressable } from '../../../components/mobile/FluidPressable';
import {
  BIOMARKER_KINDS,
  BIOMARKER_SPECS,
  formatBiomarkerValue,
  validateBiomarker,
  type BiomarkerKind,
  type BiomarkerReading
} from '../../../engines/biomarkers';
import { colors, fonts, surfaces, type } from '../../../styles/mobileTheme';

function longDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

/**
 * Typing in a reading from a watch or ring. The value is checked against a plausible
 * range before it is saved, and a correction replaces the earlier typed value for that
 * day rather than sitting beside it.
 */
export function BiomarkerEntrySheet({ initialKind, date, readings, onSave, onClose }: {
  initialKind: BiomarkerKind;
  date: string;
  readings: BiomarkerReading[];
  onSave: (kind: BiomarkerKind, value: number) => Promise<void>;
  onClose: () => void;
}) {
  const existing = (kind: BiomarkerKind) => readings
    .filter((reading) => reading.kind === kind && reading.date === date)
    .sort((left, right) => left.recorded_at.localeCompare(right.recorded_at))
    .at(-1);
  const [kind, setKind] = useState<BiomarkerKind>(initialKind);
  const [text, setText] = useState(() => {
    const current = existing(initialKind);
    return current ? formatBiomarkerValue(initialKind, current.value) : '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spec = BIOMARKER_SPECS[kind];

  function choose(next: BiomarkerKind) {
    setKind(next);
    const current = existing(next);
    setText(current ? formatBiomarkerValue(next, current.value) : '');
    setError(null);
  }

  async function save() {
    const value = Number(text.replace(',', '.'));
    const check = validateBiomarker(kind, value);
    if (!text.trim() || !check.ok) {
      setError(check.ok ? `Enter a number for ${spec.label.toLowerCase()}.` : check.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(kind, value);
      onClose();
    } catch {
      setError('That reading could not be saved. It is still here — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <EntrySheet
      title="Add a reading"
      onClose={onClose}
      busy={busy}
      footer={
        <FluidPressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[styles.save, busy && styles.saveBusy]} hoverStyle={styles.saveHover}>
          {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.saveText}>Save</Text>}
        </FluidPressable>
      }
    >
      <Text style={styles.muted}>For {longDate(date)}. Type the value your watch or ring shows for the night before.</Text>

      <View accessibilityRole="tablist" style={styles.kinds}>
        {BIOMARKER_KINDS.map((option) => (
          <FluidPressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: option === kind }}
            onPress={() => choose(option)}
            pressedScale={1}
            style={[styles.kind, option === kind && styles.kindSelected]}
          >
            <Text numberOfLines={1} style={[styles.kindText, option === kind && styles.kindTextSelected]}>{BIOMARKER_SPECS[option].shortLabel}</Text>
          </FluidPressable>
        ))}
      </View>

      <View style={styles.field}>
        <TextInput
          accessibilityLabel={`${spec.label} in ${spec.unit}`}
          autoFocus
          inputMode="decimal"
          keyboardType="decimal-pad"
          maxLength={5}
          onChangeText={(value) => { setText(value); setError(null); }}
          onSubmitEditing={() => void save()}
          placeholder={spec.decimals ? '14.5' : kind === 'heart_rate_variability' ? '62' : '58'}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          style={styles.input}
          value={text}
        />
        <Text style={styles.unit}>{spec.unit}</Text>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.muted}>Accepted range {spec.min}–{spec.max} {spec.unit}. Readings stay on this device and are compared only with your own.</Text>
    </EntrySheet>
  );
}

const styles = StyleSheet.create({
  muted: { ...type.body, color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  kinds: { backgroundColor: colors.surfaceInset, borderRadius: 14, flexDirection: 'row', gap: 3, padding: 3 },
  kind: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 6 },
  kindSelected: { backgroundColor: colors.surfaceMuted },
  kindText: { ...type.label, color: colors.textMuted, fontSize: 14 },
  kindTextSelected: { color: colors.text },
  field: {
    alignItems: 'baseline',
    backgroundColor: colors.surfaceInset,
    borderColor: surfaces.edge,
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  input: { color: colors.text, flex: 1, fontFamily: fonts.display, fontSize: 34, fontVariant: ['tabular-nums'], fontWeight: '700', minHeight: 48, padding: 0 },
  unit: { ...type.body, color: colors.textMuted },
  error: { ...type.body, color: colors.danger, fontSize: 15 },
  save: { alignItems: 'center', backgroundColor: colors.primary, borderCurve: 'continuous', borderRadius: 14, justifyContent: 'center', minHeight: 50 },
  saveHover: { backgroundColor: colors.primaryPressed },
  saveBusy: { opacity: 0.7 },
  saveText: { ...type.label, color: colors.primaryText, fontSize: 17 }
});

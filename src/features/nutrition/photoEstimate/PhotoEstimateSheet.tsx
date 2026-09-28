import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EntrySheet } from '../../../components/mobile/EntrySheet';
import { colors, type, glassSurface } from '../../../styles/mobileTheme';
import { pillarTint, tabAccent } from '../../../styles/pillarColors';
import {
  correctPortion,
  formatCalorieRange,
  itemConfidence,
  portionLabel,
  removeEstimateItem
} from './photoEstimate';
import type { PhotoEstimate, PhotoEstimateItem } from './photoEstimateTypes';

/**
 * Reviewing an estimate before it becomes a log.
 *
 * The screen's whole job is to stop a guess from reading like a measurement. Calories are
 * shown as the band, with the point estimate as secondary text; every portion is an input
 * rather than a label, because correcting one is the fastest way to make the estimate
 * right and is the action most people will want; and the confirm button says what it is
 * saving. Nothing is written until it is pressed.
 */

/** Shown per item. An em dash means the model did not estimate it, which is not zero. */
const MACRO_FIELDS = [
  ['protein_g', 'Protein', 'g'],
  ['carbs_g', 'Carbs', 'g'],
  ['fat_g', 'Fat', 'g'],
  ['fiber_g', 'Fibre', 'g']
] as const satisfies ReadonlyArray<readonly [keyof PhotoEstimateItem['nutrients'], string, string]>;

const CONFIDENCE_COPY: Record<'low' | 'medium' | 'high', string> = {
  high: 'Fairly sure',
  medium: 'Roughly right',
  low: 'Rough guess'
};

function ConfidenceTag({ item }: { item: PhotoEstimateItem }) {
  const level = itemConfidence(item);
  return (
    <View style={[styles.tag, level === 'low' && styles.tagLow]}>
      <Text style={styles.tagText}>{CONFIDENCE_COPY[level]}</Text>
    </View>
  );
}

function ItemRow({ item, busy, onCorrect, onRemove }: {
  item: PhotoEstimateItem;
  busy: boolean;
  onCorrect: (amount: number) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const unitLabel = item.portion.unit === 'count' ? 'servings' : item.portion.unit === 'ml' ? 'mL' : 'g';
  const value = draft ?? String(item.portion.amount);

  function commit() {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) onCorrect(parsed);
    setDraft(null);
  }

  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <View style={styles.itemName}>
          <Text style={styles.name}>{item.name}</Text>
          {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
        </View>
        <ConfidenceTag item={item} />
      </View>

      <View style={styles.portionRow}>
        <Text style={styles.label}>Portion</Text>
        <TextInput
          accessibilityLabel={`Portion for ${item.name} in ${unitLabel}`}
          editable={!busy}
          keyboardType="decimal-pad"
          onBlur={commit}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          selectTextOnFocus
          style={styles.portionInput}
          value={value}
        />
        <Text style={styles.label}>{unitLabel}</Text>
      </View>

      <Text style={styles.detail}>
        {item.portion.corrected
          ? `Your portion · ${portionLabel(item)}`
          : `Healthi's estimate · ${portionLabel(item)}`}
      </Text>

      <Text style={styles.itemCalories}>
        {item.nutrients.calories === null
          ? 'Calories not estimated'
          : `${Math.round(item.nutrients.calories)} kcal`}
      </Text>

      {/* Macros re-scale with the portion above, so they are shown here rather than only in
          the diary totals — otherwise correcting a portion gives no visible feedback. */}
      <View style={styles.macros}>
        {MACRO_FIELDS.map(([key, label, unit]) => {
          const amount = item.nutrients[key];
          return (
            <View key={key} style={styles.macro}>
              <Text style={styles.macroLabel}>{label}</Text>
              <Text style={styles.macroValue}>
                {amount === null ? '—' : `${Math.round(amount * 10) / 10} ${unit}`}
              </Text>
            </View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onRemove}
        style={styles.remove}
      >
        <Text style={styles.removeText}>Not on my plate — remove</Text>
      </Pressable>
    </View>
  );
}

export function PhotoEstimateSheet({
  estimate,
  photoUri,
  busy,
  error,
  onChange,
  onConfirm,
  onClose,
  onSearchInstead
}: {
  estimate: PhotoEstimate;
  photoUri: string | null;
  busy: boolean;
  error: string;
  onChange: (estimate: PhotoEstimate) => void;
  onConfirm: () => void;
  onClose: () => void;
  onSearchInstead: () => void;
}) {
  const band = formatCalorieRange(estimate.calorie_range);
  const itemCount = estimate.items.length;

  return (
    <EntrySheet
      busy={busy}
      onClose={onClose}
      title="Check this estimate"
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={busy || itemCount === 0}
          onPress={onConfirm}
          style={({ pressed }) => [styles.save, (busy || pressed || itemCount === 0) && styles.pressed]}
        >
          {busy
            ? <ActivityIndicator color={colors.primaryText} />
            : <Text style={styles.saveText}>
                Log {itemCount} {itemCount === 1 ? 'food' : 'foods'} as an estimate
              </Text>}
        </Pressable>
      }
    >
      {photoUri ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="The photo being estimated"
          source={{ uri: photoUri }}
          style={styles.photo}
        />
      ) : null}

      {/* The band leads, because it is the honest figure; the midpoint is secondary. */}
      <View style={styles.total}>
        <Text style={styles.totalRange}>{band ?? 'Calories not estimated'}</Text>
        {estimate.calories !== null ? (
          <Text style={styles.detail}>Around {estimate.calories} kcal · a photo cannot give an exact figure</Text>
        ) : null}
      </View>

      <Text style={styles.detail}>
        Estimated from the photo, so it carries no label data — no ingredients, brands or
        allergens. Correcting a portion is what makes it accurate; tap any number to change it.
      </Text>

      <View style={styles.items}>
        {estimate.items.map((item) => (
          <ItemRow
            key={item.id}
            busy={busy}
            item={item}
            onCorrect={(amount) => onChange(correctPortion(estimate, item.id, amount))}
            onRemove={() => onChange(removeEstimateItem(estimate, item.id))}
          />
        ))}
      </View>

      {itemCount === 0 ? (
        <Text accessibilityRole="alert" style={styles.detail}>
          Nothing left to log. Search for the food instead, or close this and take another photo.
        </Text>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}

      <Pressable accessibilityRole="button" disabled={busy} onPress={onSearchInstead} style={styles.secondary}>
        <Text style={styles.secondaryText}>Search for one of these instead</Text>
      </Pressable>

      <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.cancel}>
        <Text style={styles.detail}>Discard this estimate</Text>
      </Pressable>
    </EntrySheet>
  );
}

const styles = StyleSheet.create({
  label: { ...type.label, color: colors.text },
  detail: { ...type.body, color: colors.textMuted },
  errorText: { ...type.body, color: colors.danger },
  photo: { width: '100%', height: 160, borderRadius: 14, backgroundColor: colors.surfaceInset },
  total: { gap: 4 },
  totalRange: { ...type.title, color: colors.text },
  items: { gap: 12 },
  item: { gap: 8, padding: 14, borderRadius: 14, backgroundColor: colors.surfaceInset },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemName: { flex: 1, gap: 2 },
  name: { ...type.body, color: colors.text, fontWeight: '600' },
  itemCalories: { ...type.body, color: colors.text },
  macros: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  macro: { minWidth: 64, gap: 2 },
  macroLabel: { ...type.label, color: colors.textFaint },
  macroValue: { ...type.body, color: colors.textMuted },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: pillarTint('nourishment', 0.11) },
  tagLow: { ...glassSurface },
  tagText: { ...type.label, color: colors.textMuted },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portionInput: {
    ...type.body,
    minWidth: 84,
    minHeight: 48,
    color: colors.text,
    padding: 12,
    borderRadius: 12,
    ...glassSurface
  },
  remove: { minHeight: 44, justifyContent: 'center' },
  removeText: { ...type.body, color: colors.textMuted },
  save: {
    minHeight: 52,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tabAccent.food
  },
  saveText: { ...type.body, color: colors.primaryText, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...type.body, color: tabAccent.food, fontWeight: '600' },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }
});

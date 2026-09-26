import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EntrySheet } from '../../components/mobile/EntrySheet';
import { colors, type } from '../../styles/mobileTheme';
import { pillarTint, tabAccent } from '../../styles/pillarColors';
import { mealTypes } from './foodTabForms';
import { mealAmountFields, type MealEditDraft } from './mealEditing';

export function MealEditSheet({ draft, onChange, onSave, onClose, busy, error }: {
  draft: MealEditDraft; onChange: (draft: MealEditDraft) => void; onSave: () => Promise<void>; onClose: () => void; busy: boolean; error: string;
}) {
  return <EntrySheet title="Edit meal" onClose={onClose} busy={busy} footer={<Pressable accessibilityRole="button" disabled={busy} onPress={() => void onSave()} style={({ pressed }) => [styles.save, (busy || pressed) && styles.pressed]}>{busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.saveText}>Save changes</Text>}</Pressable>}>
    <Text style={styles.label}>Meal name</Text>
    <TextInput accessibilityLabel="Meal name" editable={!busy} value={draft.name} onChangeText={(name) => onChange({ ...draft, name })} style={styles.input} />
    <View style={styles.types}>{mealTypes.map((meal_type) => <Pressable key={meal_type} accessibilityRole="button" accessibilityState={{ selected: draft.meal_type === meal_type }} disabled={busy} onPress={() => onChange({ ...draft, meal_type })} style={[styles.chip, draft.meal_type === meal_type && styles.selected]}><Text style={styles.label}>{meal_type === 'unknown' ? 'Other' : meal_type.charAt(0).toUpperCase() + meal_type.slice(1)}</Text></Pressable>)}</View>
    <Text style={styles.detail}>Correct the totals for this meal. Original food labels and item portions stay unchanged. Leave an unknown value blank.</Text>
    <View style={styles.fields}>{mealAmountFields.map(([key, label]) => <View key={key} style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} keyboardType="decimal-pad" value={draft.amounts[key]} placeholder="Not reported" placeholderTextColor={colors.textMuted} onChangeText={(value) => onChange({ ...draft, amounts: { ...draft.amounts, [key]: value } })} style={styles.input} /></View>)}</View>
    {error ? <Text accessibilityRole="alert" style={styles.detail}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.cancel}><Text style={styles.detail}>Cancel changes</Text></Pressable>
  </EntrySheet>;
}
const styles = StyleSheet.create({
  label: { ...type.label, color: colors.text }, detail: { ...type.body, color: colors.textMuted },
  input: { ...type.body, minHeight: 48, color: colors.text, padding: 12, borderRadius: 14, backgroundColor: colors.surfaceInset },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, field: { flexGrow: 1, flexBasis: '45%', minWidth: 130, gap: 8 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surfaceInset }, selected: { backgroundColor: pillarTint('nourishment', 0.11), borderWidth: 1, borderColor: tabAccent.food },
  save: { minHeight: 52, padding: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tabAccent.food }, saveText: { ...type.body, color: colors.primaryText, fontWeight: '600' }, pressed: { opacity: 0.6 }, cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }
});

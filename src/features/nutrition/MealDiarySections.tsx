import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MealLog, MealType } from '../../engines/nutrition';
import { ActionRow } from '../../components/mobile/ActionRow';
import { colors, type, cardSurface } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import { mealSectionsForDay } from './mealDiaryModel';

export function MealDiarySections({ meals, date, loading, onAdd, onSelect }: {
  meals: MealLog[]; date: string; loading: boolean; onAdd: (type: MealType) => void; onSelect: (meal: MealLog) => void;
}) {
  return <View style={styles.stack}>
    <Text style={styles.title}>Meals</Text>
    {loading ? <View style={styles.loading}><ActivityIndicator color={tabAccent.food} /><Text style={styles.detail}>Loading your diary…</Text></View> : null}
    {mealSectionsForDay(meals, date).map(section => <View key={section.type} style={styles.section}>
      <View style={styles.header}>
        <View style={styles.copy}><Text style={styles.title}>{section.label}</Text>{!loading && section.meals.length ? <Text style={styles.detail}>{section.calories === null ? 'Calories not reported' : `${Math.round(section.calories)} kcal${section.partial ? ' · partial' : ''}`}</Text> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Add ${section.label.toLowerCase()}`} onPress={() => onAdd(section.type)} style={styles.add}><Ionicons name="add" color={tabAccent.food} size={20} /><Text style={styles.addText}>Add</Text></Pressable>
      </View>
      {!loading && !section.meals.length ? <Text style={styles.detail}>No foods logged yet</Text> : null}
      {section.meals.map((meal, index) => <ActionRow key={meal.id ?? `${meal.logged_at}-${index}`} title={meal.name} detail={`${new Date(meal.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${typeof meal.calories === 'number' ? ` · ${Math.round(meal.calories)} kcal` : ' · Nutrition not reported'}`} onPress={() => onSelect(meal)} last={index === section.meals.length - 1} />)}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  stack: { gap: 12 }, section: { ...cardSurface, borderRadius: 16, padding: 16, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  title: { ...type.body, fontWeight: '600', color: colors.text }, detail: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1, gap: 3 }, loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  add: { minHeight: 44, minWidth: 70, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.surfaceInset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, addText: { ...type.label, color: tabAccent.food }
});

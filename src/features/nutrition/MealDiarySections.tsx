import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MealLog, MealType } from '../../engines/nutrition';
import { MetricRow, RowGroup, SectionLabel } from '../../components/mobile/kit';
import { colors, type } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import { mealSectionsForDay } from './mealDiaryModel';

export function MealDiarySections({ meals, date, loading, onAdd, onSelect }: {
  meals: MealLog[]; date: string; loading: boolean; onAdd: (type: MealType) => void; onSelect: (meal: MealLog) => void;
}) {
  const sections = mealSectionsForDay(meals, date);
  return <View>
    <SectionLabel>Meals</SectionLabel>
    {loading ? <View style={styles.loading}><ActivityIndicator color={tabAccent.food} /><Text style={styles.detail}>Loading your diary…</Text></View> : null}
    <RowGroup>
      {sections.map((section, sectionIndex) => <View key={section.type} style={sectionIndex < sections.length - 1 ? styles.divider : null}>
        <View style={styles.header}>
          <View style={styles.copy}>
            <Text style={styles.title}>{section.label}</Text>
            <Text style={styles.detail}>{loading ? ' ' : section.meals.length ? (section.calories === null ? 'Calories not reported' : `${Math.round(section.calories)} kcal${section.partial ? ' · partial' : ''}`) : 'No foods logged yet'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Add ${section.label.toLowerCase()}`} onPress={() => onAdd(section.type)} style={({ pressed }) => [styles.add, pressed && styles.pressed]}><Ionicons name="add" color={tabAccent.food} size={18} /><Text style={styles.addText}>Add</Text></Pressable>
        </View>
        {section.meals.map((meal, index) => <MetricRow
          key={meal.id ?? `${meal.logged_at}-${index}`}
          title={meal.name}
          detail={new Date(meal.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          value={typeof meal.calories === 'number' ? String(Math.round(meal.calories)) : '—'}
          unit={typeof meal.calories === 'number' ? 'kcal' : undefined}
          onPress={() => onSelect(meal)}
          last={index === section.meals.length - 1}
        />)}
      </View>)}
    </RowGroup>
  </View>;
}
const styles = StyleSheet.create({
  divider: { borderBottomColor: colors.hairline, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { ...type.body, fontSize: 15, fontWeight: '600', color: colors.text }, detail: { ...type.caption, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 }, copy: { flex: 1, gap: 2 }, loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  add: { minHeight: 36, minWidth: 64, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.surfaceInset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, addText: { ...type.label, color: tabAccent.food },
  pressed: { opacity: 0.65 }
});

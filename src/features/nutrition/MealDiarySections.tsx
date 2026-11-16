import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionTitle } from '../../components/thread/ThreadParts';
import type { MealLog, MealType } from '../../engines/nutrition';
import { font, HIT, ink, space, type } from '../../styles/daywoven1c';
import { mealSectionsForDay } from './mealDiaryModel';

/**
 * The day's meals as a 1c hairline diary (design language P4), grouped by meal: each group
 * has its name, its calories and an "Add" link; each meal is a row with its time, its name
 * and its calories right-aligned in tabular figures. No card around each row. Tapping a
 * meal opens it, as before.
 */
export function MealDiarySections({ meals, date, loading, onAdd, onSelect }: {
  meals: MealLog[]; date: string; loading: boolean; onAdd: (type: MealType) => void; onSelect: (meal: MealLog) => void;
}) {
  return <View>
    <SectionTitle>Meals</SectionTitle>
    {loading ? <View style={styles.loading}><ActivityIndicator color={ink.text} /><Text style={styles.detail}>Loading your diary…</Text></View> : null}
    {mealSectionsForDay(meals, date).map(section => <View key={section.type} style={styles.group}>
      <View style={styles.groupHead}>
        <Text accessibilityRole="header" style={styles.groupTitle}>{section.label}</Text>
        {!loading && section.meals.length ? <Text style={styles.groupMeta}>{section.calories === null ? 'Calories not reported' : `${Math.round(section.calories)} kcal${section.partial ? ' · partial' : ''}`}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Add ${section.label.toLowerCase()}`} onPress={() => onAdd(section.type)} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
          <Ionicons accessible={false} name="add" color={ink.text} size={17} />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      {!loading && !section.meals.length ? <Text style={[styles.detail, styles.empty]}>No foods logged yet</Text> : null}
      {section.meals.map((meal, index) => {
        const time = new Date(meal.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const value = typeof meal.calories === 'number' ? `${Math.round(meal.calories)} kcal` : 'Not reported';
        return (
          <Pressable
            key={meal.id ?? `${meal.logged_at}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`${meal.name}, ${time}, ${value}. Open`}
            onPress={() => onSelect(meal)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rowTime}>{time}</Text>
            <View style={styles.rowCopy}>
              <Text numberOfLines={2} style={styles.rowTitle}>{meal.name}</Text>
              {typeof meal.protein_g === 'number' && meal.protein_g > 0 ? <Text style={styles.detail}>{Math.round(meal.protein_g)} g protein</Text> : null}
            </View>
            <Text style={[styles.rowValue, typeof meal.calories !== 'number' && styles.rowValueMuted]}>{value}</Text>
            <Ionicons accessible={false} color={ink.muted} name="chevron-forward" size={15} />
          </Pressable>
        );
      })}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 10 },
  group: { borderTopColor: ink.hairline, borderTopWidth: 1, marginTop: space.md },
  groupHead: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: HIT },
  groupTitle: { color: ink.text, flex: 1, fontFamily: font.bodySemibold, fontSize: 14 },
  groupMeta: { color: ink.muted, fontFamily: font.body, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  add: { alignItems: 'center', flexDirection: 'row', gap: 3, justifyContent: 'flex-end', minHeight: HIT, minWidth: 60 },
  addText: { color: ink.text, fontFamily: font.bodyMedium, fontSize: 13.5, textDecorationLine: 'underline' },
  empty: { paddingBottom: 10 },
  row: { alignItems: 'center', borderTopColor: ink.hairline, borderTopWidth: 1, flexDirection: 'row', gap: 12, minHeight: HIT + 8, paddingVertical: 10 },
  rowTime: { color: ink.muted, fontFamily: font.body, fontSize: 12.5, fontVariant: ['tabular-nums'], width: 62 },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...type.bodyStrong, color: ink.text },
  rowValue: { color: ink.text, fontFamily: font.body, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  rowValueMuted: { color: ink.muted },
  detail: { ...type.caption, color: ink.muted },
  pressed: { opacity: 0.65 }
});

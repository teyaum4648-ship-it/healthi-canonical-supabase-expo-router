import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../../styles/mobileTheme';
import { localStepsStore, type StepsDay } from './healthSync';

/** Today's steps from a connected health app. Renders nothing until there are some. */
export function StepsToday({ scope, today }: { scope: string; today: string }) {
  const [day, setDay] = useState<StepsDay | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    localStepsStore.read(scope).then((rows) => { if (active) setDay(rows.find((row) => row.date === today) ?? null); }).catch(() => { if (active) setDay(null); });
    return () => { active = false; };
  }, [scope, today]));
  if (!day) return null;
  return <View style={styles.row} accessible accessibilityLabel={`${day.steps.toLocaleString()} steps today, from ${day.source === 'healthkit' ? 'Apple Health' : 'Health Connect'}`}>
    <Text style={styles.label}>Steps today</Text>
    <Text style={styles.value}>{day.steps.toLocaleString()}</Text>
    <Text style={styles.source}>{day.source === 'healthkit' ? 'Apple Health' : 'Health Connect'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  label: { ...type.label, color: colors.textMuted },
  value: { ...type.body, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  source: { ...type.caption, color: colors.textMuted, marginLeft: 'auto' }
});

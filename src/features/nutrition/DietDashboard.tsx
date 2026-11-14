import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { NutrientSummary, NutritionTargets } from '../../engines/nutrition';
import { colors, type, glassSurface } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import { shiftDay } from '../navigation/navigationModel';
import { dietWeek, intakeProgress } from './dietDashboardModel';
import { MetricRow, MiniProgress, RowGroup, ScoreDial, SectionLabel } from '../../components/mobile/kit';

export const dietAccents = { energy: '#AA8AF8', protein: '#EE829E', carbs: '#E9B06A', fat: '#77AEFA', water: '#63CBEF' };
const rounded = (value: number | null) => value === null ? '—' : Math.round(value).toLocaleString();

export function IntakeRing({ fraction, color, size = 64, icon }: {
  fraction: number | null; color: string; size?: number; icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const stroke = size > 80 ? 8 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.track} strokeWidth={stroke} />
      {fraction !== null && fraction > 0 ? <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - fraction)} rotation={-90} origin={`${size / 2}, ${size / 2}`} /> : null}
    </Svg>
    <Ionicons name={icon} color={color} size={size > 80 ? 28 : 20} />
  </View>;
}

export function DietWeekSelector({ date, today, onChange, disabled = false }: {
  date: string; today: string; onChange: (date: string) => void; disabled?: boolean;
}) {
  const days = dietWeek(date);
  const { fontScale } = useWindowDimensions();
  return <View style={styles.week}>
    <View style={styles.weekHeader}>
      <Text style={styles.month}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
      {date !== today ? <Pressable disabled={disabled} onPress={() => onChange(today)} style={styles.weekButton}><Text style={styles.today}>Today</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Previous week" disabled={disabled} onPress={() => onChange(shiftDay(date, -7))} style={styles.weekButton}><Ionicons name="chevron-back" size={19} color={colors.textMuted} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Next week" disabled={disabled || days[6] >= today} onPress={() => onChange(shiftDay(date, 7) > today ? today : shiftDay(date, 7))} style={[styles.weekButton, (disabled || days[6] >= today) && styles.dim]}><Ionicons name="chevron-forward" size={19} color={colors.textMuted} /></Pressable>
    </View>
    <View style={[styles.days, fontScale > 1.4 && { flexWrap: 'wrap' }]}>
      {days.map(day => <Pressable key={day} accessibilityRole="button" accessibilityLabel={new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} accessibilityState={{ selected: day === date, disabled: disabled || day > today }} disabled={disabled || day > today} onPress={() => onChange(day)} style={[styles.day, day === date && styles.selectedDay, day > today && styles.dim, fontScale > 1.4 && { minWidth: 64 }]}>
        <Text style={[styles.weekday, day === date && styles.selectedText]}>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</Text>
        <Text style={[styles.date, day === date && styles.selectedText]}>{Number(day.slice(-2))}</Text>
        <View style={[styles.todayDot, { opacity: day === today ? 1 : 0 }]} />
      </Pressable>)}
    </View>
  </View>;
}

export function DietIntakeSummary({ summary, targets, onNutrients }: {
  summary: NutrientSummary; targets: NutritionTargets; onNutrients: () => void;
}) {
  const energy = intakeProgress(summary.calories, targets.calories_target);
  const partial = summary.reason_codes.includes('partial_nutrition_data');
  const macros = [
    /*
     * Ionicons names are not descriptions. "fitness-outline" is a heart with a pulse
     * line through it, which put a cardiac symbol under Protein; each icon now says
     * what the macronutrient does — build, burn, store.
     */
    { label: 'Protein', amount: summary.protein_g, target: targets.protein_g_target, color: dietAccents.protein, icon: 'barbell-outline' },
    { label: 'Carbs', amount: summary.carbs_g, target: targets.carbs_g_target, color: dietAccents.carbs, icon: 'flash-outline' },
    { label: 'Fat', amount: summary.fat_g, target: targets.fat_g_target, color: dietAccents.fat, icon: 'water-outline' }
  ] as const;
  const energyDetail = energy.amount === null ? 'Log a food to begin' : energy.target === null ? 'No working calorie target set' : partial ? 'Includes partial nutrition entries' : energy.remaining! >= 0 ? `${rounded(energy.remaining)} kcal to working target` : `${rounded(-energy.remaining!)} kcal above working target`;
  return <View style={styles.summary}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Calories ${rounded(energy.amount)}${energy.target !== null ? ` of ${rounded(energy.target)}` : ''}. View nutrient details`} onPress={onNutrients} style={styles.dialWrap}>
      <ScoreDial
        color={dietAccents.energy}
        fraction={energy.amount === null ? null : energy.fraction}
        label="Calories"
        value={rounded(energy.amount)}
        word={energy.amount === null ? 'Not logged' : energy.target !== null ? `of ${rounded(energy.target)} kcal` : 'kcal'}
        wordColor={colors.textMuted}
        size={196}
      />
      <Text style={styles.detail}>{energyDetail}</Text>
    </Pressable>
    <View>
      <SectionLabel>Macros</SectionLabel>
      <RowGroup>
        {macros.map((macro, index) => {
          const progress = intakeProgress(macro.amount, macro.target);
          return <MetricRow
            key={macro.label}
            accessibilityLabel={`${macro.label}: ${progress.amount === null ? 'not reported' : `${rounded(progress.amount)} grams`}${progress.target !== null ? `, target ${rounded(progress.target)} grams` : ''}. View nutrients.`}
            color={macro.color}
            title={macro.label}
            visual={<MiniProgress color={macro.color} fraction={progress.fraction} />}
            value={progress.amount === null ? '—' : rounded(progress.amount)}
            unit={progress.target !== null ? `/ ${rounded(progress.target)} g` : 'g'}
            onPress={onNutrients}
            last={index === macros.length - 1}
          />;
        })}
      </RowGroup>
    </View>
    <Text style={styles.footnote}>{partial ? 'Some label values are missing. Totals show reported amounts only.' : 'Working targets guide your day. Bars show intake, not a health score.'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  week: { gap: 4 }, weekHeader: { flexDirection: 'row', alignItems: 'center' }, month: { ...type.label, color: colors.textMuted, flex: 1 }, weekButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, today: { ...type.label, color: tabAccent.food },
  days: { flexDirection: 'row', gap: 3 }, day: { flex: 1, minHeight: 74, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' }, selectedDay: { backgroundColor: colors.surface, borderColor: 'transparent' }, weekday: { ...type.caption, color: colors.textMuted }, date: { ...type.number, color: colors.text }, selectedText: { color: colors.text }, todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: dietAccents.energy }, dim: { opacity: 0.3 },
  summary: { gap: 16 }, dialWrap: { alignItems: 'center', gap: 4 }, energy: { ...glassSurface, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong }, energyCopy: { flex: 1, minWidth: 140, gap: 9 }, energyRing: { alignItems: 'center', gap: 8 }, caption: { ...type.label, color: colors.textMuted }, valueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 4 }, energyNumber: { ...type.numberLg, fontSize: 40, lineHeight: 48, letterSpacing: -1.4, color: colors.text }, target: { ...type.label, color: colors.textMuted }, detail: { ...type.caption, color: colors.textMuted, textAlign: 'center' }, percent: { ...type.caption, fontWeight: '500' },
  macros: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, macro: { flex: 1, flexBasis: '28%', minWidth: 88, ...glassSurface, borderRadius: 20, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, gap: 3 }, macroLabel: { ...type.label, color: colors.textMuted, marginBottom: 5 }, macroNumber: { ...type.numberLg, fontSize: 26, lineHeight: 32, color: colors.text }, macroUnit: { ...type.label, color: colors.textMuted }, macroTarget: { ...type.caption, color: colors.textMuted }, macroRing: { alignItems: 'center', paddingTop: 12, paddingBottom: 2 }, footnote: { ...type.caption, color: colors.textMuted, paddingHorizontal: 4 }
});

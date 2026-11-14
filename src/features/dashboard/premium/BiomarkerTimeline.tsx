import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { FluidPressable } from '../../../components/mobile/FluidPressable';
import { BIOMARKER_SPECS, compareToUsual, formatBiomarkerValue, type BiomarkerSummary } from '../../../engines/biomarkers';
import { cardSurface, colors, fonts, surfaces, type, zones } from '../../../styles/mobileTheme';
import { ZoneChip } from './ZoneChip';

const CHART_HEIGHT = 72;
const CHART_WIDTH = 300;
const DOT = 4;

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const yesterday = new Date(new Date(`${today}T12:00:00.000Z`).getTime() - 86400000).toISOString().slice(0, 10);
  if (date === yesterday) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function initial(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(new Date(`${date}T12:00:00`));
}

/**
 * A flat line of the week's values: no gridlines, no axis, no fill. Days without a
 * reading break the line instead of dragging it to zero.
 */
function TrendLine({ summary, color }: { summary: BiomarkerSummary; color: string }) {
  const values = summary.series.map((day) => day.value).filter((value): value is number => value !== null);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 4);
  const low = min - (span - (max - min)) / 2;
  const step = (CHART_WIDTH - DOT * 2) / (summary.series.length - 1);
  const points = summary.series.map((day, index) => day.value === null ? null : {
    x: DOT + index * step,
    y: DOT + (1 - (day.value - low) / span) * (CHART_HEIGHT - DOT * 2)
  });
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point) current.push(point);
    else if (current.length) { segments.push(current); current = []; }
  }
  if (current.length) segments.push(current);

  return (
    <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
      {segments.filter((segment) => segment.length > 1).map((segment, index) => (
        <Polyline key={index} points={segment.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {points.map((point, index) => point ? (
        <Circle key={index} cx={point.x} cy={point.y} r={index === points.length - 1 ? DOT + 1 : DOT} fill={index === points.length - 1 ? color : colors.surface} stroke={color} strokeWidth={2} />
      ) : null)}
    </Svg>
  );
}

/**
 * Component C: resting heart rate over the last seven days, as a quiet line and a
 * day-by-day log, newest first. Every day has a row, logged or not, and every row opens
 * the entry sheet for that day, so the log is also where readings are added or fixed.
 */
export function BiomarkerTimeline({ summary, today, color, onEditDay }: {
  summary: BiomarkerSummary;
  today: string;
  color: string;
  onEditDay: (date: string) => void;
}) {
  const spec = BIOMARKER_SPECS[summary.kind];
  const baseline = summary.baseline;
  const days = [...summary.series].reverse();
  /* Today's row is the one that matters most mornings; the rest of the week opens on a tap. */
  const [allDays, setAllDays] = useState(false);
  const shownDays = allDays ? days : days.slice(0, 1);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>{spec.label}</Text>
          <Text style={styles.subtitle}>Last 7 days{baseline !== null ? ` · usual ${formatBiomarkerValue(summary.kind, baseline)} ${spec.unit}` : ''}</Text>
        </View>
        <ZoneChip tone={summary.zone} label={summary.latest ? summary.status : 'No reading yet'} />
      </View>

      {summary.days_with_data ? (
        <View accessible accessibilityRole="image" accessibilityLabel={`${spec.label} over the last seven days: ${summary.series.map((day) => day.value === null ? 'no reading' : `${formatBiomarkerValue(summary.kind, day.value)}`).join(', ')}`}>
          <TrendLine summary={summary} color={color} />
          <View style={styles.initials}>
            {summary.series.map((day) => <Text key={day.date} style={[styles.initial, day.date === today && styles.initialToday]}>{initial(day.date)}</Text>)}
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>
          No readings yet. Add the resting heart rate your watch or ring shows for last night, or connect a health app from your profile.
        </Text>
      )}

      <View style={styles.log}>
        {shownDays.map((day, index) => {
          const comparison = day.value !== null && baseline !== null ? compareToUsual(summary.kind, day.value, baseline) : null;
          const delta = comparison?.delta ?? null;
          const tone = comparison?.zone ?? null;
          const deltaText = delta === null ? '' : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)}${spec.deltaMode === 'percent' ? '%' : ''}`;
          return (
            <FluidPressable
              key={day.date}
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(day.date, today)}: ${day.value === null ? 'no reading' : `${formatBiomarkerValue(summary.kind, day.value)} ${spec.unit}`}. ${day.value === null ? 'Add' : 'Edit'} reading`}
              onPress={() => onEditDay(day.date)}
              pressedScale={0.99}
              style={[styles.row, styles.rowDivider]}
              hoverStyle={styles.rowHover}
            >
              <Text style={[styles.rowDay, day.date === today && styles.rowDayToday]}>{dayLabel(day.date, today)}</Text>
              {day.value === null ? (
                <View style={styles.rowAdd}>
                  <Ionicons accessible={false} color={colors.accent} name="add-circle-outline" size={16} />
                  <Text style={styles.rowAddText}>Add</Text>
                </View>
              ) : (
                <View style={styles.rowValueWrap}>
                  {delta !== null && tone ? (
                    <Text style={[styles.rowDelta, { color: zones[tone].text }]}>{deltaText}</Text>
                  ) : null}
                  <Text style={styles.rowValue}>{formatBiomarkerValue(summary.kind, day.value)}</Text>
                  <Text style={styles.rowUnit}>{spec.unit}</Text>
                </View>
              )}
            </FluidPressable>
          );
        })}
        {days.length > 1 ? (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: allDays }} onPress={() => setAllDays((open) => !open)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Text style={styles.toggleText}>{allDays ? 'Show today only' : 'Earlier days'}</Text>
            <Ionicons accessible={false} color={colors.textFaint} name={allDays ? 'chevron-up' : 'chevron-down'} size={17} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardSurface,
    borderRadius: 20,
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6
  },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  headerCopy: { flex: 1, gap: 2 },
  title: { ...type.label, color: colors.text, fontSize: 17, lineHeight: 22 },
  subtitle: { ...type.caption, color: colors.textMuted },
  initials: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 0 },
  initial: { ...type.caption, color: colors.textMuted, fontSize: 11, textAlign: 'center', width: 14 },
  initialToday: { color: colors.text, fontWeight: '700' },
  empty: { ...type.body, color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  log: { marginHorizontal: -8 },
  row: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 8 },
  rowDivider: { borderBottomColor: surfaces.edge, borderBottomWidth: 1 },
  rowHover: { backgroundColor: 'rgba(235, 240, 255, 0.05)' },
  rowDay: { ...type.body, color: colors.text, fontSize: 15 },
  rowDayToday: { fontWeight: '600' },
  rowValueWrap: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  rowDelta: { ...type.caption, fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600' },
  rowValue: { color: colors.text, fontFamily: fonts.display, fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '600' },
  rowUnit: { ...type.caption, color: colors.textMuted, fontSize: 12, width: 28 },
  rowAdd: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  rowAddText: { ...type.label, color: colors.accent },
  rowPressed: { opacity: 0.65 },
  toggleText: { ...type.body, color: colors.textMuted, fontSize: 15 }
});

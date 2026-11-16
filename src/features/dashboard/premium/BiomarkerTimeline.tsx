import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { BIOMARKER_SPECS, formatBiomarkerValue, type BiomarkerSummary } from '../../../engines/biomarkers';
import { accent, font, HIT, ink, radius, surface, type } from '../../../styles/daywoven1c';

const CHART_HEIGHT = 60;
const PAD_Y = 8;

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
 * Component C: resting heart rate over the last seven days, in the 1c chart grammar (P8):
 * an ink line, a dashed line at the person's usual, the latest reading in deep lavender, no
 * gridlines. A day without a reading is a gap in the line and is labelled "none", never
 * drawn as zero. Each day under the chart opens the entry sheet for that day, so readings
 * can still be added or fixed for any day of the week.
 */
export function BiomarkerTimeline({ summary, today, color = accent.lavenderDeep, onEditDay }: {
  summary: BiomarkerSummary;
  today: string;
  /** The latest reading's dot. */
  color?: string;
  onEditDay: (date: string) => void;
}) {
  const spec = BIOMARKER_SPECS[summary.kind];
  const baseline = summary.baseline;
  const [width, setWidth] = useState(0);
  const values = summary.series.map((day) => day.value).filter((value): value is number => value !== null);
  const latest = summary.latest;
  const latestIndex = latest ? summary.series.findIndex((day) => day.date === latest.date) : -1;

  const scale = (() => {
    const all = baseline === null ? values : [...values, baseline];
    if (!all.length) return null;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = Math.max(max - min, 4);
    const low = min - (span - (max - min)) / 2;
    return (value: number) => PAD_Y + (1 - (value - low) / span) * (CHART_HEIGHT - PAD_Y * 2);
  })();
  const column = width / Math.max(summary.series.length, 1);
  const points = summary.series.map((day, index) => (day.value === null || !scale ? null : { x: column * (index + 0.5), y: scale(day.value), index }));
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point) current.push(point);
    else if (current.length) { segments.push(current); current = []; }
  }
  if (current.length) segments.push(current);

  const value = (input: number) => formatBiomarkerValue(summary.kind, input);
  const headline = latest
    ? `${value(latest.value)} ${spec.unit} ${latest.date === today ? 'today' : dayLabel(latest.date, today).toLowerCase()}`
    : null;
  const comparison = latest && baseline !== null && summary.deltaLabel
    ? summary.deltaLabel.replace(/ vs usual$/, ` vs your usual ${value(baseline)}`)
    : summary.status;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{spec.label}</Text>
        <Text style={styles.meta}>7 days</Text>
      </View>

      {summary.days_with_data ? (
        <>
          {headline ? (
            <Text style={styles.sub}><Text style={styles.subStrong}>{headline}</Text> · {comparison}</Text>
          ) : null}
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${spec.label} over the last seven days: ${summary.series.map((day) => (day.value === null ? 'not logged' : value(day.value))).join(', ')} ${spec.unit}${baseline !== null ? `. Your usual is ${value(baseline)}` : ''}`}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={styles.chart}
          >
            {width > 0 && scale ? (
              <Svg width={width} height={CHART_HEIGHT}>
                {baseline !== null ? <Line x1={0} x2={width} y1={scale(baseline)} y2={scale(baseline)} stroke={ink.track} strokeWidth={1} strokeDasharray={[3, 4]} /> : null}
                {segments.filter((segment) => segment.length > 1).map((segment, index) => (
                  <Polyline key={index} points={segment.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={ink.text} strokeWidth={1.75} strokeLinejoin="round" />
                ))}
                {points.map((point) => (point ? (
                  <Circle key={point.index} cx={point.x} cy={point.y} r={point.index === latestIndex ? 4 : 3} fill={point.index === latestIndex ? color : ink.text} />
                ) : null))}
              </Svg>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={styles.empty}>No readings yet. Add the resting heart rate your watch or ring shows for last night, or connect a health app from your profile.</Text>
      )}

      <View style={styles.days}>
        {summary.series.map((day) => (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            accessibilityLabel={`${dayLabel(day.date, today)}: ${day.value === null ? 'no reading' : `${value(day.value)} ${spec.unit}`}. ${day.value === null ? 'Add' : 'Edit'} reading`}
            onPress={() => onEditDay(day.date)}
            style={({ pressed }) => [styles.day, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.dayText, day.date === today && styles.dayToday]}>
              {initial(day.date)}{day.value === null && summary.days_with_data ? ' · none' : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`Add a ${spec.label.toLowerCase()} reading for today`} onPress={() => onEditDay(today)} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
        <Ionicons accessible={false} color={ink.text} name="add" size={16} />
        <Text style={styles.addText}>Add a reading</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, paddingBottom: 2, paddingHorizontal: 16, paddingTop: 14 },
  header: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  title: { fontFamily: font.bodySemibold, fontSize: 14, color: ink.text },
  meta: { ...type.caption, color: ink.muted },
  sub: { ...type.caption, fontSize: 12.5, color: ink.muted, marginTop: 4 },
  subStrong: { fontFamily: font.bodyMedium, color: ink.text },
  chart: { height: CHART_HEIGHT, marginTop: 10 },
  empty: { ...type.body, color: ink.muted, marginTop: 8 },
  days: { flexDirection: 'row', marginTop: 2 },
  day: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: HIT, minWidth: 0 },
  dayText: { fontFamily: font.body, fontSize: 10.5, color: ink.muted },
  dayToday: { fontFamily: font.bodySemibold, color: ink.text },
  pressed: { opacity: 0.6 },
  add: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, minHeight: HIT },
  addText: { fontFamily: font.bodyMedium, fontSize: 13, color: ink.text }
});

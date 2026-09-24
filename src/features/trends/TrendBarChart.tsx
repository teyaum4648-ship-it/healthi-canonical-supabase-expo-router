import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TrendsDomainCard, TrendsSeriesPoint } from '../../engines/trends';
import { colors, type } from '../../styles/mobileTheme';
import { formatSleepMinutes } from '../sleepRhythm/sleepPresentation';

const CHART_HEIGHT = 96;

export function formatTrendValue(value: number, unit: TrendsDomainCard['series_unit']): string {
  if (unit === 'hours') return formatSleepMinutes(value * 60);
  if (unit === 'kcal') return `${Math.round(value).toLocaleString()} kcal`;
  if (unit === 'minutes') return `${Math.round(value)} min`;
  return String(Math.round(value));
}

/** The top of the scale: the largest value, rounded up to a figure worth printing. */
export function chartCeiling(values: number[], unit: TrendsDomainCard['series_unit']): number {
  const max = Math.max(0, ...values);
  if (unit === 'score') return 100;
  if (max === 0) return unit === 'hours' ? 8 : unit === 'kcal' ? 2000 : 30;
  const step = unit === 'hours' ? 2 : unit === 'kcal' ? 500 : 15;
  return Math.ceil(max / step) * step;
}

function dayLabel(date: string, style: 'weekday' | 'short'): string {
  const value = new Date(`${date}T12:00:00`);
  return style === 'weekday'
    ? value.toLocaleDateString(undefined, { weekday: 'narrow' })
    : value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A single-series bar chart for one Trends card, one bar per day.
 *
 * A day with nothing logged draws no bar — only a faint mark on the baseline — so a gap
 * reads as a gap and not as a zero. Tapping a bar shows its day and value above the
 * chart; nothing else on the chart carries a number, so it stays quiet at a glance.
 */
export function TrendBarChart({ series, color, unit, label }: {
  series: TrendsSeriesPoint[]; color: string; unit: TrendsDomainCard['series_unit']; label: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const values = series.map((point) => point.value).filter((value): value is number => value !== null);
  const ceiling = chartCeiling(values, unit);
  const chosen = series.find((point) => point.date === selected) ?? null;
  const narrow = series.length > 7;
  const edgeLabels = narrow
    ? [series[0], series[Math.floor(series.length / 2)], series[series.length - 1]].filter((point): point is TrendsSeriesPoint => Boolean(point))
    : series;

  const readout = chosen
    ? `${new Date(`${chosen.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${chosen.value === null ? 'Nothing logged' : formatTrendValue(chosen.value, unit)}`
    : values.length ? `${label} · tap a day` : `${label} · nothing logged yet`;

  return <View style={styles.wrap}>
    <View style={styles.header}>
      <Text style={styles.readout} numberOfLines={1}>{readout}</Text>
      <Text style={styles.scale}>{formatTrendValue(ceiling, unit)}</Text>
    </View>
    <View style={styles.plot}>
      <View pointerEvents="none" style={[styles.gridLine, { top: 0 }]} />
      <View pointerEvents="none" style={[styles.gridLine, { top: CHART_HEIGHT / 2 }]} />
      <View pointerEvents="none" style={styles.baseline} />
      {series.map((point) => {
        const fraction = point.value === null ? null : Math.min(1, point.value / ceiling);
        const dim = chosen !== null && chosen.date !== point.date;
        return <Pressable
          key={point.date}
          accessibilityRole="button"
          accessibilityLabel={`${new Date(`${point.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${point.value === null ? 'nothing logged' : formatTrendValue(point.value, unit)}`}
          onPress={() => setSelected((current) => current === point.date ? null : point.date)}
          style={styles.slot}
        >
          {fraction === null
            ? <View style={styles.gap} />
            : <View style={[styles.bar, narrow && styles.barNarrow, { height: Math.max(3, fraction * CHART_HEIGHT), backgroundColor: color, opacity: dim ? 0.35 : 1 }]} />}
        </Pressable>;
      })}
    </View>
    <View style={styles.axis}>
      {narrow
        ? edgeLabels.map((point, index) => <Text key={point.date} style={[styles.tick, index === 1 && styles.tickCenter, index === 2 && styles.tickEnd]}>{index === 2 ? 'Today' : dayLabel(point.date, 'short')}</Text>)
        : edgeLabels.map((point) => <Text key={point.date} style={[styles.tick, styles.tickDay]}>{dayLabel(point.date, 'weekday')}</Text>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  readout: { ...type.caption, color: colors.textMuted, flexShrink: 1 },
  scale: { ...type.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  plot: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 22, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barNarrow: { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  gap: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: -2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  tick: { ...type.caption, fontSize: 11, color: colors.textMuted },
  tickDay: { flex: 1, textAlign: 'center' },
  tickCenter: { textAlign: 'center' },
  tickEnd: { textAlign: 'right' }
});

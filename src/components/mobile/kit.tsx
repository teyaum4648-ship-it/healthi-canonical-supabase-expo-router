import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { colors, fonts, hairlineWidth } from '../../styles/mobileTheme';

/**
 * The shared pieces every tab is built from, so Today, Diet, Move, Sleep and Mood read as
 * one app: a large dial for the one number a screen is about, small rings, a week strip,
 * rows that pair a label with a tiny chart and a value, small uppercase section labels,
 * and one floating button for adding things.
 *
 * Everything here is presentational. A screen passes in numbers it already has; nothing
 * is calculated or estimated in this file, and an unknown value is drawn as an empty
 * track rather than a low one.
 */

const TRACK = 'rgba(255, 255, 255, 0.08)';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };
  const [sx, sy] = toXY(startDeg);
  const [ex, ey] = toXY(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

/** Small uppercase label over a section, with an optional note or link on the right. */
export function SectionLabel({ children, right, onRight }: { children: string; right?: string; onRight?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>{children}</Text>
      {right ? (
        onRight ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onRight}>
            <Text style={styles.sectionLink}>{right}</Text>
          </Pressable>
        ) : <Text style={styles.sectionAside}>{right}</Text>
      ) : null}
    </View>
  );
}

/** A flat card. */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.cardPad, style]}>{children}</View>;
}

/**
 * The large three-quarter dial a screen leads with. `fraction` is 0–1 or null for no
 * reading; the middle holds the label, the number and a coloured word.
 */
export function ScoreDial({ fraction, color, label, value, word, wordColor, size = 196, stroke = 12, accessibilityLabel }: {
  fraction: number | null;
  color: string;
  label: string;
  value: string;
  word?: string;
  wordColor?: string;
  size?: number;
  stroke?: number;
  accessibilityLabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const start = -135;
  const sweep = 270;
  const end = start + sweep * clamp01(fraction ?? 0);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel ?? `${label} ${value}${word ? `, ${word}` : ''}`} style={{ alignItems: 'center', height: size * 0.9, width: size }}>
      <Svg height={size} width={size}>
        <Path d={arcPath(c, c, r, start, start + sweep)} fill="none" stroke={TRACK} strokeLinecap="round" strokeWidth={stroke} />
        {fraction !== null && fraction > 0 ? (
          <Path d={arcPath(c, c, r, start, Math.max(start + 2, end))} fill="none" stroke={color} strokeLinecap="round" strokeWidth={stroke} />
        ) : null}
      </Svg>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dialCenter]}>
        <Text style={styles.dialLabel}>{label}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.dialValue, { fontSize: size * 0.33, lineHeight: size * 0.36 }]}>{value}</Text>
        {word ? <Text style={[styles.dialWord, { color: wordColor ?? color }]}>{word}</Text> : null}
      </View>
    </View>
  );
}

/** A small full ring, for a pillar or a day. `fraction` null draws the track only. */
export function MiniRing({ fraction, color, size = 44, stroke = 4, children }: { fraction: number | null; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * clamp01(fraction ?? 0);
  return (
    <View style={{ height: size, width: size }}>
      <Svg height={size} width={size}>
        <Circle cx={size / 2} cy={size / 2} fill="none" r={r} stroke={TRACK} strokeWidth={stroke} />
        {fraction !== null && fraction > 0 ? (
          <Circle cx={size / 2} cy={size / 2} fill="none" r={r} stroke={color} strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" strokeWidth={stroke} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </Svg>
      {children ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ringCenter]}>{children}</View> : null}
    </View>
  );
}

/** A labelled ring with its number in the middle, for a row of four. */
export function StatRing({ fraction, color, value, label, onPress }: { fraction: number | null; color: string; value: string; label: string; onPress?: () => void }) {
  const body = (
    <View style={styles.statRing}>
      <MiniRing color={color} fraction={fraction} size={46} stroke={4}>
        <Text style={styles.statRingValue}>{value}</Text>
      </MiniRing>
      <Text numberOfLines={1} style={styles.statRingLabel}>{label}</Text>
    </View>
  );
  if (!onPress) return <View accessible accessibilityLabel={`${label} ${value}`} style={styles.flex}>{body}</View>;
  return (
    <Pressable accessibilityLabel={`${label} ${value}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.flex, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

export type WeekDay = { date: string; letter: string; fraction: number | null; today: boolean };

/** Seven small rings, one per day, with today on a raised tile. */
export function WeekStrip({ days, color }: { days: WeekDay[]; color: string }) {
  return (
    <View accessible accessibilityLabel={`This week: ${days.map((day) => `${day.letter} ${day.fraction === null ? 'no reading' : Math.round(day.fraction * 100)}`).join(', ')}`} style={styles.weekStrip}>
      {days.map((day) => (
        <View key={day.date} style={[styles.weekDay, day.today && styles.weekDayToday]}>
          <Text style={[styles.weekLetter, day.today && styles.weekLetterToday]}>{day.letter}</Text>
          <MiniRing color={color} fraction={day.fraction} size={20} stroke={2.5} />
        </View>
      ))}
    </View>
  );
}

/** Vertical bars, the last one highlighted. Values are compared with each other only. */
export function MiniBars({ values, color, width = 40, height = 16 }: { values: (number | null)[]; color: string; width?: number; height?: number }) {
  const known = values.filter((value): value is number => value !== null);
  const max = known.length ? Math.max(...known) : 1;
  const gap = 2;
  const barWidth = values.length ? (width - gap * (values.length - 1)) / values.length : 0;
  return (
    <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap, height, width }}>
      {values.map((value, index) => (
        <View
          key={index}
          style={{
            backgroundColor: index === values.length - 1 ? color : 'rgba(255,255,255,0.22)',
            borderRadius: 1,
            height: value === null ? 2 : Math.max(2, (value / max) * height),
            width: barWidth
          }}
        />
      ))}
    </View>
  );
}

/** A thin line through the known values, with a dot on the last one. */
export function MiniLine({ values, color, width = 40, height = 16 }: { values: (number | null)[]; color: string; width?: number; height?: number }) {
  const known = values.map((value, index) => ({ value, index })).filter((point): point is { value: number; index: number } => point.value !== null);
  if (known.length < 2) {
    return <View style={{ height, justifyContent: 'center', width }}><View style={{ backgroundColor: TRACK, height: 2, borderRadius: 1 }} /></View>;
  }
  const min = Math.min(...known.map((point) => point.value));
  const max = Math.max(...known.map((point) => point.value));
  const span = max - min || 1;
  const x = (index: number) => (index / Math.max(1, values.length - 1)) * (width - 4) + 2;
  const y = (value: number) => height - 3 - ((value - min) / span) * (height - 6);
  const last = known[known.length - 1]!;
  return (
    <Svg height={height} width={width}>
      <Polyline fill="none" points={known.map((point) => `${x(point.index)},${y(point.value)}`).join(' ')} stroke="rgba(255,255,255,0.35)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
      <Circle cx={x(last.index)} cy={y(last.value)} fill={color} r={2.5} />
    </Svg>
  );
}

/** A short progress bar. `fraction` null draws the track only. */
export function MiniProgress({ fraction, color, width = 40 }: { fraction: number | null; color: string; width?: number }) {
  return (
    <View style={{ backgroundColor: TRACK, borderRadius: 2, height: 4, overflow: 'hidden', width }}>
      {fraction !== null ? <View style={{ backgroundColor: color, height: 4, width: `${clamp01(fraction) * 100}%` }} /> : null}
    </View>
  );
}

/** A row of dots, `done` of them filled. */
export function MiniDots({ done, total, color }: { done: number; total: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: Math.max(0, Math.min(total, 8)) }, (_, index) => (
        <View key={index} style={{ backgroundColor: index < done ? color : TRACK, borderRadius: 3, height: 6, width: 6 }} />
      ))}
    </View>
  );
}

/** A full-width progress bar for inside a card. */
export function ProgressBar({ fraction, color, marker }: { fraction: number | null; color: string; marker?: number }) {
  return (
    <View style={styles.progressTrack}>
      {fraction !== null ? <View style={[styles.progressFill, { backgroundColor: color, width: `${clamp01(fraction) * 100}%` }]} /> : null}
      {marker !== undefined ? <View style={[styles.progressMarker, { left: `${clamp01(marker) * 100}%` }]} /> : null}
    </View>
  );
}

/**
 * One line in a list: a coloured dot, the name, a tiny chart, the value with its unit,
 * and a chevron when it goes somewhere. Rows sit in a `RowGroup`.
 */
export function MetricRow({ color, title, visual, value, unit, detail, onPress, last = false, accessibilityLabel }: {
  color?: string;
  title: string;
  visual?: ReactNode;
  value?: string;
  unit?: string;
  detail?: string;
  onPress?: () => void;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {color ? <View style={[styles.rowDot, { backgroundColor: color }]} /> : null}
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>{title}</Text>
        {detail ? <Text numberOfLines={2} style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {visual ? <View style={styles.rowVisual}>{visual}</View> : null}
      {value !== undefined ? (
        <Text numberOfLines={1} style={styles.rowValue}>
          {value}
          {unit ? <Text style={styles.rowUnit}> {unit}</Text> : null}
        </Text>
      ) : null}
      {onPress ? <Ionicons accessible={false} color={colors.textFaint} name="chevron-forward" size={15} /> : null}
    </>
  );
  const style = [styles.row, !last && styles.rowDivider];
  const label = accessibilityLabel ?? `${title}${value !== undefined ? `, ${value}${unit ? ` ${unit}` : ''}` : ''}`;
  if (!onPress) return <View accessible accessibilityLabel={label} style={style}>{content}</View>;
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...style, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

/** A card holding rows. */
export function RowGroup({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, styles.rowGroup, style]}>{children}</View>;
}

/** A large number with a coloured word and a short line under it, for a screen's lead. */
export function HeroNumber({ eyebrow, value, unit, word, wordColor, note }: { eyebrow?: string; value: string; unit?: string; word?: string; wordColor?: string; note?: string }) {
  return (
    <View style={styles.hero}>
      {eyebrow ? <Text style={styles.sectionLabel}>{eyebrow}</Text> : null}
      <View style={styles.heroLine}>
        <Text style={styles.heroValue}>{value}{unit ? <Text style={styles.heroUnit}> {unit}</Text> : null}</Text>
        {word ? <Text style={[styles.heroWord, { color: wordColor ?? colors.accent }]}>{word}</Text> : null}
      </View>
      {note ? <Text style={styles.heroNote}>{note}</Text> : null}
    </View>
  );
}

/** A small energy curve, for a card. `points` are 0–1 values spread across the day. */
export function MiniCurve({ points, color, markerIndex, height = 56 }: { points: number[]; color: string; markerIndex?: number; height?: number }) {
  const width = 300;
  if (points.length < 2) return null;
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (value: number) => height - 6 - clamp01(value) * (height - 12);
  let d = `M ${x(0)} ${y(points[0]!)}`;
  for (let index = 1; index < points.length; index += 1) {
    const px = x(index - 1);
    const cx = x(index);
    const mid = (px + cx) / 2;
    d += ` C ${mid} ${y(points[index - 1]!)} ${mid} ${y(points[index]!)} ${cx} ${y(points[index]!)}`;
  }
  return (
    <Svg height={height} preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} width="100%">
      <Line stroke={TRACK} strokeWidth={1} x1={0} x2={width} y1={height - 1} y2={height - 1} />
      <Path d={d} fill="none" stroke={color} strokeLinecap="round" strokeWidth={2} />
      {markerIndex !== undefined && points[markerIndex] !== undefined ? (
        <Circle cx={x(markerIndex)} cy={y(points[markerIndex]!)} fill={color} r={4} />
      ) : null}
    </Svg>
  );
}

/** The round button that opens a screen's add sheet. */
export function Fab({ onPress, accessibilityLabel = 'Add' }: { onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
      <Ionicons accessible={false} color="#0A0D10" name="add" size={26} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.65 },
  sectionRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  sectionLabel: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, lineHeight: 16, textTransform: 'uppercase' },
  sectionAside: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13 },
  sectionLink: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: 20 },
  cardPad: { padding: 16 },
  dialCenter: { alignItems: 'center', justifyContent: 'center', paddingBottom: 6 },
  dialLabel: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  dialValue: { color: colors.text, fontFamily: fonts.display, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -2 },
  dialWord: { fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '600', marginTop: 2 },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  statRing: { alignItems: 'center', gap: 6 },
  statRingValue: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '700' },
  statRingLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', borderRadius: 12, gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  weekDayToday: { backgroundColor: colors.surface },
  weekLetter: { color: colors.textFaint, fontFamily: fonts.bodyMedium, fontSize: 11, fontWeight: '600' },
  weekLetterToday: { color: colors.text },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 52, paddingVertical: 10 },
  rowDivider: { borderBottomColor: colors.hairline, borderBottomWidth: hairlineWidth },
  rowGroup: { paddingHorizontal: 16 },
  rowDot: { borderRadius: 3.5, height: 7, width: 7 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '600' },
  rowDetail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  rowVisual: { alignItems: 'center', justifyContent: 'center', width: 44 },
  rowValue: { color: colors.text, fontFamily: fonts.display, fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '700', marginLeft: 6, maxWidth: 140, textAlign: 'right' },
  rowUnit: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, fontWeight: '500' },
  progressTrack: { backgroundColor: TRACK, borderRadius: 2, height: 4, overflow: 'visible', position: 'relative' },
  progressFill: { borderRadius: 2, height: 4 },
  progressMarker: { backgroundColor: colors.text, height: 10, marginLeft: -1, position: 'absolute', top: -3, width: 2 },
  hero: { gap: 4 },
  heroLine: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  heroValue: { color: colors.text, fontFamily: fonts.display, fontSize: 56, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -2, lineHeight: 62 },
  heroUnit: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 20, fontWeight: '600', letterSpacing: 0 },
  heroWord: { fontFamily: fonts.bodyMedium, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  heroNote: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  fab: { alignItems: 'center', backgroundColor: '#F5F6F7', borderRadius: 26, bottom: 16, elevation: 4, height: 52, justifyContent: 'center', position: 'absolute', right: 16, shadowColor: '#000', shadowOffset: { height: 6, width: 0 }, shadowOpacity: 0.4, shadowRadius: 12, width: 52 },
  fabPressed: { transform: [{ scale: 0.95 }] }
});

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { getRecommendedActivityAt, type CircadianBriefing } from '../../engines/circadian';
import { fonts } from '../../styles/mobileTheme';
import { SleepChartSurface } from './SleepChartSurface';
import type { SleepWindowTrackerPalette } from './SleepWindowTracker';
import { formatSleepTime } from './sleepPresentation';

// Same curve geometry and palette; this component changes interaction only.
function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export function SleepEnergyChart({ briefing, now, palette }: { briefing: CircadianBriefing; now: string; palette: SleepWindowTrackerPalette }) {
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);
  const height = 244;
  const chartTop = 50;
  const chartBottom = 58;
  const chartHeight = height - chartTop - chartBottom;
  const points = briefing.energy_curve;
  useEffect(() => setRatio(null), [briefing.date]);
  const chart = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const start = new Date(points[0].time).getTime();
    const end = new Date(points.at(-1)!.time).getTime();
    const span = Math.max(1, end - start);
    const coords = points.map((point) => ({ x: ((new Date(point.time).getTime() - start) / span) * width, y: chartTop + (1 - point.estimated_energy / 100) * chartHeight, point }));
    const line = buildPath(coords);
    const area = `${line} L ${width} ${height - chartBottom} L 0 ${height - chartBottom} Z`;
    const nowMs = new Date(now).getTime();
    const nowPoint = coords.reduce((best, candidate) => Math.abs(new Date(candidate.point.time).getTime() - nowMs) < Math.abs(new Date(best.point.time).getTime() - nowMs) ? candidate : best);
    return { start, span, coords, line, area, nowPoint };
  }, [points, now, width]);
  const scrub = useMemo(() => {
    if (!chart || ratio === null) return null;
    const time = new Date(chart.start + ratio * chart.span).toISOString();
    const recommendation = getRecommendedActivityAt(briefing, time);
    return { x: ratio * width, time: formatSleepTime(time), label: recommendation.label, energy: recommendation.energy };
  }, [briefing, chart, ratio, width]);
  const labels = points.length > 0 ? [points[0], points[Math.floor(points.length / 3)], points[Math.floor(points.length * 2 / 3)], points.at(-1)!] : [];
  return (
    <View>
      <View style={styles.shell}>
        <LinearGradient colors={['#CDD6DE', '#F0E6D5', '#E4EFE4', '#ECDCD4', '#3A4356']} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
        <SleepChartSurface height={height} ratio={ratio} onSelect={setRatio} onWidth={setWidth} valueLabel={scrub ? `${scrub.time}, ${scrub.label}, ${scrub.energy}% estimated energy` : 'Current time. Drag horizontally or use the arrow keys to inspect.'}>
          {chart ? <Svg height={height} width={width}>
            <Defs><SvgGradient id="sleep-energy-area" x1="0" x2="0" y1="0" y2="1"><Stop offset="0" stopColor={palette.accent} stopOpacity={0.34} /><Stop offset="1" stopColor={palette.accent} stopOpacity={0.02} /></SvgGradient></Defs>
            <Path d={chart.area} fill="url(#sleep-energy-area)" />
            <Path d={chart.line} fill="none" stroke={palette.accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} />
            {briefing.energy_extrema.map((extreme) => <Circle key={`${extreme.type}-${extreme.time}`} cx={((new Date(extreme.time).getTime() - chart.start) / chart.span) * width} cy={chartTop + (1 - extreme.energy / 100) * chartHeight} fill={extreme.type === 'peak' ? palette.accent : palette.amber} r={4.5} stroke="#FAF9F5" strokeWidth={2} />)}
            {scrub ? <Line stroke={palette.text} strokeOpacity={0.42} strokeWidth={1.5} x1={scrub.x} x2={scrub.x} y1={35} y2={height - 42} /> : <>
              <Line stroke={palette.accent} strokeOpacity={0.46} strokeWidth={1.5} x1={chart.nowPoint.x} x2={chart.nowPoint.x} y1={35} y2={height - 42} />
              <Circle cx={chart.nowPoint.x} cy={chart.nowPoint.y} fill="#FAF9F5" r={7} stroke={palette.accent} strokeWidth={3} />
            </>}
          </Svg> : null}
          <View style={styles.phases} pointerEvents="none">{['Rise', 'Peak', 'Dip', '2nd peak', 'Sleep'].map((phase) => <Text selectable={false} key={phase} style={styles.phase}>{phase}</Text>)}</View>
          {scrub ? <View pointerEvents="none" style={[styles.tooltip, { left: Math.max(8, Math.min(width - 168, scrub.x - 80)), backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text selectable={false} style={[styles.time, { color: palette.text }]}>{scrub.time}</Text>
            <Text selectable={false} style={[styles.activity, { color: palette.accent }]}>{scrub.label}</Text>
            <Text selectable={false} style={[styles.detail, { color: palette.muted }]}>{scrub.energy}% estimated energy</Text>
          </View> : null}
          <View style={styles.axis} pointerEvents="none">{labels.map((point) => <Text selectable={false} key={point.time} style={styles.axisText}>{formatSleepTime(point.time)}</Text>)}</View>
        </SleepChartSurface>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: palette.muted }]}>Predicted energy through your day</Text>
        {ratio !== null ? <Pressable accessibilityRole="button" accessibilityLabel="Return to current time on the energy graph" onPress={() => setRatio(null)} style={styles.reset}><Text style={[styles.footerText, { color: palette.accent }]}>Back to now</Text></Pressable>
          : <Text style={[styles.footerText, { color: palette.accent }]}>Drag to explore →</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { height: 244, marginTop: 15, overflow: 'hidden' },
  phases: { flexDirection: 'row', justifyContent: 'space-around', left: 10, position: 'absolute', right: 10, top: 14 },
  phase: { color: 'rgba(20,31,25,0.42)', fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  axis: { bottom: 10, flexDirection: 'row', justifyContent: 'space-between', left: 22, position: 'absolute', right: 22 },
  axisText: { color: 'rgba(20,31,25,0.48)', fontFamily: fonts.body, fontSize: 10 },
  tooltip: { borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, width: 160, paddingHorizontal: 11, paddingVertical: 8, position: 'absolute', top: 38 },
  time: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  activity: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 2 },
  detail: { fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 10, minHeight: 44, paddingHorizontal: 22 },
  footerText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  reset: { minHeight: 44, minWidth: 80, alignItems: 'center', justifyContent: 'center' }
});

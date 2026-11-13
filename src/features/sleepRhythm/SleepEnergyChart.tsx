import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

import { getRecommendedActivityAt, outlookLabel, THIN_COVERAGE, type CircadianBriefing } from '../../engines/circadian';
import { fonts, glassSurface } from '../../styles/mobileTheme';
import { SleepChartSurface } from './SleepChartSurface';
import type { SleepWindowTrackerPalette } from './SleepWindowTracker';
import { formatSleepTime } from './sleepPresentation';

/**
 * The vertical scale, which used to be a fixed 0–100.
 *
 * A fixed axis meant a wrecked day and a strong one filled the same space, with nothing
 * behind either to compare against. A free-floating axis is worse — it normalises every
 * day into looking average. So the domain adapts to cover both today and this person's
 * typical day, and is then held open to a minimum width so it can never zoom into noise.
 *
 * `DISPLAY_FLOOR` is the other half of removing the model's restoration floor. The model
 * is now allowed to say a day is genuinely terrible; the chart still has to draw a line
 * rather than lay it flat on the axis, where it would read as missing data.
 */
const MIN_DOMAIN_SPAN = 45;
const DOMAIN_PAD = 6;
const DISPLAY_FLOOR = 4;

function energyDomain(
  energies: number[],
  band: { low: number; high: number } | null
): { min: number; max: number } {
  const candidates = [...energies];
  if (band) candidates.push(band.low, band.high);
  if (candidates.length === 0) return { min: 0, max: 100 };

  let min = Math.max(0, Math.min(...candidates) - DOMAIN_PAD);
  let max = Math.min(100, Math.max(...candidates) + DOMAIN_PAD);

  /* Hold the window open so a flat day does not get magnified into drama. */
  const shortfall = MIN_DOMAIN_SPAN - (max - min);
  if (shortfall > 0) {
    min = Math.max(0, min - shortfall / 2);
    max = Math.min(100, max + shortfall / 2);
    if (max - min < MIN_DOMAIN_SPAN) {
      if (min === 0) max = Math.min(100, MIN_DOMAIN_SPAN);
      else min = Math.max(0, max - MIN_DOMAIN_SPAN);
    }
  }
  return { min, max };
}

/** The shell is a fixed night gradient, so chrome on it uses a fixed light ink, as the phase labels do. */
const BAND_INK = '#EEF1F6';

/** The words for the vertical scale. A percentage is not a unit anyone has a feel for. */
const BAND_MARKS: Array<{ at: number; label: string }> = [
  { at: 78, label: 'Sharp' },
  { at: 58, label: 'Steady' },
  { at: 38, label: 'Slow' },
  { at: 18, label: 'Flat' }
];

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
  const band = briefing.typical_band;
  const chart = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const start = new Date(points[0].time).getTime();
    const end = new Date(points.at(-1)!.time).getTime();
    const span = Math.max(1, end - start);

    const domain = energyDomain(points.map((point) => point.estimated_energy), band);
    const domainSpan = Math.max(1, domain.max - domain.min);
    /*
     * The reported number is always the model's. Only the drawn y is lifted off the axis,
     * so a genuinely terrible day reads as terrible rather than as missing data.
     */
    const floor = domain.min + domainSpan * 0.05;
    const project = (energy: number) =>
      chartTop + (1 - (Math.max(energy, floor) - domain.min) / domainSpan) * chartHeight;

    const coords = points.map((point) => ({
      x: ((new Date(point.time).getTime() - start) / span) * width,
      y: project(point.estimated_energy),
      point
    }));
    const line = buildPath(coords);
    const area = `${line} L ${width} ${height - chartBottom} L 0 ${height - chartBottom} Z`;
    const nowMs = new Date(now).getTime();
    const nowPoint = coords.reduce((best, candidate) => Math.abs(new Date(candidate.point.time).getTime() - nowMs) < Math.abs(new Date(best.point.time).getTime() - nowMs) ? candidate : best);

    const typical = band
      ? { top: project(band.high), bottom: project(band.low) }
      : null;
    const marks = BAND_MARKS
      .filter((mark) => mark.at >= domain.min + 4 && mark.at <= domain.max - 4)
      .map((mark) => ({ ...mark, y: project(mark.at) }));

    return { start, span, coords, line, area, nowPoint, project, typical, marks, domain };
  }, [points, now, width, band, chartHeight]);
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
        <LinearGradient colors={['#161A2B', '#171923', '#1B1B2D', '#121720', '#0E111A']} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
        <SleepChartSurface height={height} ratio={ratio} onSelect={setRatio} onWidth={setWidth} valueLabel={scrub ? `${scrub.time}, ${scrub.label}, ${scrub.energy}% estimated energy` : 'Current time. Drag horizontally or use the arrow keys to inspect.'}>
          {chart ? <Svg height={height} width={width}>
            <Defs><SvgGradient id="sleep-energy-area" x1="0" x2="0" y1="0" y2="1"><Stop offset="0" stopColor={palette.accent} stopOpacity={0.34} /><Stop offset="1" stopColor={palette.accent} stopOpacity={0.02} /></SvgGradient></Defs>
            {/*
              Your typical day, drawn behind. The axis can move; this does not, so the
              movement means something.
            */}
            {chart.typical ? (
              <>
                {/*
                  A fixed ink rather than palette.text: the shell's gradient is the same
                  whatever the time-of-day palette is, which is why the phase labels are a
                  fixed ink too.
                */}
                <Rect
                  fill={BAND_INK}
                  fillOpacity={0.085}
                  height={Math.max(1, chart.typical.bottom - chart.typical.top)}
                  width={width}
                  x={0}
                  y={chart.typical.top}
                />
                <Line
                  stroke={BAND_INK}
                  strokeDasharray="3 5"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                  x1={0}
                  x2={width}
                  y1={chart.typical.top}
                  y2={chart.typical.top}
                />
                <Line
                  stroke={BAND_INK}
                  strokeDasharray="3 5"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                  x1={0}
                  x2={width}
                  y1={chart.typical.bottom}
                  y2={chart.typical.bottom}
                />
              </>
            ) : null}
            <Path d={chart.area} fill="url(#sleep-energy-area)" />
            <Path d={chart.line} fill="none" stroke={palette.accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} />
            {briefing.energy_extrema.map((extreme) => <Circle key={`${extreme.type}-${extreme.time}`} cx={((new Date(extreme.time).getTime() - chart.start) / chart.span) * width} cy={chart.project(extreme.energy)} fill={extreme.type === 'peak' ? palette.accent : palette.amber} r={4.5} stroke="#FAF9F5" strokeWidth={2} />)}
            {scrub ? <Line stroke={palette.text} strokeOpacity={0.42} strokeWidth={1.5} x1={scrub.x} x2={scrub.x} y1={35} y2={height - 42} /> : <>
              <Line stroke={palette.accent} strokeOpacity={0.46} strokeWidth={1.5} x1={chart.nowPoint.x} x2={chart.nowPoint.x} y1={35} y2={height - 42} />
              <Circle cx={chart.nowPoint.x} cy={chart.nowPoint.y} fill="#FAF9F5" r={7} stroke={palette.accent} strokeWidth={3} />
            </>}
          </Svg> : null}
          <View style={styles.phases} pointerEvents="none">{['Rise', 'Peak', 'Dip', '2nd peak', 'Sleep'].map((phase) => <Text selectable={false} key={phase} style={styles.phase}>{phase}</Text>)}</View>
          {/* The vertical scale in words. "62% estimated energy" is not a unit anyone has a feel for. */}
          {chart ? chart.marks.map((mark) => (
            <Text key={mark.label} pointerEvents="none" selectable={false} style={[styles.bandMark, { top: mark.y - 7 }]}>
              {mark.label}
            </Text>
          )) : null}
          {scrub ? <View pointerEvents="none" style={[styles.tooltip, { left: Math.max(8, Math.min(width - 168, scrub.x - 80)), ...glassSurface, borderColor: palette.border }]}>
            <Text selectable={false} style={[styles.time, { color: palette.text }]}>{scrub.time}</Text>
            <Text selectable={false} style={[styles.activity, { color: palette.accent }]}>{scrub.label}</Text>
            <Text selectable={false} style={[styles.detail, { color: palette.muted }]}>{scrub.energy}% estimated energy</Text>
            {briefing.input_coverage < THIN_COVERAGE ? (
              <Text selectable={false} style={[styles.detail, { color: palette.muted }]}>Still calibrating</Text>
            ) : null}
          </View> : null}
          <View style={styles.axis} pointerEvents="none">{labels.map((point) => <Text selectable={false} key={point.time} style={styles.axisText}>{formatSleepTime(point.time)}</Text>)}</View>
        </SleepChartSurface>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: palette.muted }]}>
          {briefing.day_outlook
            ? `${outlookLabel(briefing.day_outlook.band)} day · ${briefing.day_outlook.score}`
            : 'Predicted energy through your day'}
          {band ? ' · shaded is your usual' : ''}
        </Text>
        {ratio !== null ? <Pressable accessibilityRole="button" accessibilityLabel="Return to current time on the energy graph" onPress={() => setRatio(null)} style={styles.reset}><Text style={[styles.footerText, { color: palette.accent }]}>Back to now</Text></Pressable>
          : <Text style={[styles.footerText, { color: palette.accent }]}>Drag to explore →</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { height: 244, marginTop: 15, overflow: 'hidden', borderRadius: 0 },
  phases: { flexDirection: 'row', justifyContent: 'space-around', left: 10, position: 'absolute', right: 10, top: 14 },
  phase: { color: 'rgba(235,240,255,0.55)', fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 0 },
  bandMark: {
    color: 'rgba(235,240,255,0.45)',
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    left: 8,
    letterSpacing: 0,
    position: 'absolute'
  },
  axis: { bottom: 10, flexDirection: 'row', justifyContent: 'space-between', left: 22, position: 'absolute', right: 22 },
  axisText: { color: 'rgba(235,240,255,0.6)', fontFamily: fonts.body, fontSize: 10 },
  tooltip: { borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, width: 160, paddingHorizontal: 11, paddingVertical: 8, position: 'absolute', top: 38, backgroundColor: '#202637' },
  time: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  activity: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 2 },
  detail: { fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 10, minHeight: 44, paddingHorizontal: 22 },
  footerText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  reset: { minHeight: 44, minWidth: 80, alignItems: 'center', justifyContent: 'center' }
});

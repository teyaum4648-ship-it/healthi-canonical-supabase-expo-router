import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path, Polyline } from 'react-native-svg';

import { ThreadButton } from '../../components/thread/ThreadParts';
import { accent, font, ink, radius, space, strand, surface, type } from '../../styles/daywoven1c';
import { buildDayThreadInput, localNowMinute, type DayThreadSources } from './dayThreadInput';
import { buildDayThread, scrubAt, type DayThreadRow, type DayThreadScrub } from './dayThreadModel';

/** How far the scrub column reaches from the left edge: the strand and the hour labels. */
const SCRUB_WIDTH = 112;
const TICK_MS = 30000;

/**
 * "Your day" on Today: the energy strand (handoff Phase 1, section 6). The engine's energy
 * curve runs down the left edge, solid where the day has been lived and dotted where it is
 * predicted. Above the amber now line are the things that were logged or measured; below it
 * is the plan. Press and hold the strand, then drag, to read the estimated level at a time.
 *
 * The now line moves on a 30-second tick only while Today is focused, like the readiness
 * card's clock; there is no background timer.
 */
export function DayThread({ sources, onLogSleep }: { sources: Omit<DayThreadSources, 'nowMinute'>; onLogSleep: () => void }) {
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  const [scrub, setScrub] = useState<DayThreadScrub | null>(null);

  useEffect(() => {
    if (!focused) return;
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, TICK_MS);
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') tick(); });
    return () => { clearInterval(interval); app.remove(); };
  }, [focused]);

  const input = useMemo(() => buildDayThreadInput({ ...sources, nowMinute: localNowMinute(now, sources.today) }), [now, sources]);
  const model = useMemo(() => buildDayThread(input), [input]);

  if (!model.area) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Log last night’s sleep to see your energy through today, with what you’ve logged above now and the plan below it.</Text>
        <ThreadButton label="Log last night’s sleep" onPress={onLogSleep} style={styles.emptyButton} />
      </View>
    );
  }

  const read = (offsetY: number) => setScrub(scrubAt(input, model.startHour, offsetY));
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(150)
    .onStart((event) => read(event.y))
    .onUpdate((event) => read(event.y));

  const step = (minutes: number) => {
    const from = scrub?.minute ?? input.nowMinute;
    read(((from + minutes - model.startHour * 60) / 60) * strand.hourHeight);
  };
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') step(15);
    if (event.nativeEvent.actionName === 'decrement') step(-15);
  };

  return (
    <View>
      <View style={styles.legend} accessible accessibilityLabel="Solid dots are logged or measured. Hollow dots are planned.">
        <View style={styles.legendItem}><View style={styles.dot} /><Text style={styles.legendText}>Logged or measured</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.hollow]} /><Text style={styles.legendText}>Planned</Text></View>
      </View>

      <View style={[styles.column, { height: model.height }]}>
        <Svg width={strand.areaWidth} height={model.height} style={styles.abs}>
          <Path d={model.area.path} fill={ink.strandArea} />
          {model.area.predictedLine ? (
            <Polyline points={model.area.predictedLine} fill="none" stroke={ink.text} strokeWidth={strand.lineWidth} strokeDasharray={[...strand.dash]} />
          ) : null}
        </Svg>
        {/* The lived part of the day: the same area, solid, cut off at now. */}
        <View pointerEvents="none" style={[styles.lived, { height: model.area.livedHeight }]}>
          <Svg width={strand.areaWidth} height={model.height}>
            <Path d={model.area.path} fill={ink.text} />
          </Svg>
        </View>

        {model.hourLabels.map((label) => (
          <Text key={label.label} importantForAccessibility="no" accessibilityElementsHidden style={[styles.hour, { top: label.y - 6 }]}>{label.label}</Text>
        ))}

        {model.rows.map((row) => <ThreadRow key={row.id} row={row} />)}

        {model.now ? (
          <>
            <View pointerEvents="none" style={[styles.nowLine, { top: model.now.y }]} />
            <View pointerEvents="none" style={[styles.nowPill, { top: model.now.y - 9 }]}>
              <Text style={styles.nowText}>{model.now.label}</Text>
            </View>
          </>
        ) : null}

        <GestureDetector gesture={pan}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={model.summary}
            accessibilityHint="Drag to read energy at a time"
            accessibilityValue={{ text: scrub ? `${scrub.time}, ${scrub.level ?? 'no window'} energy, estimate` : 'Not reading a time yet' }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={onAction}
            style={[styles.hit, { height: model.height }]}
          />
        </GestureDetector>

        {scrub ? (
          <>
            <View pointerEvents="none" style={[styles.scrubRule, { top: scrub.y }]} />
            <View pointerEvents="none" style={[styles.scrubDot, { left: scrub.x - 6, top: scrub.y - 6 }]} />
            <View pointerEvents="none" style={[styles.scrubPill, { top: scrub.y - 26 }]}>
              <Text style={styles.scrubText}>{scrub.time} · {scrub.level ?? '—'} · est.</Text>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

function ThreadRow({ row }: { row: DayThreadRow }) {
  if (row.kind === 'log') {
    return (
      <View accessible accessibilityLabel={`${row.time}, ${row.label}, logged`} style={[styles.row, { top: row.top }]}>
        <View style={[styles.dot, styles.rowDot, { top: 5.5 }]} />
        <Text numberOfLines={1} style={styles.logText}><Text style={styles.logTime}>{row.time}</Text>{'  '}{row.label}</Text>
      </View>
    );
  }
  if (row.kind === 'note') {
    return <Text numberOfLines={2} style={[styles.row, styles.detail, { top: row.top }]}>{row.text}</Text>;
  }
  if (row.kind === 'block') {
    const textTop = row.contentTop ?? (row.detailInside ? 24 : null);
    const lines = textTop === null ? 1 : Math.max(1, Math.floor((row.height - textTop - 20 - 8) / 17));
    return (
      <View accessible accessibilityLabel={`${row.title}, planned${row.detail ? `, ${row.detail}` : ''}`} style={[styles.row, styles.block, { top: row.top, height: row.height }, textTop !== null && { justifyContent: 'flex-start', paddingTop: textTop }]}>
        <Text numberOfLines={1} style={styles.planTitle}>{row.title}</Text>
        {row.detailInside && row.detail ? <Text numberOfLines={lines} style={[styles.detail, styles.detailOnWash]}>{row.detail}</Text> : null}
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel={`${row.title}, planned${row.detail ? `, ${row.detail}` : ''}`} style={[styles.row, { top: row.top }]}>
      <View style={[styles.dot, styles.hollow, styles.rowDot, { top: 6.5 }]} />
      <Text numberOfLines={1} style={styles.planTitle}>{row.title}</Text>
      {row.detail ? <Text numberOfLines={2} style={styles.detail}>{row.detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 16, paddingLeft: 126, paddingRight: space.gutter, paddingTop: 10 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendText: { ...type.small, color: ink.muted },
  column: { marginBottom: space.section, marginTop: 14, position: 'relative' },
  abs: { left: 0, position: 'absolute', top: 0 },
  lived: { left: 0, overflow: 'hidden', position: 'absolute', top: 0, width: strand.areaWidth },
  hour: { color: ink.muted, fontFamily: font.body, fontSize: 10.5, fontVariant: ['tabular-nums'], left: strand.hourLabelX, lineHeight: 13, position: 'absolute' },
  row: { left: strand.textX, position: 'absolute', right: space.gutter },
  rowDot: { left: strand.dotX - strand.textX, position: 'absolute' },
  dot: { backgroundColor: ink.text, borderRadius: strand.dotSize / 2, height: strand.dotSize, width: strand.dotSize },
  hollow: { backgroundColor: 'transparent', borderColor: ink.text, borderWidth: 1.5 },
  logText: { color: ink.text, fontFamily: font.body, fontSize: 13.5, lineHeight: 18 },
  logTime: { color: ink.muted, fontVariant: ['tabular-nums'] },
  planTitle: { ...type.bodyStrong, color: ink.text },
  detail: { ...type.caption, color: ink.muted },
  detailOnWash: { color: ink.mutedOnWash, marginTop: 2 },
  block: { backgroundColor: accent.amberWash, borderRadius: radius.block, justifyContent: 'center', paddingHorizontal: 12 },
  nowLine: { backgroundColor: accent.amberDeep, height: 1, left: 0, position: 'absolute', right: 0 },
  nowPill: { backgroundColor: accent.amber, borderRadius: radius.pill, left: strand.areaWidth, paddingHorizontal: 6, position: 'absolute' },
  nowText: { color: ink.text, fontFamily: font.bodySemibold, fontSize: 10.5, fontVariant: ['tabular-nums'], lineHeight: 18 },
  hit: { left: 0, position: 'absolute', top: 0, width: SCRUB_WIDTH },
  scrubRule: { backgroundColor: ink.text, height: 1, left: 0, position: 'absolute', width: SCRUB_WIDTH },
  scrubDot: { backgroundColor: surface.canvas, borderColor: ink.text, borderRadius: 6, borderWidth: 2, height: 12, position: 'absolute', width: 12 },
  scrubPill: { backgroundColor: surface.canvas, borderColor: ink.text, borderRadius: radius.pill, borderWidth: 1, left: 6, paddingHorizontal: 6, position: 'absolute' },
  scrubText: { color: ink.text, fontFamily: font.bodyMedium, fontSize: 10.5, fontVariant: ['tabular-nums'], lineHeight: 18 },
  empty: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, gap: 12, marginBottom: space.section, marginHorizontal: space.gutter, marginTop: 12, padding: 16 },
  emptyText: { ...type.body, color: ink.muted },
  emptyButton: { alignSelf: 'flex-start', paddingHorizontal: 18 }
});

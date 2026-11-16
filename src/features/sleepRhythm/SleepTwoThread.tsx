import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Eyebrow } from '../../components/thread/ThreadParts';
import { accent, bone, font, HIT, surface, type } from '../../styles/daywoven1c';
import { formatClock, formatClockCompact } from '../../utils/clockFormat';
import { readTwoProcess, twoProcessGeometry, type TwoProcessDay } from './twoProcessModel';

const HEIGHT = 190;

function provenance(day: TwoProcessDay): string {
  const nights = day.loggedNights === 1 ? '1 logged night' : `${day.loggedNights} logged nights`;
  const filled = day.filledNights > 0
    ? ` ${day.filledNights === 1 ? 'One night was' : `${day.filledNights} nights were`} not logged, so ${day.filledNights === 1 ? 'it uses' : 'they use'} your usual night.`
    : '';
  const lastNight = day.lastNightLogged ? '' : ' Last night is not logged yet.';
  return `Estimated from ${nights} this week with the two-process model of sleep. A model, not a measurement.${filled}${lastNight} ${day.confidence === 'medium' ? 'Medium' : 'Low'} confidence.`;
}

function restedNote(day: TwoProcessDay): string {
  if (day.extraPressureAtWake < 0.02) return 'Today started about where a rested week would.';
  if (day.extraPressureAtWake < 0.06) return 'Today started with a little more sleep pressure than after a rested week.';
  return 'Today started with clearly more sleep pressure than after a rested week, so the threads meet earlier.';
}

/**
 * Body clock and sleep pressure (design 1c, Sleep band): two threads and the space between
 * them, scrubbable, with an optional dashed line for a rested week. Drawn from the
 * two-process model in twoProcessModel.ts; every label on it says "est.".
 */
export function SleepTwoThread({ day, nowMinute }: { day: TwoProcessDay | null; nowMinute: number }) {
  const [width, setWidth] = useState(0);
  const [scrubMinute, setScrubMinute] = useState<number | null>(null);
  const [showRested, setShowRested] = useState(false);
  const geometry = useMemo(() => (day && width > 0 ? twoProcessGeometry(day, width, HEIGHT, showRested) : null), [day, width, showRested]);

  if (!day) {
    return (
      <View style={styles.section}>
        <Eyebrow tone="band">Body clock & sleep pressure</Eyebrow>
        <Text style={styles.empty}>Your two threads appear once a night is logged. They are estimated from your sleep times, never measured.</Text>
      </View>
    );
  }

  const inDay = nowMinute >= day.startMinute && nowMinute <= day.endMinute;
  const minute = scrubMinute ?? (inDay ? nowMinute : day.wakeMinute);
  const reading = readTwoProcess(day, minute);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart((event) => geometry && setScrubMinute(geometry.minuteAt(event.x)))
    .onUpdate((event) => geometry && setScrubMinute(geometry.minuteAt(event.x)));

  const onAction = (event: AccessibilityActionEvent) => {
    const step = event.nativeEvent.actionName === 'increment' ? 30 : event.nativeEvent.actionName === 'decrement' ? -30 : 0;
    setScrubMinute(Math.max(day.startMinute, Math.min(day.endMinute, minute + step)));
  };

  const x = geometry ? geometry.x(reading.minute) : 0;
  const yClock = geometry ? geometry.y(reading.clock) : 0;
  const yPressure = geometry ? geometry.y(reading.pressure) : 0;

  return (
    <View style={styles.section}>
      <Eyebrow tone="band">Body clock & sleep pressure</Eyebrow>
      <View style={styles.readout}>
        <Text style={styles.readoutTime} numberOfLines={1}>{formatClock(reading.minute)} · {reading.name}</Text>
        <Text style={styles.readoutLevel} numberOfLines={1}>{reading.energy.replace(' energy', '')} · est.</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Body clock and sleep pressure through today, estimated"
          accessibilityHint="Drag, or swipe up and down, to read another time"
          accessibilityValue={{ text: `${formatClock(reading.minute)}, ${reading.name}, ${reading.energy}, estimate` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAction}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={styles.chart}
        >
          {geometry ? (
            <Svg width={width} height={HEIGHT}>
              {geometry.gap ? <Path d={geometry.gap} fill={accent.amberGap} /> : null}
              <Path d={geometry.clock} fill="none" stroke={accent.amber} strokeWidth={2} strokeLinejoin="round" />
              <Path d={geometry.pressure} fill="none" stroke={accent.lavender} strokeWidth={2} strokeLinejoin="round" />
              {geometry.rested ? <Path d={geometry.rested} fill="none" stroke={bone.text} strokeWidth={1.5} strokeDasharray={[3, 4]} /> : null}
              {/* Now: a quiet vertical rule, so a scrubbed reading still shows where today is. */}
              {inDay ? <Line x1={geometry.x(nowMinute)} x2={geometry.x(nowMinute)} y1={0} y2={HEIGHT} stroke={bone.outline} strokeWidth={1} /> : null}
              <Line x1={x} x2={x} y1={Math.min(yClock, yPressure)} y2={Math.max(yClock, yPressure)} stroke={bone.text} strokeWidth={2} />
              <Circle cx={x} cy={yClock} r={5} fill={accent.amber} stroke={surface.band} strokeWidth={2} />
              <Circle cx={x} cy={yPressure} r={5} fill={accent.lavender} stroke={surface.band} strokeWidth={2} />
            </Svg>
          ) : null}
          {geometry ? (
            <>
              <Text pointerEvents="none" style={[styles.lineLabel, { color: accent.amber, top: geometry.clockLabelY, left: geometry.labelLeft }]}>Body clock</Text>
              <Text pointerEvents="none" style={[styles.lineLabel, { color: accent.lavender, top: geometry.pressureLabelY, left: geometry.labelLeft }]}>Sleep pressure</Text>
            </>
          ) : null}
        </View>
      </GestureDetector>
      {geometry ? (
        <View style={styles.ticks} pointerEvents="none">
          {geometry.ticks.map((tick, index) => (
            <Text
              key={tick.minute}
              style={[
                styles.tick,
                index === 0 ? { left: 0 } : index === geometry.ticks.length - 1 ? { right: 0 } : { left: tick.x - 22, width: 44, textAlign: 'center' }
              ]}
            >
              {formatClockCompact(tick.minute)}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.hintRow}>
        <Text style={styles.hint}>{scrubMinute === null ? 'Drag across to read any time' : 'Reading a moment you chose'}</Text>
        {scrubMinute !== null ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to now on the body clock chart" hitSlop={8} onPress={() => setScrubMinute(null)} style={styles.backToNow}>
            <Text style={styles.backToNowText}>Back to now</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.toggle}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleTitle}>Compare with a rested week</Text>
          <Text style={styles.toggleDetail}>Dashed line: pressure with no sleep debt</Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Compare with a rested week"
          accessibilityState={{ checked: showRested }}
          hitSlop={8}
          onPress={() => setShowRested((value) => !value)}
          style={[styles.switchTrack, showRested && styles.switchTrackOn]}
        >
          <View style={[styles.switchKnob, showRested && styles.switchKnobOn]} />
        </Pressable>
      </View>
      {showRested ? <Text style={styles.note}>{restedNote(day)}</Text> : null}
      <Text style={styles.provenance}>{provenance(day)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopColor: bone.hairline, borderTopWidth: 1, marginTop: 22, paddingTop: 18 },
  empty: { ...type.body, color: bone.soft, marginTop: 10 },
  readout: { alignItems: 'baseline', flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginTop: 12, minHeight: 24 },
  readoutTime: { color: bone.text, flexShrink: 1, fontFamily: font.display, fontSize: 20, fontVariant: ['tabular-nums'] },
  readoutLevel: { color: bone.soft, fontFamily: font.body, fontSize: 12.5 },
  chart: { height: HEIGHT, marginTop: 8 },
  lineLabel: { fontFamily: font.bodyMedium, fontSize: 11, position: 'absolute' },
  ticks: { height: 16, marginTop: 6 },
  tick: { color: bone.label, fontFamily: font.body, fontSize: 10, fontVariant: ['tabular-nums'], position: 'absolute' },
  hintRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: HIT },
  hint: { color: bone.muted, fontFamily: font.body, fontSize: 12 },
  backToNow: { justifyContent: 'center', minHeight: HIT },
  backToNowText: { color: accent.amber, fontFamily: font.bodyMedium, fontSize: 12.5 },
  toggle: { alignItems: 'center', borderTopColor: bone.hairline, borderTopWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 4, minHeight: HIT, paddingTop: 14 },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: bone.text, fontFamily: font.bodyMedium, fontSize: 14 },
  toggleDetail: { color: bone.muted, fontFamily: font.body, fontSize: 12, marginTop: 2 },
  /* The design's 46×28 switch: bone knob, amber track when on. */
  switchTrack: { backgroundColor: bone.raised, borderRadius: 14, height: 28, justifyContent: 'center', paddingHorizontal: 2, width: 46 },
  switchTrackOn: { backgroundColor: accent.amber },
  switchKnob: { backgroundColor: bone.text, borderRadius: 12, height: 24, width: 24 },
  switchKnobOn: { alignSelf: 'flex-end' },
  note: { color: bone.soft, fontFamily: font.body, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  provenance: { color: bone.faint, fontFamily: font.body, fontSize: 11.5, lineHeight: 16, marginTop: 10 }
});

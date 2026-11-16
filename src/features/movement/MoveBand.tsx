import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow, ThreadButton } from '../../components/thread/ThreadParts';
import type { LoadSummary } from '../../engines/load';
import { bone, font, HIT, ink, type } from '../../styles/daywoven1c';
import { loadChart } from './moveBandModel';

const CHART_HEIGHT = 120;

/**
 * The Move header band (design language P1): eyebrow, the movement plan's own verdict as
 * the headline and its explanation as the sub-line, the hero (seven days of training load,
 * tap a day to read it), and Start workout as the band's primary action.
 */
export function MoveBand({ verdict, explanation, effort, load, today, startLabel, onStart }: {
  verdict: string;
  explanation: string;
  effort: { min: number; max: number };
  load: Pick<LoadSummary, 'series' | 'label'>;
  today: string;
  startLabel: string;
  onStart: () => void;
}) {
  const chart = loadChart(load, today);
  const [selected, setSelected] = useState<string>(today);
  const reading = chart.bars.find((bar) => bar.date === selected) ?? chart.bars[chart.bars.length - 1];
  return (
    <View>
      <View style={styles.eyebrow}><Eyebrow tone="band">Move</Eyebrow></View>
      <Text accessibilityRole="header" style={styles.title}>{verdict}</Text>
      <Text style={styles.sub}>{explanation}</Text>
      <View style={styles.readout}>
        <Text style={styles.readoutMain}>{reading?.reading ?? '—'}</Text>
        <Text style={styles.readoutSide}>Effort {effort.min}–{effort.max} of 10 today</Text>
      </View>
      <View accessibilityLabel={`Training load over the last seven days. Today: ${load.label}`} style={styles.chart}>
        <View pointerEvents="none" style={[styles.zone, { top: chart.zone.top * CHART_HEIGHT, height: (chart.zone.bottom - chart.zone.top) * CHART_HEIGHT }]} />
        <Text pointerEvents="none" style={[styles.zoneLabel, { top: chart.zone.top * CHART_HEIGHT + 3 }]}>Moderate range</Text>
        <View style={styles.bars}>
          {chart.bars.map((bar) => {
            const active = bar.date === selected;
            return (
              <Pressable
                key={bar.date}
                accessibilityRole="button"
                accessibilityLabel={bar.reading}
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(bar.date)}
                style={styles.barSlot}
              >
                <View style={styles.barArea}>
                  {bar.height === null
                    ? <View style={[styles.rest, active && styles.restActive]} />
                    : <View style={[styles.bar, { height: Math.max(3, bar.height * CHART_HEIGHT) }, active ? styles.barActive : null]} />}
                </View>
                <Text style={[styles.day, (active || bar.isToday) && styles.dayActive]}>{bar.isToday ? 'Today' : bar.day}</Text>
              </Pressable>
            );
          })}
        </View>
        <View pointerEvents="none" style={styles.baseline} />
      </View>
      <ThreadButton
        tone="band"
        label={startLabel}
        onPress={onStart}
        style={styles.start}
        trailing={<Ionicons accessible={false} color={ink.text} name={startLabel.startsWith('Resume') ? 'play' : 'add'} size={18} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: 22 },
  title: { ...type.sleepTitle, color: bone.text, marginTop: 10 },
  sub: { ...type.body, color: bone.soft, marginTop: 10 },
  readout: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginTop: 20 },
  readoutMain: { color: bone.text, fontFamily: font.display, fontSize: 18, fontVariant: ['tabular-nums'] },
  readoutSide: { color: bone.soft, fontFamily: font.body, fontSize: 12.5 },
  chart: { height: CHART_HEIGHT + 30, marginTop: 12 },
  zone: { backgroundColor: bone.raised, left: 0, position: 'absolute', right: 0 },
  zoneLabel: { color: bone.label, fontFamily: font.body, fontSize: 10.5, position: 'absolute', right: 0 },
  bars: { bottom: 0, flexDirection: 'row', left: 0, position: 'absolute', right: 0, top: 0 },
  barSlot: { alignItems: 'center', flex: 1, minHeight: HIT },
  barArea: { alignItems: 'center', height: CHART_HEIGHT, justifyContent: 'flex-end', width: '100%' },
  bar: { backgroundColor: bone.muted, width: 16 },
  barActive: { backgroundColor: bone.text },
  rest: { backgroundColor: bone.outline, height: 2, width: 12 },
  restActive: { backgroundColor: bone.text },
  day: { color: bone.label, fontFamily: font.body, fontSize: 10.5, marginTop: 8 },
  dayActive: { color: bone.text, fontFamily: font.bodySemibold },
  baseline: { backgroundColor: bone.hairline, height: 1, left: 0, position: 'absolute', right: 0, top: CHART_HEIGHT },
  start: { marginTop: 18 }
});

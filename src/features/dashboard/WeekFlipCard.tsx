import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '../../components/mobile/useReducedMotion';
import { colors, type } from '../../styles/mobileTheme';
import { pillarColors, pillarTint } from '../../styles/pillarColors';
import type { WeekBar, WeekCard } from './weekCards';

const CARD_ICONS = { sleep: 'moon-outline', diet: 'nutrition-outline', move: 'barbell-outline', mood: 'happy-outline' } as const;
const useNativeDriver = Platform.OS !== 'web';

function MiniBars({ bars, color, tint }: { bars: WeekBar[]; color: string; tint: string }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.bars}>
    {bars.map((bar) => <View key={bar.day} style={styles.barSlot}>
      {bar.fraction === null
        ? <View style={styles.barEmpty} />
        : <View style={[styles.bar, { height: `${Math.round(Math.max(0.1, bar.fraction) * 100)}%`, backgroundColor: bar.strong ? color : tint }]} />}
    </View>)}
  </View>;
}

/**
 * One "This week" card. Tapping it turns it over to the thing to work on and back.
 *
 * The turn is a squeeze to nothing and back rather than a 3D rotation, because the
 * perspective a real rotation needs renders differently on web and native and a card
 * that distorts mid-turn reads as broken. With reduced motion on, it simply changes face.
 */
export function WeekFlipCard({ card, onAction }: { card: WeekCard; onAction: (card: WeekCard) => void }) {
  const reducedMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const color = pillarColors[card.pillar];
  const busy = useRef(false);

  function turn() {
    if (reducedMotion) { setFlipped((value) => !value); return; }
    if (busy.current) return;
    busy.current = true;
    Animated.timing(scale, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver }).start(() => {
      setFlipped((value) => !value);
      Animated.timing(scale, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver }).start(() => { busy.current = false; });
    });
  }

  const label = flipped
    ? `${card.title}, what to work on: ${card.back.headline}. ${card.back.detail}`
    : `${card.title} this week: ${card.front.value} ${card.front.label}. ${card.front.caption}.`;

  return <Animated.View style={[styles.card, { transform: [{ scaleX: scale }] }]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={flipped ? 'Shows this week’s numbers' : 'Shows what to work on'}
      onPress={turn}
      style={({ pressed }) => [styles.face, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        {flipped
          ? <Text style={[styles.eyebrow, { color }]}>Work on</Text>
          : <View style={styles.titleRow}>
            <Ionicons accessible={false} color={color} name={CARD_ICONS[card.id]} size={15} />
            <Text style={styles.title}>{card.title}</Text>
          </View>}
        <Ionicons accessible={false} color={colors.textMuted} name={flipped ? 'return-up-back-outline' : 'swap-horizontal-outline'} size={15} />
      </View>
      {flipped ? <>
        <Text style={styles.headline} numberOfLines={2}>{card.back.headline}</Text>
        <Text style={styles.detail} numberOfLines={5}>{card.back.detail}</Text>
      </> : <>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{card.front.value}</Text>
        <Text style={styles.label} numberOfLines={2}>{card.front.label}</Text>
        <MiniBars bars={card.front.bars} color={color} tint={pillarTint(card.pillar, 0.4)} />
        <Text style={styles.caption} numberOfLines={1}>{card.front.caption}</Text>
      </>}
    </Pressable>
    {flipped ? <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.back.actionLabel}, ${card.title}`}
      onPress={() => onAction(card)}
      style={({ pressed }) => [styles.action, { borderColor: color }, pressed && styles.pressed]}
    >
      <Text style={[styles.actionText, { color }]}>{card.back.actionLabel}</Text>
    </Pressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0, minHeight: 236, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.075)', padding: 14, gap: 10 },
  face: { flex: 1, gap: 4 },
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...type.label, color: colors.text },
  eyebrow: { ...type.caption, fontWeight: '600' },
  value: { fontFamily: type.body.fontFamily, fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.4, color: colors.text, fontVariant: ['tabular-nums'] },
  label: { ...type.caption, color: colors.textMuted },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 40, marginTop: 'auto', marginBottom: 6 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  barEmpty: { width: '100%', height: 6, borderRadius: 3, borderWidth: 1, borderColor: colors.borderStrong },
  caption: { ...type.caption, color: colors.textMuted },
  headline: { fontFamily: type.body.fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '600', color: colors.text },
  detail: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  action: { minHeight: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { ...type.label }
});

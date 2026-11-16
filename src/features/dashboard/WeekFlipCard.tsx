import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '../../components/mobile/useReducedMotion';
import { bone, font, HIT, ink, radius, surface, type } from '../../styles/daywoven1c';
import type { WeekCard } from './weekCards';

const CARD_ICONS = { sleep: 'moon-outline', diet: 'restaurant-outline', move: 'walk-outline', mood: 'leaf-outline' } as const;
const useNativeDriver = Platform.OS !== 'web';

/**
 * One "This week" card (design language P7). The front is the week's number; tapping it
 * turns it over to the one thing to work on, on the dark band colour, and back.
 *
 * The turn is a squeeze to nothing and back rather than a 3D rotation, because the
 * perspective a real rotation needs renders differently on web and native and a card
 * that distorts mid-turn reads as broken. With reduced motion on, it simply changes face.
 * The front no longer draws the week's mini bars (decision E); the same week is in Trends.
 */
export function WeekFlipCard({ card, onAction }: { card: WeekCard; onAction: (card: WeekCard) => void }) {
  const reducedMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
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

  return <Animated.View style={[styles.card, flipped && styles.cardFlipped, { transform: [{ scaleX: scale }] }]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={flipped ? 'Shows this week’s numbers' : 'Shows what to work on'}
      onPress={turn}
      style={({ pressed }) => [styles.face, pressed && styles.pressed]}
    >
      {flipped ? <>
        <Text style={styles.eyebrow}>{card.title} · work on</Text>
        <Text style={styles.headline} numberOfLines={3}>{card.back.headline}</Text>
        <Text style={styles.detail} numberOfLines={5}>{card.back.detail}</Text>
      </> : <>
        <View style={styles.titleRow}>
          <Ionicons accessible={false} color={ink.text} name={CARD_ICONS[card.id]} size={16} />
          <Text style={styles.title}>{card.title}</Text>
        </View>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{card.front.value}</Text>
        <Text style={styles.label} numberOfLines={2}>{card.front.label}</Text>
        <Text style={styles.caption} numberOfLines={3}>{card.front.caption}</Text>
      </>}
    </Pressable>
    {flipped ? <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.back.actionLabel}, ${card.title}`}
      onPress={() => onAction(card)}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Text style={styles.actionText}>{card.back.actionLabel}</Text>
    </Pressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, flex: 1, minHeight: 142, minWidth: 0, padding: 14 },
  cardFlipped: { backgroundColor: surface.band, borderColor: surface.band },
  face: { flex: 1 },
  pressed: { opacity: 0.7 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { fontFamily: font.bodySemibold, fontSize: 13, color: ink.text },
  value: { ...type.bigNumber, color: ink.text, fontVariant: ['tabular-nums'], marginTop: 14 },
  label: { fontFamily: font.body, fontSize: 12, lineHeight: 16.2, color: ink.text, marginTop: 6 },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16.2, color: ink.muted, marginTop: 2 },
  eyebrow: { fontFamily: font.bodySemibold, fontSize: 10.5, letterSpacing: 0.84, textTransform: 'uppercase', color: bone.muted },
  headline: { fontFamily: font.bodySemibold, fontSize: 14, lineHeight: 18.2, color: bone.text, marginTop: 8 },
  detail: { fontFamily: font.body, fontSize: 12, lineHeight: 16.8, color: bone.soft, marginTop: 4 },
  action: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: HIT },
  actionText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: bone.text, textDecorationLine: 'underline' }
});

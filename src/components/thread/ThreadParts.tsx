import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityState, type StyleProp, type ViewStyle } from 'react-native';

import { APP_NAME } from '../../constants/brand';
import { bone, control, HIT, ink, radius, space, surface, type } from '../../styles/daywoven1c';
import { RotatingChevron } from './RotatingChevron';

/**
 * The shared building blocks of the 1c "Thread" design language (docs/design/1c/HANDOFF.md,
 * P1–P15). Today is built from these first; every later screen reuses them, so a change
 * here changes the whole app consistently.
 */

export type Tone = 'band' | 'canvas';

/** P1: the charcoal band at the top of a screen. Paints upward too, so pulling past the top never shows the canvas. */
export function ThreadBand({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.band, style]}>
      <View pointerEvents="none" style={styles.bandOverscroll} />
      {children}
    </View>
  );
}

/** P1: the wordmark and date row, with the screen's own buttons on the right. */
export function ThreadHeader({ date, dateAccessibilityLabel, right }: { date: string; dateAccessibilityLabel?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Text accessibilityRole="header" style={styles.wordmark}>{APP_NAME}</Text>
        <Text accessibilityLabel={dateAccessibilityLabel} numberOfLines={1} style={styles.date}>{date}</Text>
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function SectionTitle({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

export function Eyebrow({ children, tone = 'canvas' }: { children: string; tone?: Tone }) {
  return <Text style={[styles.eyebrow, tone === 'band' && styles.eyebrowBand]}>{children}</Text>;
}

/** P13: 46pt buttons. Primary on the band is bone with ink text; on the canvas it is ink with bone text. */
export function ThreadButton({
  label,
  onPress,
  variant = 'primary',
  tone = 'canvas',
  trailing,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  style
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  tone?: Tone;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === 'primary';
  const onBand = tone === 'band';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: onBand ? bone.text : ink.text }
          : { borderWidth: 1, borderColor: onBand ? bone.outline : ink.border },
        pressed && styles.pressed,
        style
      ]}
    >
      <Text numberOfLines={1} style={[styles.buttonText, { color: primary ? (onBand ? ink.text : bone.text) : onBand ? bone.text : ink.text }]}>{label}</Text>
      {trailing}
    </Pressable>
  );
}

/**
 * P13: a text link. "underline" is the default action style (Inter 500, underline, chevron);
 * "quiet" is a muted secondary link that carries its own trailing icon (e.g. a disclosure chevron).
 */
export function TextLink({
  label,
  onPress,
  tone = 'canvas',
  variant = 'underline',
  trailing,
  accessibilityLabel,
  accessibilityState
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  variant?: 'underline' | 'quiet';
  trailing?: ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}) {
  const color = variant === 'quiet' ? (tone === 'band' ? bone.muted : ink.muted) : tone === 'band' ? bone.text : ink.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={[styles.linkText, { color }, variant === 'underline' && tone === 'canvas' && styles.underline]}>{label}</Text>
      {trailing ?? <Ionicons accessible={false} color={color} name="chevron-forward" size={14} />}
    </Pressable>
  );
}

/** P3: the full-width "Explore …" disclosure: white, radius 14, rotating chevron. */
export function ExploreButton({ title, detail, expanded, onPress, accessibilityLabel }: {
  title: string;
  detail: string;
  expanded: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.explore, pressed && styles.pressed]}
    >
      <View style={styles.exploreCopy}>
        <Text style={styles.exploreTitle}>{title}</Text>
        <Text style={styles.exploreDetail}>{detail}</Text>
      </View>
      <RotatingChevron open={expanded} color={ink.text} size={18} />
    </Pressable>
  );
}

/** P4: a hairline list row. Title and detail on the left, a tabular value on the right. */
export function HairlineRow({ title, detail, value, tone = 'canvas', onPress, accessibilityHint, last = false }: {
  title: string;
  detail?: string;
  value?: string;
  tone?: Tone;
  onPress?: () => void;
  accessibilityHint?: string;
  last?: boolean;
}) {
  const onBand = tone === 'band';
  const line = onBand ? bone.hairline : ink.hairline;
  const body = (
    <>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: onBand ? bone.text : ink.text }]}>{title}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: onBand ? bone.muted : ink.muted }]}>{detail}</Text> : null}
      </View>
      {value !== undefined ? <Text style={[styles.rowValue, { color: onBand ? bone.text : ink.text }]}>{value}</Text> : null}
    </>
  );
  const rowStyle = [styles.row, { borderTopColor: line }, last && { borderBottomColor: line, borderBottomWidth: 1 }];
  if (!onPress) {
    return <View accessible accessibilityLabel={[title, detail, value].filter(Boolean).join(', ')} style={rowStyle}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, detail, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** P5: a white card that groups one module with its title and figure. */
export function ThreadCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  band: { backgroundColor: surface.band, paddingHorizontal: space.gutter, paddingBottom: 22, paddingTop: 4 },
  bandOverscroll: { position: 'absolute', left: 0, right: 0, top: -1000, height: 1000, backgroundColor: surface.band },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: HIT },
  brand: { alignItems: 'baseline', flexDirection: 'row', flexShrink: 1, gap: 10 },
  wordmark: { ...type.wordmark, color: bone.text },
  date: { ...type.caption, fontSize: 12.5, color: bone.muted },
  headerRight: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  sectionTitle: { ...type.sectionTitle, color: ink.text },
  eyebrow: { ...type.eyebrow, color: ink.muted },
  eyebrowBand: { color: bone.muted },
  button: { alignItems: 'center', borderRadius: radius.button, flexDirection: 'row', gap: 6, height: control.buttonHeight, justifyContent: 'center', paddingHorizontal: 12 },
  buttonText: { ...type.button, flexShrink: 1 },
  pressed: { opacity: 0.72 },
  link: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 4, minHeight: HIT },
  linkText: { ...type.button },
  underline: { textDecorationLine: 'underline' },
  explore: { alignItems: 'center', backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', padding: 16 },
  exploreCopy: { flex: 1, gap: 3 },
  exploreTitle: { ...type.cardTitle, color: ink.text },
  exploreDetail: { ...type.caption, fontSize: 12.5, lineHeight: 17.5, color: ink.muted },
  row: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 10, minHeight: HIT, paddingVertical: 10 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: type.bodyStrong.fontFamily, fontSize: 13, lineHeight: 18 },
  rowDetail: { ...type.caption },
  rowValue: { fontFamily: type.body.fontFamily, fontSize: 13, fontVariant: ['tabular-nums'] },
  card: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, padding: 14 }
});

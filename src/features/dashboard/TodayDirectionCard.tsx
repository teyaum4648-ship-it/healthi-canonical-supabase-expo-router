import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RotatingChevron } from '../../components/thread/RotatingChevron';
import { Eyebrow, HairlineRow, TextLink } from '../../components/thread/ThreadParts';
import { ink, type as type1c } from '../../styles/daywoven1c';

export const daywovenV2 = {
  background: '#0C0E13',
  surface: '#151920',
  elevated: '#1A1F28',
  border: '#2B303C',
  text: '#F0F3F7',
  secondary: '#B5BDCC',
  muted: '#929EAD',
  blue: '#9FCCFF',
  lavender: '#B6B2FA',
  peach: '#FFC6A6'
} as const;

type Driver = {
  domain: string;
  label: string;
  detail: string;
};

type TodayDirectionProps = {
  headline: string;
  explanation: string;
  source: string;
  confidence: string;
  availableFoundationCount: number;
  drivers: Driver[];
  primaryLabel: string;
  onPrimary: () => void;
  /** Kept for callers; in 1c the primary link is the way to the full plan. */
  onFullPlan: () => void;
};

/**
 * View layer only: all text and signals come from the existing protocol and
 * readiness engines. No derived medical score or new storage is introduced.
 *
 * 1c "Today's direction": an eyebrow, the engine's headline in Jost, one confidence/source
 * line, then the action as a text link. "Why this direction?" expands the drivers inline
 * (design language P3). The explanation paragraph and the separate "Full plan" button are
 * not drawn in 1c: the same explanation is the "Next best action" detail under Explore,
 * and the full plan is the link itself. Both props stay so callers do not change.
 */
export function TodayDirectionCard({
  headline,
  source,
  confidence,
  availableFoundationCount,
  drivers,
  primaryLabel,
  onPrimary
}: TodayDirectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.section}>
      <Eyebrow>Today’s direction</Eyebrow>
      <Text accessibilityRole="header" style={styles.title}>{headline}</Text>
      <Text style={styles.meta}>{source} · {confidence} confidence</Text>

      <View style={styles.links}>
        <TextLink label={primaryLabel} onPress={onPrimary} />
        <TextLink
          label="Why this direction?"
          variant="quiet"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(open => !open)}
          trailing={<RotatingChevron open={expanded} color={ink.muted} size={14} />}
        />
      </View>

      {expanded ? (
        <View style={styles.detailPanel}>
          {drivers.length > 0 ? drivers.map((driver, index) => (
            <HairlineRow key={driver.domain} title={driver.label} detail={driver.detail} last={index === drivers.length - 1} />
          )) : <Text style={styles.note}>As you add logs, Daywoven can explain more of the signals behind your plan.</Text>}
          <Text style={styles.note}>{availableFoundationCount} of 4 foundations · {confidence} confidence. These are wellness estimates, not a diagnosis. Missing information limits confidence; it does not mean something is wrong.</Text>
        </View>
      ) : null}
    </View>
  );
}

type Shortcut = {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

export function InsightShortcuts({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <View style={styles.shortcutGroup}>
      <Text accessibilityRole="header" style={styles.shortcutHeader}>Explore your insights</Text>
      <View style={styles.shortcutList}>
        {shortcuts.map((item, index) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${item.description}`}
            onPress={item.onPress}
            style={({ pressed }) => [styles.shortcut, index < shortcuts.length - 1 && styles.shortcutBorder, pressed && styles.pressed]}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: `${item.color}1D` }]}>
              <Ionicons accessible={false} name={item.icon} color={item.color} size={19} />
            </View>
            <View style={styles.shortcutText}>
              <Text style={styles.shortcutTitle}>{item.label}</Text>
              <Text style={styles.shortcutDescription}>{item.description}</Text>
            </View>
            <Ionicons accessible={false} name="chevron-forward" size={17} color={daywovenV2.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 24 },
  title: { ...type1c.directionTitle, color: ink.text, marginTop: 10 },
  meta: { ...type1c.body, color: ink.muted, marginTop: 10 },
  links: { alignItems: 'center', columnGap: 18, flexDirection: 'row', flexWrap: 'wrap' },
  detailPanel: { marginTop: 2 },
  note: { ...type1c.caption, color: ink.muted, marginTop: 10 },
  pressed: { opacity: 0.72 },
  shortcutGroup: { gap: 12 },
  shortcutHeader: { color: daywovenV2.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.4, paddingHorizontal: 3 },
  shortcutList: {
    backgroundColor: daywovenV2.surface,
    borderColor: daywovenV2.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14
  },
  shortcut: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  shortcutBorder: { borderBottomColor: daywovenV2.border, borderBottomWidth: StyleSheet.hairlineWidth },
  shortcutIcon: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  shortcutText: { flex: 1, gap: 3 },
  shortcutTitle: { color: daywovenV2.text, fontSize: 15, fontWeight: '600' },
  shortcutDescription: { color: daywovenV2.muted, fontSize: 12, lineHeight: 17 }
});

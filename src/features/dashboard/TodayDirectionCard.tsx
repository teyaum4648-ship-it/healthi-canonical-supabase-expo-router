import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  onFullPlan: () => void;
};

/**
 * View layer only: all text and signals come from the existing protocol and
 * readiness engines. No derived medical score or new storage is introduced.
 */
export function TodayDirectionCard({
  headline,
  explanation,
  source,
  confidence,
  availableFoundationCount,
  drivers,
  primaryLabel,
  onPrimary,
  onFullPlan
}: TodayDirectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.topline}>
        <View style={styles.eyebrowWrap}>
          <View style={styles.signalDot} />
          <Text style={styles.eyebrow}>TODAY'S DIRECTION</Text>
        </View>
        <Text style={styles.source}>{source}</Text>
      </View>

      <Text accessibilityRole="header" style={styles.title}>{headline}</Text>
      <Text style={styles.explanation}>{explanation}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        onPress={onPrimary}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>{primaryLabel}</Text>
        <Ionicons accessible={false} color={daywovenV2.background} name="arrow-forward-outline" size={18} />
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(open => !open)}
          style={({ pressed }) => [styles.quietAction, pressed && styles.pressed]}
        >
          <Ionicons accessible={false} color={daywovenV2.blue} name="information-circle-outline" size={17} />
          <Text style={styles.quietText}>{expanded ? 'Hide the reasons' : 'Why this direction?'}</Text>
          <Ionicons accessible={false} color={daywovenV2.muted} name={expanded ? 'chevron-up' : 'chevron-down'} size={15} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your complete daily plan"
          onPress={onFullPlan}
          style={({ pressed }) => [styles.quietAction, pressed && styles.pressed]}
        >
          <Text style={styles.quietText}>Full plan</Text>
          <Ionicons accessible={false} color={daywovenV2.blue} name="arrow-forward-outline" size={15} />
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailLabel}>What informed this</Text>
            <Text style={styles.detailMeta}>{availableFoundationCount} of 4 foundations · {confidence} confidence</Text>
          </View>
          {drivers.length > 0 ? drivers.map(driver => (
            <View key={driver.domain} style={styles.driver}>
              <Text style={styles.driverName}>{driver.label}</Text>
              <Text style={styles.driverDetail}>{driver.detail}</Text>
            </View>
          )) : <Text style={styles.driverDetail}>As you add logs, Daywoven can explain more of the signals behind your plan.</Text>}
          <Text style={styles.disclaimer}>These are wellness estimates, not a diagnosis. Missing information limits confidence; it does not mean something is wrong.</Text>
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
  card: {
    backgroundColor: daywovenV2.surface,
    borderColor: daywovenV2.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 14
  },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrowWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  signalDot: { height: 7, width: 7, borderRadius: 4, backgroundColor: daywovenV2.blue },
  eyebrow: { color: daywovenV2.blue, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  source: { color: daywovenV2.muted, fontSize: 11, flexShrink: 1 },
  title: { color: daywovenV2.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.8, lineHeight: 34 },
  explanation: { color: daywovenV2.secondary, fontSize: 15, lineHeight: 23 },
  primary: {
    minHeight: 50,
    backgroundColor: daywovenV2.blue,
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 17
  },
  primaryText: { color: daywovenV2.background, fontWeight: '700', fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  quietAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quietText: { color: daywovenV2.blue, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  detailPanel: {
    gap: 13,
    paddingTop: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: daywovenV2.border
  },
  detailHeader: { gap: 4 },
  detailLabel: { color: daywovenV2.text, fontWeight: '700', fontSize: 15 },
  detailMeta: { color: daywovenV2.muted, fontSize: 12 },
  driver: { gap: 3 },
  driverName: { color: daywovenV2.text, fontWeight: '600', fontSize: 13 },
  driverDetail: { color: daywovenV2.secondary, fontSize: 13, lineHeight: 19 },
  disclaimer: { color: daywovenV2.muted, fontSize: 11, lineHeight: 17 },
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

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import { pillarTint, tabAccent } from '../../styles/pillarColors';
import {
  BREATH_TECHNIQUES,
  breathsPerMinute,
  patternLine,
  type BreathTechnique
} from './breathTechniques';

/**
 * Choosing a technique, which is the actual feature.
 *
 * A row shows the pattern and the rate; opening one shows when to reach for it and why it
 * does anything. That split matters — the list has to stay scannable for someone who
 * already knows what they want, and the reasoning has to be there for someone who does
 * not. Collapsing everything by default and expanding on tap gets both.
 *
 * Rate is shown per technique because two of these are opposites, and "3.8 breaths a
 * minute" against "18 breaths a minute" tells you that faster than any adjective.
 */

/**
 * The techniques shown before "More techniques": the first three, plus the one in use
 * if it is further down. Ten expanded rows made this the longest thing on the tab.
 */
export function techniquesToShow<T extends { id: string }>(all: T[], selectedId: string, showAll: boolean, limit = 3): T[] {
  if (showAll) return all;
  const first = all.slice(0, limit);
  const selected = all.find((technique) => technique.id === selectedId);
  return selected && !first.includes(selected) ? [...first, selected] : first;
}

export function TechniquePicker({
  selectedId,
  onSelect
}: {
  selectedId: string;
  onSelect: (technique: BreathTechnique) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const shown = techniquesToShow(BREATH_TECHNIQUES, selectedId, showAll);
  const more = BREATH_TECHNIQUES.length - shown.length;

  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.eyebrow}>Technique</Text>
      <Text style={styles.body}>
        These are not interchangeable. Most bring you down, the last one deliberately takes
        you up, and picking the wrong one is most of why breathing exercises get abandoned.
      </Text>

      <View style={styles.list}>
        {shown.map((technique, index) => {
          const selected = technique.id === selectedId;
          const open = technique.id === openId;

          return (
            <View key={technique.id}>
              {index > 0 ? <View style={styles.divider} /> : null}

              <Pressable
                accessibilityHint={open ? 'Hides the detail' : 'Shows when and why to use this'}
                accessibilityLabel={`${technique.name}. ${technique.summary}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: open, selected }}
                onPress={() => setOpenId(open ? null : technique.id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={[styles.icon, selected && styles.iconSelected]}>
                  <Ionicons
                    accessible={false}
                    color={selected ? colors.primaryText : tabAccent.mood}
                    name={technique.icon as never}
                    size={18}
                  />
                </View>

                <View style={styles.copy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{technique.name}</Text>
                    {technique.structure === 'rounds' ? (
                      <Text style={styles.tag}>rounds</Text>
                    ) : null}
                    {selected ? <Text style={styles.tagOn}>in use</Text> : null}
                  </View>
                  <Text style={styles.summary}>{technique.summary}</Text>
                  <Text style={styles.pattern}>
                    {patternLine(technique)} · {breathsPerMinute(technique)}/min
                  </Text>
                </View>

                <Ionicons
                  accessible={false}
                  color={colors.textFaint}
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={16}
                />
              </Pressable>

              {open ? (
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>When</Text>
                  <Text style={styles.detailText}>{technique.when}</Text>

                  <Text style={styles.detailLabel}>Why</Text>
                  <Text style={styles.detailText}>{technique.why}</Text>

                  {technique.caution ? (
                    <View style={styles.caution}>
                      <Text style={styles.cautionLabel}>
                        {technique.requiresAcknowledgement ? 'Read this first' : 'Careful'}
                      </Text>
                      <Text style={styles.cautionText}>{technique.caution}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { onSelect(technique); setOpenId(null); }}
                    style={({ pressed }) => [styles.use, pressed && styles.pressed]}
                  >
                    <Text style={styles.useText}>
                      {technique.structure === 'rounds' ? `Open ${technique.name}` : `Use ${technique.name}`}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      {more > 0 || showAll ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll((open) => !open)} style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}>
          <Text style={styles.useText}>{showAll ? 'Fewer techniques' : `More techniques (${more})`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  eyebrow: { ...type.body, fontWeight: '600', color: colors.text },
  moreRow: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  body: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  list: { gap: 0 },
  divider: { backgroundColor: colors.border, height: hairlineWidth },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 11, minHeight: 64, paddingVertical: 11 },
  icon: {
    alignItems: 'center',
    backgroundColor: pillarTint('mind_life_load', 0.11),
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  iconSelected: { backgroundColor: tabAccent.mood },
  copy: { flex: 1, gap: 2 },
  nameRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  name: { ...type.body, color: colors.text, fontWeight: '600' },
  tag: {
    ...type.caption,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 5,
    color: colors.textMuted,
    fontSize: 11,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  tagOn: {
    ...type.caption,
    backgroundColor: pillarTint('mind_life_load', 0.11),
    borderRadius: 5,
    color: tabAccent.mood,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  summary: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  pattern: { ...type.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },

  detail: { gap: 6, paddingBottom: 14, paddingLeft: 45, paddingRight: 4 },
  detailLabel: { ...type.caption, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  detailText: { ...type.caption, color: colors.text, lineHeight: 20 },

  caution: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.danger,
    borderRadius: 10,
    borderWidth: hairlineWidth,
    gap: 3,
    marginTop: 8,
    padding: 12
  },
  cautionLabel: { ...type.label, color: colors.danger },
  cautionText: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  use: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 16
  },
  useText: { ...type.label, color: tabAccent.mood },
  pressed: { opacity: 0.7 }
});

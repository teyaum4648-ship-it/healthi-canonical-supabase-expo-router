import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionTitle } from '../../components/thread/ThreadParts';
import { font, HIT, ink, radius, surface, type } from '../../styles/daywoven1c';

export type QuickLogAction = {
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** A running count shown after the label when it is known, e.g. "3" for "Water · 3". */
  count?: number | null;
  /** Legacy accent from the old Home; 1c tiles are ink only. */
  color?: string;
  onPress: () => void;
};

/**
 * Quick log in the 1c tile grid (P6): equal 66pt tiles, a 20pt icon and one word. The notice
 * row under the tiles carries "Undo" after a glass of water, and stays visible with its own
 * text when a save fails.
 */
export function QuickLog({ actions, notice }: { actions: QuickLogAction[]; notice?: { text: string; onUndo?: () => void } | null }) {
  return (
    <View style={styles.section}>
      <SectionTitle>Quick log</SectionTitle>
      <View style={styles.row}>
        {actions.map((action) => {
          const counted = typeof action.count === 'number' && action.count > 0;
          return (
            <Pressable
              accessibilityLabel={`${action.label}${counted ? `, ${action.count} today` : ''}. ${action.detail}`}
              accessibilityRole="button"
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <Ionicons accessible={false} color={ink.text} name={action.icon} size={20} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.label}>
                {counted ? `${action.label} · ${action.count}` : action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {notice ? (
        <View accessibilityLiveRegion="polite" style={styles.notice}>
          <Text style={styles.noticeText}>{notice.text}</Text>
          {notice.onUndo ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Undo the glass of water" onPress={notice.onUndo} style={styles.undo}>
              <Text style={styles.undoText}>Undo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tile: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: ink.border,
    borderRadius: radius.tile,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    height: 66,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 2
  },
  tilePressed: { backgroundColor: surface.canvas },
  label: { fontFamily: font.bodyMedium, fontSize: 11, color: ink.text },
  notice: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginTop: 4, minHeight: HIT },
  noticeText: { ...type.caption, fontSize: 12.5, color: ink.muted, flex: 1 },
  undo: { justifyContent: 'center', minHeight: HIT, paddingHorizontal: 4 },
  undoText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: ink.text, textDecorationLine: 'underline' }
});

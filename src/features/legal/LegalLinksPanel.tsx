import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Disclosure } from '../../components/mobile/Disclosure';
import { colors, spacing, type } from '../../styles/mobileTheme';
import { LEGAL_TITLES, legalUrl, type LegalDocument } from './legalLinks';

/**
 * The legal shelf in Settings.
 *
 * App stores require a reachable privacy policy, and a person who wants to know what an
 * app does with their body data should not have to hunt for it — so the same six pages
 * the website serves are listed here, in the order someone actually wants them.
 *
 * The emergency line at the bottom is not decoration. A wellness app that offers
 * guidance has an obligation to say plainly that it is not the thing to call in a
 * crisis, and the one place a person will look for that is Settings.
 */

const ORDER: LegalDocument[] = [
  'privacy',
  'terms',
  'cookies',
  'refunds',
  'accessibility',
  'attributions'
];

const SUBTITLES: Record<LegalDocument, string> = {
  privacy: 'What we hold, and how to delete it',
  terms: 'The agreement, and the health disclaimer',
  cookies: 'We use none — here is what is on your device',
  refunds: '14 days, no reasons needed',
  accessibility: 'What works, and what does not yet',
  attributions: 'The open data and software behind daywoven'
};

export function LegalLinks() {
  return (
    <Disclosure title="Legal and privacy" detail="Policies, your data, and accessibility">
      <View style={styles.list}>
        {ORDER.map((doc) => {
          const url = legalUrl(doc);
          if (!url) {
            return (
              <View key={doc} style={styles.row}>
                <Text style={styles.rowTitle}>{LEGAL_TITLES[doc]}</Text>
                <Text style={styles.rowDetail}>{SUBTITLES[doc]}</Text>
              </View>
            );
          }

          return (
            <Pressable
              accessibilityHint="Opens in your browser"
              accessibilityLabel={`${LEGAL_TITLES[doc]}. ${SUBTITLES[doc]}`}
              accessibilityRole="link"
              key={doc}
              onPress={() => void Linking.openURL(url)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              <Text style={styles.rowTitleLink}>{LEGAL_TITLES[doc]}</Text>
              <Text style={styles.rowDetail}>{SUBTITLES[doc]}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>daywoven is not medical advice</Text>
        <Text style={styles.noticeBody}>
          It does not diagnose or treat anything, and it is not a substitute for a doctor. In an
          emergency call 911. For crisis support in the US, call or text 988.
        </Text>
      </View>
    </Disclosure>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: {
    borderBottomColor: colors.hairlineSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 8
  },
  pressed: { opacity: 0.65 },
  rowTitle: { ...type.body, color: colors.text, fontWeight: '600' },
  rowTitleLink: { ...type.body, color: colors.accent, fontWeight: '600' },
  rowDetail: { ...type.caption, color: colors.textMuted },
  notice: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    gap: 4,
    marginTop: spacing.sm,
    padding: spacing.md
  },
  noticeTitle: { ...type.label, color: colors.text },
  noticeBody: { ...type.caption, color: colors.textMuted, lineHeight: 19 }
});

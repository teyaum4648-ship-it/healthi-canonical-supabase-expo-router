import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckBox } from '../../components/CheckBox';
import { accent } from '../../styles/daywoven1c';
import { colors, spacing, type, glassSurface, fonts } from '../../styles/mobileTheme';
import { type ConsentState } from './consentModel';
import { legalUrl, MINIMUM_AGE, type LegalDocument } from './legalLinks';
import { openLegalUrl } from './openLegalUrl';

/**
 * The consent block on the signup form.
 *
 * Two separate boxes rather than one, because the two things being agreed to are not
 * the same kind of thing. The first is a contract — the terms, the privacy policy and
 * the age limit. The second is permission to hold health information about a body,
 * which Washington's My Health My Data Act requires be asked for specifically and
 * unbundled, and which cannot be buried inside "I agree to the terms". The strictest
 * standard is applied to everyone because running two is how you eventually run none.
 *
 * Both start unticked and neither is pre-filled. Nothing here is a dark pattern: the
 * link text says where it goes, the button says what it does, and refusing simply
 * means no account rather than a nag.
 */

function InlineLink({ doc, children }: { doc: LegalDocument; children: string }) {
  const url = legalUrl(doc);

  /*
   * A native build with no EXPO_PUBLIC_SITE_URL has nowhere to send the person, so the
   * words stay and the link does not. A control that silently does nothing when pressed
   * is worse than plain text.
   */
  if (!url) return <Text style={styles.linkDead}>{children}</Text>;

  return (
    <Pressable
      accessibilityHint="Opens in your browser"
      accessibilityRole="link"
      hitSlop={6}
      onPress={() => void openLegalUrl(url)}
      style={styles.linkPress}
    >
      <Text style={styles.link}>{children}</Text>
    </Pressable>
  );
}

export function SignupConsent({
  value,
  onChange,
  showError = false
}: {
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  /** Set once the person has tried to submit without ticking both. */
  showError?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <CheckBox
        checked={value.agreement}
        label={`I’m ${MINIMUM_AGE} or older and agree to the Terms of Service and Privacy Policy.`}
        onChange={(agreement) => onChange({ ...value, agreement })}
      />
      <View style={styles.policyLinks}>
        <InlineLink doc="terms">Terms of Service</InlineLink>
        <InlineLink doc="privacy">Privacy Policy</InlineLink>
        <InlineLink doc="cookies">Cookies &amp; local storage</InlineLink>
      </View>

      <CheckBox
        checked={value.healthData}
        label="Daywoven can save my food, sleep, movement and mood entries to my account and use them for my scores and daily guidance."
        onChange={(healthData) => onChange({ ...value, healthData })}
      />

      <Text style={styles.footnote}>
        We do not sell your health information or use it for advertising. Service providers
        process some data to run daywoven, and an optional meal photo is sent for AI estimation
        only with your permission. Request a copy through our privacy contact or delete your
        account in Settings. Withdrawing health-data consent requires closing your account.
      </Text>

      {showError ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          <Text style={styles.errorText}>
            Select both boxes to create your account.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  policyLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: spacing.xs },
  link: {
    ...type.caption,
    color: colors.accent,
    fontFamily: fonts.bodySemibold,
    lineHeight: 19,
    textDecorationLine: 'underline'
  },
  /* Keeps the inline link on the text baseline instead of becoming its own block. */
  linkPress: { alignSelf: 'baseline' },
  linkDead: {
    ...type.caption,
    color: colors.text,
    fontFamily: fonts.bodySemibold,
    lineHeight: 19
  },
  footnote: {
    ...type.caption,
    color: colors.textFaint,
    lineHeight: 18,
    marginTop: 2
  },
  error: {
    ...glassSurface,
    /* Amber, as every other form problem: this is a step to finish, not an alarm. */
    borderColor: accent.amberDeep,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.sm
  },
  errorText: { ...type.caption, color: colors.text, lineHeight: 19 }
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckBox } from '../../components/CheckBox';
import { colors, spacing, type, glassSurface } from '../../styles/mobileTheme';
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
        label={`I am ${MINIMUM_AGE} or older, and I agree to the Terms of Service and the Privacy Policy`}
        onChange={(agreement) => onChange({ ...value, agreement })}
      >
        <Text style={styles.label}>
          I am {MINIMUM_AGE} or older, and I agree to the{' '}
          <InlineLink doc="terms">Terms of Service</InlineLink> and the{' '}
          <InlineLink doc="privacy">Privacy Policy</InlineLink>.
        </Text>
      </CheckBox>

      <CheckBox
        checked={value.healthData}
        hint="Required, because the app is built on this data. You can withdraw it later by deleting your account."
        label="I consent to daywoven collecting and storing my health information to produce my scores and guidance"
        onChange={(healthData) => onChange({ ...value, healthData })}
      >
        <Text style={styles.label}>
          I consent to daywoven collecting and storing my <Text style={styles.emphasis}>health
          information</Text> — what I eat, how I sleep, how I move and how I feel — in order to
          produce my scores and daily guidance.
        </Text>
      </CheckBox>

      <Text style={styles.footnote}>
        We do not sell your health information or use it for advertising. Service providers
        process some data to run daywoven, and an optional meal photo is sent for AI estimation
        only with your permission. Request a copy through our privacy contact or delete your
        account in Settings. Withdrawing health-data consent requires closing your account.
      </Text>

      {showError ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          <Text style={styles.errorText}>
            Please tick both boxes to continue. We cannot create an account without them.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    ...type.caption,
    color: colors.textMuted,
    lineHeight: 19
  },
  emphasis: { color: colors.text, fontWeight: '600' },
  link: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '600',
    lineHeight: 19,
    textDecorationLine: 'underline'
  },
  /* Keeps the inline link on the text baseline instead of becoming its own block. */
  linkPress: { alignSelf: 'baseline' },
  linkDead: {
    ...type.caption,
    color: colors.text,
    fontWeight: '600',
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
    borderColor: colors.danger,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.sm
  },
  errorText: { ...type.caption, color: colors.text, lineHeight: 19 }
});

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  MOBILITY_TESTS,
  POSTURE_PROMPTS,
  findMovementLinks,
  screenReferrals,
  type MobilityFinding,
  type MovementScreen,
  type PostureFlag
} from '../../engines/movement';
import { colors, radii, spacing, type } from '../../styles/mobileTheme';

/**
 * Doing the screen, and reading what it found.
 *
 * One question per card, answers in the person's words rather than as a grade, and
 * nothing required — a check somebody skips is left out of the reading instead of
 * counted against them, which is the same rule the engine follows and the reason the
 * flow has no forced order.
 *
 * The results deliberately lead with what the tightness is downstream of rather than
 * with the list of tight things, because the list is the part people already know.
 */
export function MobilityScreenFlow({
  initial,
  blockedPatterns = [],
  onSave,
  onClose
}: {
  initial?: MovementScreen | null;
  blockedPatterns?: string[];
  onSave: (screen: { findings: Partial<Record<string, MobilityFinding>>; postureFlags: PostureFlag[] }) => void;
  onClose: () => void;
}) {
  const [findings, setFindings] = useState<Partial<Record<string, MobilityFinding>>>(
    () => ({ ...(initial?.findings ?? {}) })
  );
  const [postureFlags, setPostureFlags] = useState<PostureFlag[]>(() => [...(initial?.postureFlags ?? [])]);
  const [showResults, setShowResults] = useState(false);

  const screen: MovementScreen = useMemo(
    () => ({ date: new Date().toISOString().slice(0, 10), findings, postureFlags, blockedPatterns }),
    [findings, postureFlags, blockedPatterns]
  );

  const answered = Object.values(findings).filter((finding) => finding && finding !== 'not_tested').length;
  const links = useMemo(() => findMovementLinks(screen), [screen]);
  const referrals = useMemo(() => screenReferrals(screen), [screen]);

  const togglePosture = (flag: PostureFlag) =>
    setPostureFlags((current) =>
      current.includes(flag) ? current.filter((value) => value !== flag) : [...current, flag]);

  if (showResults) {
    return (
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Header title="What the checks suggest" onClose={onClose} />

        {referrals.length > 0 ? (
          <View style={styles.referral}>
            <Ionicons accessible={false} color={colors.accentMid} name="alert-circle-outline" size={20} />
            <View style={styles.flex}>
              {referrals.map((referral) => (
                <Text key={referral} style={styles.referralText}>{referral}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {links.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nothing stood out</Text>
            <Text style={styles.cardBody}>
              {answered < 3
                ? 'Answer a few more checks and there will be something to read here.'
                : 'Your checks did not line up into anything worth changing your training over. Worth repeating in a month or two.'}
            </Text>
          </View>
        ) : (
          links.map((link) => (
            <View key={link.id} style={styles.card}>
              <Text style={styles.cardTitle}>{link.headline}</Text>
              <Text style={styles.cardBody}>{link.reasoning}</Text>

              {link.strengthen.length > 0 ? (
                <View style={styles.listBlock}>
                  <Text style={styles.listLabel}>Give these work</Text>
                  {link.strengthen.map((exercise) => (
                    <Text key={exercise} style={styles.listItem}>· {exercise}</Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.withheld}>
                  Exercise suggestions are on hold here because one of the movements involved is
                  currently flagged in your profile.
                </Text>
              )}

              {link.lengthen.length > 0 ? (
                <View style={styles.listBlock}>
                  <Text style={styles.listLabel}>And lengthen alongside</Text>
                  {link.lengthen.map((stretch) => (
                    <Text key={stretch} style={styles.listItem}>· {stretch}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}

        <Text style={styles.footnote}>
          This is a screen, not an examination. It suggests where to look; it does not tell you what
          is wrong, and anything painful is worth taking to a qualified professional.
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowResults(false)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Back to the checks</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSave({ findings, postureFlags })}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Save this check</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Header title="How are you moving?" onClose={onClose} />
      <Text style={styles.intro}>
        Seven checks, no equipment. Skip any you cannot do safely — a skipped check is left out
        rather than counted against you.
      </Text>

      {MOBILITY_TESTS.map((test) => (
        <View key={test.id} style={styles.card}>
          <Text style={styles.cardTitle}>{test.name}</Text>
          <Text style={styles.cardBody}>{test.how}</Text>
          <View style={styles.options}>
            {test.options.map((option) => {
              const selected = findings[test.id] === option.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => setFindings((current) => ({
                    ...current,
                    [test.id]: selected ? 'not_tested' : option.value
                  }))}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How you stand</Text>
        <Text style={styles.cardBody}>
          Tick anything that sounds like you. A mirror or a photo from the side helps; guessing is
          fine too, and you can change it later.
        </Text>
        <View style={styles.options}>
          {(Object.keys(POSTURE_PROMPTS) as PostureFlag[]).map((flag) => {
            const selected = postureFlags.includes(flag);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={flag}
                onPress={() => togglePosture(flag)}
                style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {POSTURE_PROMPTS[flag]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: answered === 0 }}
        disabled={answered === 0}
        onPress={() => setShowResults(true)}
        style={({ pressed }) => [
          styles.primaryButton,
          answered === 0 && styles.buttonDisabled,
          pressed && styles.pressed
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {answered === 0 ? 'Answer a check to continue' : `See what ${answered} ${answered === 1 ? 'check' : 'checks'} suggest`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Close the movement check"
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Ionicons color={colors.accentMid} name="chevron-back" size={22} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  title: { ...type.title, color: colors.text, flex: 1 },
  intro: { ...type.body, color: colors.textMuted },
  flex: { flex: 1, gap: spacing.xs, minWidth: 0 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  cardTitle: { ...type.heading, color: colors.text },
  cardBody: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  options: { gap: spacing.xs, marginTop: spacing.xs },
  option: {
    backgroundColor: colors.surfaceInset,
    borderColor: 'transparent',
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionSelected: { backgroundColor: colors.accentWash, borderColor: colors.accentMid },
  optionText: { ...type.body, color: colors.textMuted },
  optionTextSelected: { color: colors.text, fontWeight: '600' },
  listBlock: { gap: 4, marginTop: spacing.xs },
  listLabel: { ...type.eyebrow, color: colors.textFaint },
  listItem: { ...type.body, color: colors.text },
  withheld: { ...type.caption, color: colors.textMuted, fontStyle: 'italic', lineHeight: 20 },
  referral: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceInset,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md
  },
  referralText: { ...type.body, color: colors.text, lineHeight: 22 },
  footnote: { ...type.caption, color: colors.textFaint, lineHeight: 20 },
  actions: { gap: spacing.sm },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 52
  },
  primaryButtonText: { ...type.body, color: colors.primaryText, fontWeight: '600' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52
  },
  secondaryButtonText: { ...type.body, color: colors.text },
  buttonDisabled: { backgroundColor: colors.surfaceMuted },
  pressed: { opacity: 0.65 }
});

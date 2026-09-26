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
import type { MovementCardPalette } from './MovementPillarCard';
import { cardSurface } from '../../styles/mobileTheme';

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
  palette,
  onSave,
  onClose
}: {
  initial?: MovementScreen | null;
  blockedPatterns?: string[];
  /** The host tab's colours, so the flow does not read as a different app. */
  palette: MovementCardPalette;
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
        <Header palette={palette} title="What the checks suggest" onClose={onClose} />

        {referrals.length > 0 ? (
          <View style={[styles.referral, { backgroundColor: palette.wash }]}>
            <Ionicons accessible={false} color={palette.accent} name="alert-circle-outline" size={20} />
            <View style={styles.flex}>
              {referrals.map((referral) => (
                <Text key={referral} style={[styles.referralText, { color: palette.ink }]}>{referral}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {links.length === 0 ? (
          <View style={[styles.card, { ...cardSurface, borderColor: palette.line }]}>
            <Text style={[styles.cardTitle, { color: palette.ink }]}>Nothing stood out</Text>
            <Text style={[styles.cardBody, { color: palette.muted }]}>
              {answered < 3
                ? 'Answer a few more checks and there will be something to read here.'
                : 'Your checks did not line up into anything worth changing your training over. Worth repeating in a month or two.'}
            </Text>
          </View>
        ) : (
          links.map((link) => (
            <View key={link.id} style={[styles.card, { ...cardSurface, borderColor: palette.line }]}>
              <Text style={[styles.cardTitle, { color: palette.ink }]}>{link.headline}</Text>
              <Text style={[styles.cardBody, { color: palette.muted }]}>{link.reasoning}</Text>

              {link.strengthen.length > 0 ? (
                <View style={styles.listBlock}>
                  <Text style={[styles.listLabel, { color: palette.muted }]}>Give these work</Text>
                  {link.strengthen.map((exercise) => (
                    <Text key={exercise} style={[styles.listItem, { color: palette.ink }]}>· {exercise}</Text>
                  ))}
                </View>
              ) : (
                <Text style={[styles.withheld, { color: palette.muted }]}>
                  Exercise suggestions are on hold here because one of the movements involved is
                  currently flagged in your profile.
                </Text>
              )}

              {link.lengthen.length > 0 ? (
                <View style={styles.listBlock}>
                  <Text style={[styles.listLabel, { color: palette.muted }]}>And lengthen alongside</Text>
                  {link.lengthen.map((stretch) => (
                    <Text key={stretch} style={[styles.listItem, { color: palette.ink }]}>· {stretch}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}

        <Text style={[styles.footnote, { color: palette.muted }]}>
          This is a screen, not an examination. It suggests where to look; it does not tell you what
          is wrong, and anything painful is worth taking to a qualified professional.
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowResults(false)}
            style={({ pressed }) => [styles.secondaryButton, { borderColor: palette.line }, pressed && styles.pressed]}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.ink }]}>Back to the checks</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSave({ findings, postureFlags })}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent }, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Save this check</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Header palette={palette} title="How are you moving?" onClose={onClose} />
      <Text style={[styles.intro, { color: palette.muted }]}>
        Seven checks, no equipment. Skip any you cannot do safely — a skipped check is left out
        rather than counted against you.
      </Text>

      {MOBILITY_TESTS.map((test) => (
        <View key={test.id} style={[styles.card, { ...cardSurface, borderColor: palette.line }]}>
          <Text style={[styles.cardTitle, { color: palette.ink }]}>{test.name}</Text>
          <Text style={[styles.cardBody, { color: palette.muted }]}>{test.how}</Text>
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
                  style={({ pressed }) => [styles.option, { backgroundColor: palette.wash, borderColor: 'transparent' }, selected && { borderColor: palette.accent }, pressed && styles.pressed]}
                >
                  <Text style={[styles.optionText, { color: palette.muted }, selected && { color: palette.ink, fontWeight: '600' }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View style={[styles.card, { ...cardSurface, borderColor: palette.line }]}>
        <Text style={[styles.cardTitle, { color: palette.ink }]}>How you stand</Text>
        <Text style={[styles.cardBody, { color: palette.muted }]}>
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
                style={({ pressed }) => [styles.option, { backgroundColor: palette.wash, borderColor: 'transparent' }, selected && { borderColor: palette.accent }, pressed && styles.pressed]}
              >
                <Text style={[styles.optionText, { color: palette.muted }, selected && { color: palette.ink, fontWeight: '600' }]}>
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
          styles.primaryButton, { backgroundColor: palette.accent },
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

function Header({ title, onClose, palette }: { title: string; onClose: () => void; palette: MovementCardPalette }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Close the movement check"
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Ionicons color={palette.accent} name="chevron-back" size={22} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14, paddingBottom: 96 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  title: { flex: 1, fontSize: 26, fontWeight: '600', lineHeight: 32 },
  intro: { fontSize: 15, lineHeight: 22 },
  flex: { flex: 1, gap: 6, minWidth: 0 },
  card: { borderRadius: 16, borderWidth: 1, gap: 10, paddingHorizontal: 18, paddingVertical: 16 },
  cardTitle: { fontSize: 19, fontWeight: '600', lineHeight: 25 },
  cardBody: { fontSize: 15, lineHeight: 22 },
  options: { gap: 6, marginTop: 6 },
  option: { borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  optionText: { fontSize: 15, lineHeight: 21 },
  listBlock: { gap: 4, marginTop: 6 },
  listLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  listItem: { fontSize: 15, lineHeight: 22 },
  withheld: { fontSize: 13, fontStyle: 'italic', lineHeight: 20 },
  referral: { alignItems: 'flex-start', borderRadius: 14, flexDirection: 'row', gap: 10, padding: 14 },
  referralText: { fontSize: 15, lineHeight: 22 },
  footnote: { fontSize: 13, lineHeight: 20 },
  actions: { gap: 10 },
  primaryButton: { alignItems: 'center', borderRadius: 14, justifyContent: 'center', minHeight: 52, paddingHorizontal: 14 },
  primaryButtonText: { color: '#0B0B0C', fontSize: 16, fontWeight: '600' },
  secondaryButton: { alignItems: 'center', borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 14 },
  secondaryButtonText: { fontSize: 16, textAlign: 'center' },
  buttonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.65 }
});

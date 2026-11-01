import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Disclosure } from '../../components/mobile/Disclosure';
import { supabase } from '../../lib/supabase';
import { colors, spacing, type } from '../../styles/mobileTheme';
import { requestAccountDeletion, requestAccountExport, type AccountFunctionsClient } from './accountData';
import { readAiPhotoConsent, setAiPhotoConsent, type ConsentWriter } from './aiPhotoConsentStore';
import { clearDeviceDataFor, deliverExport } from './deliverExport';

/**
 * Everything a person can do about their data, in one place they can find: get a copy,
 * control the one feature that sends anything to an outside service, and delete the
 * account. App Store 5.1.1(v) requires the deletion be in the app, not behind an email,
 * and the CCPA and California's medical-information law give the export and deletion
 * rights. Deletion asks once more before it happens, and says exactly what it removes.
 */
export function YourDataPanel({ userId, initiallyOpen = false }: { userId: string; initiallyOpen?: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const [aiAllowed, setAiAllowed] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteNote, setDeleteNote] = useState('');

  useEffect(() => {
    let active = true;
    void readAiPhotoConsent(userId).then((consent) => { if (active) setAiAllowed(consent.granted); });
    return () => { active = false; };
  }, [userId]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportNote('');
    const result = await requestAccountExport(supabase as unknown as AccountFunctionsClient);
    if (!result.ok) {
      setExportNote(result.detail);
    } else {
      try {
        await deliverExport(result.value, userId);
        setExportNote('Your export is ready. It includes everything daywoven holds about you.');
      } catch {
        setExportNote('Your export was prepared but could not be shared. Please try again.');
      }
    }
    setExporting(false);
  }, [userId]);

  const handleAiToggle = useCallback(async () => {
    setAiBusy(true);
    setAiNote('');
    const next = !aiAllowed;
    const saved = await setAiPhotoConsent(userId, next, supabase as unknown as ConsentWriter);
    if (saved) setAiAllowed(next);
    else setAiNote('That change could not be saved. Check your connection and try again.');
    setAiBusy(false);
  }, [aiAllowed, userId]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setDeleteNote('');
    const result = await requestAccountDeletion(supabase as unknown as AccountFunctionsClient);
    if (!result.ok) {
      setDeleteNote(result.detail);
      setDeleting(false);
      return;
    }
    await clearDeviceDataFor(userId);
    // The account no longer exists on the server, so only the local session is cleared.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }, [userId]);

  return (
    <Disclosure initiallyOpen={initiallyOpen} title="Your data and account" detail="Export a copy, AI photo permission, delete your account">
      <View style={styles.block}>
        <Text style={styles.heading}>Get a copy of your data</Text>
        <Text style={styles.body}>
          Everything daywoven holds about you — profile, consents, sleep, food, movement, check-ins
          and scores — as one file you can keep.
        </Text>
        <Button label="Export my data" isLoading={exporting} onPress={() => void handleExport()} variant="secondary" />
        {exportNote ? <Text accessibilityLiveRegion="polite" style={styles.note}>{exportNote}</Text> : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.heading}>Meal photo estimates</Text>
        <Text style={styles.body}>
          {aiAllowed
            ? 'On. When you choose to estimate a meal from a photo, that photo is sent to Anthropic, an AI service, to identify the foods. Nothing else about you is sent.'
            : 'Off. No photo is ever sent. daywoven will ask before the first photo estimate.'}
        </Text>
        <Button
          label={aiAllowed ? 'Turn off photo estimates' : 'Allow photo estimates'}
          isLoading={aiBusy}
          onPress={() => void handleAiToggle()}
          variant="secondary"
        />
        {aiNote ? <Text accessibilityRole="alert" style={styles.note}>{aiNote}</Text> : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.heading}>Delete your account</Text>
        {confirmDelete ? (
          <>
            <Text style={styles.body}>
              This permanently deletes your account and everything in it: your profile, consents,
              sleep, food, movement, check-ins, scores and saved meals, from our servers and from
              this device. It cannot be undone. Anything Apple Health holds stays in Apple Health.
              If you pay for a subscription, cancel it in your App Store settings as well.
            </Text>
            <Button label="Delete my account permanently" isLoading={deleting} onPress={() => void handleDelete()} variant="danger" />
            <Button label="Keep my account" disabled={deleting} onPress={() => { setConfirmDelete(false); setDeleteNote(''); }} variant="secondary" />
          </>
        ) : (
          <>
            <Text style={styles.body}>Removes your account and all of its data. You will be asked to confirm.</Text>
            <Button label="Delete account" onPress={() => setConfirmDelete(true)} variant="danger" />
          </>
        )}
        {deleteNote ? <Text accessibilityRole="alert" style={styles.note}>{deleteNote}</Text> : null}
      </View>
    </Disclosure>
  );
}

const styles = StyleSheet.create({
  block: {
    borderBottomColor: colors.hairlineSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingBottom: spacing.md
  },
  heading: { ...type.body, color: colors.text, fontWeight: '600' },
  body: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  note: { ...type.caption, color: colors.text, lineHeight: 19 }
});

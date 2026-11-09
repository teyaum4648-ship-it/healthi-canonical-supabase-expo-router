import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { CheckBox } from '../../../components/CheckBox';
import { ActionRow } from '../../../components/mobile/ActionRow';
import { EntrySheet } from '../../../components/mobile/EntrySheet';
import { colors, type } from '../../../styles/mobileTheme';
import { tabAccent } from '../../../styles/pillarColors';
import type { PhotoCaptureSource } from './photoCapture';

export function PhotoEntrySheet({ available, busy, notice, onCapture, onClose, onSearch }: {
  available: boolean;
  busy: boolean;
  notice: string;
  onCapture: (source: PhotoCaptureSource) => void;
  onClose: () => void;
  onSearch: () => void;
}) {
  // A fresh sheet asks again; device camera/library permission does not authorize an AI upload.
  const [consented, setConsented] = useState(false);
  const captureAllowed = available && !busy && consented;

  function capture(source: PhotoCaptureSource) {
    // Also guard the callback itself rather than relying only on a disabled control.
    if (captureAllowed) onCapture(source);
  }

  return <EntrySheet title="Photo meal" onClose={onClose} busy={busy}>
    <Text style={styles.detail}>{available
      ? 'Take a photo or choose one from your library. Review estimated foods and portions before adding them to your meal.'
      : 'Photo estimates are not enabled in this demo. You can still search foods or scan a barcode to build your meal. No photo will be uploaded.'}</Text>
    {available ? <>
      <Text style={styles.detail}>daywoven sends the meal photo you choose through its server to Anthropic’s AI service to identify foods and estimate portions. daywoven does not store the photo. Review the estimate before saving; it may be wrong. You can use food search instead without sharing a photo.</Text>
      <CheckBox
        checked={consented}
        disabled={busy}
        label="I agree to send this meal photo to Anthropic for an AI estimate."
        onChange={setConsented}
      />
    </> : null}
    {(['camera', 'library'] as const).map(source => <Pressable
      key={source}
      accessibilityRole="button"
      accessibilityState={{ disabled: !captureAllowed }}
      disabled={!captureAllowed}
      onPress={() => capture(source)}
      style={({ pressed }) => [styles.action, (!captureAllowed || pressed) && styles.dim]}>
      <Ionicons name={source === 'camera' ? 'camera-outline' : 'images-outline'} size={24} color={tabAccent.food} />
      <Text style={styles.title}>{source === 'camera' ? 'Take a photo' : 'Choose a photo'}</Text>
    </Pressable>)}
    {busy ? <><ActivityIndicator color={tabAccent.food} /><Text accessibilityLiveRegion="polite" style={styles.detail}>Preparing your photo estimate…</Text></> : null}
    {notice ? <Text accessibilityRole="alert" style={styles.detail}>{notice}</Text> : null}
    {!busy ? <ActionRow title="Search foods instead" icon="search-outline" onPress={onSearch} last /> : null}
  </EntrySheet>;
}

const styles = StyleSheet.create({
  detail: { ...type.body, color: colors.textMuted },
  title: { ...type.body, color: colors.text, fontWeight: '600' },
  action: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.surfaceInset },
  dim: { opacity: 0.5 }
});

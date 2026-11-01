import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { ActionRow } from '../../../components/mobile/ActionRow';
import { EntrySheet } from '../../../components/mobile/EntrySheet';
import { colors, type } from '../../../styles/mobileTheme';
import { tabAccent } from '../../../styles/pillarColors';
import { AI_PHOTO_DISCLOSURE } from '../../account/aiPhotoConsentModel';
import type { PhotoCaptureSource } from './photoCapture';

/**
 * Before the first photo, the sheet asks rather than shows the camera: the photo goes to
 * an outside AI service, and that needs a plain yes first (App Store 5.1.2(i)). Declining
 * leaves search and barcode scanning exactly as they were.
 */
function ConsentStep({ busy, onAllow, onSearch }: { busy: boolean; onAllow: () => void; onSearch: () => void }) {
  return <View style={styles.consent}>
    <Text accessibilityRole="header" style={styles.title}>{AI_PHOTO_DISCLOSURE.title}</Text>
    <Text style={styles.detail}>{AI_PHOTO_DISCLOSURE.body}</Text>
    <Text style={styles.footnote}>{AI_PHOTO_DISCLOSURE.footnote}</Text>
    <Button label="Allow and continue" isLoading={busy} onPress={onAllow} />
    <Button label="Not now — search foods instead" variant="secondary" disabled={busy} onPress={onSearch} />
  </View>;
}

export function PhotoEntrySheet({ available, busy, notice, needsConsent = false, onAllow, onCapture, onClose, onSearch }: {
  available: boolean;
  busy: boolean;
  notice: string;
  /** True until the person has agreed to photos going to the AI service. */
  needsConsent?: boolean;
  onAllow?: () => void;
  onCapture: (source: PhotoCaptureSource) => void;
  onClose: () => void;
  onSearch: () => void;
}) {
  if (available && needsConsent && onAllow) {
    return <EntrySheet title="Photo meal" onClose={onClose} busy={busy}>
      <ConsentStep busy={busy} onAllow={onAllow} onSearch={onSearch} />
      {notice ? <Text accessibilityRole="alert" style={styles.detail}>{notice}</Text> : null}
    </EntrySheet>;
  }
  return <EntrySheet title="Photo meal" onClose={onClose} busy={busy}>
    <Text style={styles.detail}>{available
      ? 'Take a photo or choose one from your library. The photo is sent to an AI service to estimate the foods; review the foods and portions before adding them to your meal.'
      : 'Photo estimates are not enabled in this demo. You can still search foods or scan a barcode to build your meal. No photo will be uploaded.'}</Text>
    {(['camera', 'library'] as const).map(source => <Pressable
      key={source}
      accessibilityRole="button"
      accessibilityState={{ disabled: !available || busy }}
      disabled={!available || busy}
      onPress={() => onCapture(source)}
      style={({ pressed }) => [styles.action, (!available || busy || pressed) && styles.dim]}>
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
  footnote: { ...type.caption, color: colors.textFaint, lineHeight: 18 },
  consent: { gap: 12 },
  title: { ...type.body, color: colors.text, fontWeight: '600' },
  action: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.surfaceInset },
  dim: { opacity: 0.5 }
});

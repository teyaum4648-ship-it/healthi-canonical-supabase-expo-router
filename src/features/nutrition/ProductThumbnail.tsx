import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { safeProductImageUrl } from './productLookup/productImage';
import { type } from '../../styles/mobileTheme';

export function ProductThumbnail({ url, name, size = 52, onPress }: { url?: string | null; name: string; size?: number; onPress?: () => void }) {
  const uri = safeProductImageUrl(url);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const visible = uri && failedUrl !== uri;
  return <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? `Choose ${name}` : undefined} style={[styles.frame, { width: size, height: size }]}>
    {visible ? <Image source={{ uri }} accessibilityLabel={`Product photo: ${name}`} resizeMode="contain" onError={() => setFailedUrl(uri)} style={styles.image} />
      : <Text accessibilityLabel={`No product photo available for ${name}`} style={styles.fallback}>No photo</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  frame: { flexShrink: 0, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 4 },
  image: { width: '100%', height: '100%' },
  fallback: { ...type.caption, fontSize: 12, lineHeight: 15, color: '#59616B', textAlign: 'center' }
});

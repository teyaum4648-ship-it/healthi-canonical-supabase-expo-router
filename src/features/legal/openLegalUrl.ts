import { Alert, Linking } from 'react-native';

export async function openLegalUrl(url: string): Promise<void> {
  try { await Linking.openURL(url); }
  catch { Alert.alert('Could not open the policy', 'Please check your connection and try again.'); }
}

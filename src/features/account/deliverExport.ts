import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';

import { exportFileName, localKeysFor, withDeviceData } from './accountData';

/**
 * Gets an export into the person's hands: a downloaded file on the web, the share sheet
 * on a phone (where "Save to Files", Mail and AirDrop all live). Also adds what is kept
 * only on this device, so the copy is complete.
 */
export async function deliverExport(exported: Record<string, unknown>, userId: string): Promise<void> {
  let complete = exported;
  try {
    const keys = localKeysFor(await AsyncStorage.getAllKeys(), userId);
    complete = withDeviceData(exported, await AsyncStorage.multiGet(keys));
  } catch {
    // The server copy is the substance; a device read failing should not withhold it.
  }
  const json = JSON.stringify(complete, null, 2);
  const filename = exportFileName(new Date());

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: filename, message: json });
}

/** Removes this account's entries from the device after it has been deleted. */
export async function clearDeviceDataFor(userId: string): Promise<void> {
  try {
    const keys = localKeysFor(await AsyncStorage.getAllKeys(), userId);
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // The account and its server data are already gone; leftovers here are only on this phone.
  }
}

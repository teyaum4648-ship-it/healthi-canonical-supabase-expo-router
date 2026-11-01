import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  aiPhotoConsentRow,
  parseAiPhotoConsent,
  AI_PHOTO_CONSENT_VERSION,
  type AiPhotoConsent
} from './aiPhotoConsentModel';

/**
 * Where the AI photo permission lives: on the device for a quick answer, and in
 * `user_consents` as the record the server checks before it sends any photo on.
 */

const STORAGE_KEY = 'healthi:consent:aiPhoto:v1';

const isUuid = (value: string | null | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

export type ConsentWriter = {
  from(table: 'user_consents'): { insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }> };
};

function keyFor(userId: string | null | undefined): string {
  return `${STORAGE_KEY}:${isUuid(userId) ? userId : 'demo'}`;
}

export async function readAiPhotoConsent(userId: string | null | undefined): Promise<AiPhotoConsent> {
  try {
    return parseAiPhotoConsent(await AsyncStorage.getItem(keyFor(userId)));
  } catch {
    return parseAiPhotoConsent(null);
  }
}

/**
 * Records the answer. The server record is written first: if it cannot be saved the
 * device copy is left alone and the caller is told, because the server refuses photos
 * without it and a "yes" that only exists on the phone would fail on the next upload.
 */
export async function setAiPhotoConsent(
  userId: string | null | undefined,
  granted: boolean,
  client: ConsentWriter | null
): Promise<boolean> {
  const at = new Date().toISOString();
  if (client && isUuid(userId)) {
    try {
      const { error } = await client.from('user_consents').insert(aiPhotoConsentRow(userId, granted, at));
      if (error) return false;
    } catch {
      return false;
    }
  }
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify({ granted, version: AI_PHOTO_CONSENT_VERSION, at }));
  } catch {
    // The server record is the one that governs; a failed device write only means asking again.
  }
  return true;
}

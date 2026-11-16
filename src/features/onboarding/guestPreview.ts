import AsyncStorage from '@react-native-async-storage/async-storage';

import type { OnboardingAnswers } from '../../types/onboarding';

/**
 * Where a signed-out questionnaire lives until the person creates an account and agrees to
 * save it. It never leaves the device before then. Shared by onboarding (which writes it)
 * and account creation (which reads it to show what is being saved).
 */
export const GUEST_ONBOARDING_DRAFT_KEY = 'daywoven:onboarding:guest-preview';

/** The first name typed on account creation, kept on this device so leaving the screen does not lose it. */
export const SIGNUP_FIRST_NAME_KEY = 'daywoven:signup:first-name';

export type GuestPreview = { answers: OnboardingAnswers; previewComplete: boolean };

export async function loadGuestPreview(): Promise<GuestPreview | null> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { answers?: OnboardingAnswers; previewComplete?: boolean };
    return { answers: parsed.answers ?? {}, previewComplete: Boolean(parsed.previewComplete) };
  } catch {
    return null;
  }
}

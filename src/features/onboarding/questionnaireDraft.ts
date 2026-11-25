import type { OnboardingAnswers } from '../../types/onboarding';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

/** Finishing setup is separate from answering the optional questionnaire or paying. */
export function hasFinishedSetup(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'skipped';
}

export type QuestionnaireDraft = {
  answers: OnboardingAnswers;
  currentIndex: number;
  previewComplete?: boolean;
  deferred?: boolean;
};

export const guestQuestionnaireKey = 'daywoven:onboarding:guest-preview';
export function questionnaireKey(userId?: string): string {
  return userId ? `healthi:onboarding:${userId}` : guestQuestionnaireKey;
}

export function readQuestionnaireDraft(raw: string, stepCount: number): QuestionnaireDraft {
  const parsed = JSON.parse(raw) as Partial<QuestionnaireDraft> | null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid questionnaire draft.');
  return {
    answers: parsed.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers) ? parsed.answers : {},
    currentIndex: Number.isInteger(parsed.currentIndex)
      ? Math.max(0, Math.min(parsed.currentIndex!, stepCount - 1)) : 0,
    previewComplete: parsed.previewComplete === true && parsed.deferred !== true,
    deferred: parsed.deferred === true
  };
}

type Storage = {
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Keep answers local; do not generate or upload a baseline from incomplete answers. */
export async function saveQuestionnaireForLater(input: {
  storage: Storage;
  draft: QuestionnaireDraft;
  userId?: string;
  status?: OnboardingStatus;
  localDemo?: boolean;
  consumeGuestDraft?: boolean;
  saveSkippedStatus: () => Promise<void>;
}): Promise<void> {
  await input.storage.setItem(questionnaireKey(input.userId), JSON.stringify({
    answers: input.draft.answers,
    currentIndex: input.draft.currentIndex,
    deferred: !input.userId
  }));
  if (!input.userId) return;
  // Revisiting an already completed questionnaire must not erase its saved baseline.
  if (input.status !== 'completed') {
    if (input.localDemo) await input.storage.setItem('healthi:demo:onboardingCompleted', 'skipped');
    else await input.saveSkippedStatus();
  }
  // Consume the anonymous handoff only after the user's own draft and status are safe.
  if (!input.localDemo && input.consumeGuestDraft) await input.storage.removeItem(guestQuestionnaireKey);
}

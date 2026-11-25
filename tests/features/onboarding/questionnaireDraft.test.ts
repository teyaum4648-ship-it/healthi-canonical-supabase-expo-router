import { describe, expect, it, vi } from 'vitest';
import { guestQuestionnaireKey, hasFinishedSetup, questionnaireKey, readQuestionnaireDraft, saveQuestionnaireForLater } from '../../../src/features/onboarding/questionnaireDraft';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, setItem: vi.fn(async (key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { data.delete(key); }) };
}
const partial = { answers: { bedtime: '10:30pm', primary_goal: 'sleep_better' }, currentIndex: 1 };

describe('optional questionnaire drafts', () => {
  it.each([{ answers: {}, currentIndex: 0 }, partial])('keeps a guest skip choice across signup without sending answers', async draft => {
    const storage = memoryStorage();
    const saveSkippedStatus = vi.fn();
    await saveQuestionnaireForLater({ storage, draft, saveSkippedStatus });
    const restored = readQuestionnaireDraft(storage.data.get(guestQuestionnaireKey)!, 3);
    expect(restored).toEqual({ ...draft, deferred: true, previewComplete: false });
    expect(saveSkippedStatus).not.toHaveBeenCalled();
  });
  it('saves a private resume point before changing only the authenticated setup status', async () => {
    const storage = memoryStorage({ [guestQuestionnaireKey]: JSON.stringify(partial), [questionnaireKey('other-account')]: 'keep' });
    const saveSkippedStatus = vi.fn(async () => {
      expect(readQuestionnaireDraft(storage.data.get(questionnaireKey('account'))!, 3)).toMatchObject(partial);
    });
    await saveQuestionnaireForLater({ storage, draft: partial, userId: 'account', status: 'in_progress', consumeGuestDraft: true, saveSkippedStatus });
    expect(saveSkippedStatus).toHaveBeenCalledOnce();
    expect(storage.data.has(guestQuestionnaireKey)).toBe(false);
    expect(storage.data.get(questionnaireKey('other-account'))).toBe('keep');
    expect(readQuestionnaireDraft(storage.data.get(questionnaireKey('account'))!, 3)).toMatchObject({ ...partial, deferred: false });
  });
  it('does not claim a skip succeeded when the account update fails, and retains both drafts', async () => {
    const storage = memoryStorage({ [guestQuestionnaireKey]: JSON.stringify(partial) });
    await expect(saveQuestionnaireForLater({ storage, draft: partial, userId: 'account',
      saveSkippedStatus: async () => { throw new Error('offline'); } })).rejects.toThrow('offline');
    expect(storage.data.has(guestQuestionnaireKey)).toBe(true);
    expect(readQuestionnaireDraft(storage.data.get(questionnaireKey('account'))!, 3)).toMatchObject(partial);
  });
  it('preserves an unrelated guest draft when skipping an existing account questionnaire', async () => {
    const storage = memoryStorage({ [guestQuestionnaireKey]: 'unrelated guest draft' });
    await saveQuestionnaireForLater({ storage, draft: partial, userId: 'account', saveSkippedStatus: async () => undefined });
    expect(storage.data.get(guestQuestionnaireKey)).toBe('unrelated guest draft');
  });
  it('does not update the profile if local progress cannot be preserved', async () => {
    const storage = memoryStorage();
    storage.setItem.mockRejectedValue(new Error('disk full'));
    const saveSkippedStatus = vi.fn();
    await expect(saveQuestionnaireForLater({ storage, draft: partial, userId: 'account', saveSkippedStatus })).rejects.toThrow('disk full');
    expect(saveSkippedStatus).not.toHaveBeenCalled();
  });
  it('never overwrites a completed baseline when leaving a later edit unfinished', async () => {
    const saveSkippedStatus = vi.fn();
    await saveQuestionnaireForLater({ storage: memoryStorage(), draft: partial, userId: 'account', status: 'completed', saveSkippedStatus });
    expect(saveSkippedStatus).not.toHaveBeenCalled();
  });
  it('keeps demo skipping local and does not remove an anonymous account preview', async () => {
    const storage = memoryStorage({ [guestQuestionnaireKey]: 'keep guest answers' });
    const saveSkippedStatus = vi.fn();
    await saveQuestionnaireForLater({ storage, draft: partial, userId: 'demo-user', localDemo: true, saveSkippedStatus });
    expect(storage.data.get('healthi:demo:onboardingCompleted')).toBe('skipped');
    expect(storage.data.get(guestQuestionnaireKey)).toBe('keep guest answers');
    expect(saveSkippedStatus).not.toHaveBeenCalled();
  });
  it('does not convert deferred or malformed drafts into completed previews', () => {
    expect(readQuestionnaireDraft(JSON.stringify({ ...partial, previewComplete: true, deferred: true }), 3).previewComplete).toBe(false);
    expect(readQuestionnaireDraft(JSON.stringify({ answers: null, currentIndex: 999 }), 3)).toMatchObject({ answers: {}, currentIndex: 2, previewComplete: false });
    expect(readQuestionnaireDraft('{"currentIndex":-10}', 3).currentIndex).toBe(0);
    for (const raw of ['null', '[]', 'broken']) expect(() => readQuestionnaireDraft(raw, 3)).toThrow();
  });
  it('treats only an explicit completion or skip as finished setup', () => {
    expect(hasFinishedSetup('skipped')).toBe(true);
    expect(hasFinishedSetup('completed')).toBe(true);
    for (const status of ['in_progress', 'not_started', '', 'true', null, undefined]) expect(hasFinishedSetup(status)).toBe(false);
  });
});

import { defaultReadinessReminders, isReadinessCheckin, isReminderPreferences, type ReadinessCheckin, type ReadinessReminderPreferences } from './readinessNow';

export const readinessNowDemoKey = 'healthi:demo:readiness-now:v1';
export type ReadinessNowDemoData = { version: 1; owner: 'demo-user'; checkins: ReadinessCheckin[]; reminders: ReadinessReminderPreferences };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export function createReadinessNowDemoStore(storage: Storage) {
  let queue: Promise<unknown> = Promise.resolve();
  async function read(): Promise<ReadinessNowDemoData> {
    const raw = await storage.getItem(readinessNowDemoKey);
    if (raw === null) return { version: 1, owner: 'demo-user', checkins: [], reminders: { ...defaultReadinessReminders } };
    const v = JSON.parse(raw) as ReadinessNowDemoData | null;
    if (!v || v.version !== 1 || v.owner !== 'demo-user' || !Array.isArray(v.checkins) || !v.checkins.every(isReadinessCheckin) || !isReminderPreferences(v.reminders)) throw new Error('Saved check-ins could not be read. Your saved data has not been changed.');
    return v;
  }
  function update(change: (data: ReadinessNowDemoData) => ReadinessNowDemoData) {
    const operation = queue.then(async () => { const next = change(await read()); await storage.setItem(readinessNowDemoKey, JSON.stringify(next)); return next; });
    queue = operation.catch(() => undefined);
    return operation;
  }
  return {
    read,
    saveCheckin(checkin: ReadinessCheckin) {
      if (!isReadinessCheckin(checkin)) return Promise.reject(new Error('Check your wake time and answers.'));
      return update(data => ({ ...data, checkins: [...data.checkins.filter(c => c.id !== checkin.id), checkin] }));
    },
    saveReminders(reminders: ReadinessReminderPreferences) {
      if (!isReminderPreferences(reminders)) return Promise.reject(new Error('Check your reminder time.'));
      return update(data => ({ ...data, reminders }));
    }
  };
}

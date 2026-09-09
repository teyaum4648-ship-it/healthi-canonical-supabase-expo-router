import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SleepSession } from '../../../src/engines/circadian';
import type { SleepRhythmSupabaseClient } from '../../../src/features/sleepRhythm/persistence';
import { loadSleepHistory, saveSleepForSource } from '../../../src/features/sleepRhythm/sleepSessionSource';

const mocks = vi.hoisted(() => ({
  readLocal: vi.fn(), writeLocal: vi.fn(), readRemote: vi.fn(), readNeed: vi.fn(), writeRemote: vi.fn()
}));
vi.mock('../../../src/features/sleepRhythm/localSleepWindowStore', () => ({
  getLocalSleepWindowSessions: mocks.readLocal,
  saveLocalSleepWindowSession: mocks.writeLocal
}));
vi.mock('../../../src/features/sleepRhythm/persistence', () => ({
  getRecentSleepSessions: mocks.readRemote,
  getActiveSleepNeedEstimate: mocks.readNeed,
  saveSleepSession: mocks.writeRemote
}));

const client = {} as SleepRhythmSupabaseClient;
const account = { mode: 'account' as const, userId: '11111111-1111-4111-8111-111111111111', client };
const demo = { mode: 'demo' as const, userId: 'demo-user', client };
const session: SleepSession = {
  date: '2026-09-09', sleep_start_at: '2026-09-08T23:00:00Z', sleep_end_at: '2026-09-09T07:00:00Z',
  duration_minutes: 480, source: 'manual', source_confidence: 'medium',
  reason_codes: ['manual_sleep_log'], created_at: '2026-09-09T08:00:00Z'
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.readLocal.mockResolvedValue([]);
  mocks.readRemote.mockResolvedValue([]);
  mocks.readNeed.mockResolvedValue(null);
});

describe('shared saved sleep source', () => {
  it('starts a demo with zero fabricated sessions', async () => {
    expect(await loadSleepHistory(demo)).toEqual({ sessions: [], sleepNeed: null });
    expect(mocks.readRemote).not.toHaveBeenCalled();
  });

  it('starts a real account empty even if this device has demo sleep', async () => {
    mocks.readLocal.mockResolvedValue([session]);
    expect(await loadSleepHistory(account)).toEqual({ sessions: [], sleepNeed: null });
    expect(mocks.readLocal).not.toHaveBeenCalled();
    expect(mocks.readRemote).toHaveBeenCalledWith(client, account.userId, 21);
  });

  it('returns recorded demo history without adding sample nights', async () => {
    mocks.readLocal.mockResolvedValue([session]);
    expect((await loadSleepHistory(demo)).sessions).toEqual([session]);
  });

  it('never substitutes local sleep after an account read failure', async () => {
    mocks.readRemote.mockRejectedValue(new Error('Connection unavailable'));
    await expect(loadSleepHistory(account)).rejects.toThrow('Connection unavailable');
    expect(mocks.readLocal).not.toHaveBeenCalled();
  });

  it('never writes an account entry to demo storage when a save fails', async () => {
    mocks.writeRemote.mockRejectedValue(new Error('Write denied'));
    await expect(saveSleepForSource(account, session)).rejects.toThrow('Write denied');
    expect(mocks.writeLocal).not.toHaveBeenCalled();
  });

  it('routes saved entries to exactly one scoped destination', async () => {
    await saveSleepForSource(demo, session);
    expect(mocks.writeLocal).toHaveBeenCalledWith(session);
    expect(mocks.writeRemote).not.toHaveBeenCalled();
    mocks.writeLocal.mockClear();
    await saveSleepForSource(account, session);
    expect(mocks.writeRemote).toHaveBeenCalledWith(client, account.userId, session);
    expect(mocks.writeLocal).not.toHaveBeenCalled();
  });

  it('rejects an account without an authenticated identifier instead of using demo data', async () => {
    const missing = { ...account, userId: undefined };
    await expect(loadSleepHistory(missing)).rejects.toThrow('active account');
    await expect(saveSleepForSource(missing, session)).rejects.toThrow('active account');
    expect(mocks.readLocal).not.toHaveBeenCalled();
    expect(mocks.writeLocal).not.toHaveBeenCalled();
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { USER_DATA_TABLES } from '../../../supabase/functions/_shared/userDataTables';
import {
  DELETE_UNAVAILABLE,
  exportFileName,
  localKeysFor,
  requestAccountDeletion,
  requestAccountExport,
  withDeviceData,
  type AccountFunctionsClient
} from '../../../src/features/account/accountData';

const USER = '0b7f6c2e-1d2a-4c3b-9e8f-112233445566';

function clientReturning(data: unknown, error: unknown = null) {
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  const client: AccountFunctionsClient = {
    functions: {
      invoke: async (name, options) => {
        calls.push({ name, body: options.body });
        return { data, error };
      }
    }
  };
  return { client, calls };
}

describe('account deletion request', () => {
  it('sends the explicit confirmation the function requires', async () => {
    const { client, calls } = clientReturning({ deleted: true });
    expect(await requestAccountDeletion(client)).toEqual({ ok: true, value: true });
    expect(calls).toEqual([{ name: 'delete-account', body: { confirm: 'delete' } }]);
  });

  it('reports failure plainly, with a way to get it done anyway', async () => {
    const { client } = clientReturning(null, { message: 'boom' });
    expect(await requestAccountDeletion(client)).toEqual({ ok: false, detail: DELETE_UNAVAILABLE });
    expect(DELETE_UNAVAILABLE).toMatch(/contact support/);
  });

  it('never claims success without a signed-in client', async () => {
    expect((await requestAccountDeletion(null)).ok).toBe(false);
  });

  it('treats a thrown transport error as a failure, not a crash', async () => {
    const client: AccountFunctionsClient = { functions: { invoke: async () => { throw new Error('offline'); } } };
    expect((await requestAccountDeletion(client)).ok).toBe(false);
  });
});

describe('account export request', () => {
  it('accepts only a well-formed export', async () => {
    expect((await requestAccountExport(clientReturning({ format: 'daywoven-export', tables: {} }).client)).ok).toBe(true);
    expect((await requestAccountExport(clientReturning({ something: 'else' }).client)).ok).toBe(false);
  });

  it('adds device-only entries, parsed where they are JSON', () => {
    const merged = withDeviceData({ format: 'daywoven-export' }, [
      [`a:${USER}`, '{"x":1}'],
      [`b:${USER}`, 'plain'],
      [`c:${USER}`, null]
    ]);
    expect(merged.device).toEqual({ [`a:${USER}`]: { x: 1 }, [`b:${USER}`]: 'plain' });
  });

  it('names the file by date', () => {
    expect(exportFileName(new Date('2026-11-01T12:00:00Z'))).toBe('daywoven-export-2026-11-01.json');
  });
});

describe('device data for an account', () => {
  it('matches only keys scoped to that account', () => {
    const keys = [`healthi:movement:weightUnit:v1:${USER}`, 'healthi:movement:weightUnit:v1:demo', 'sb-auth-token', 'healthi:x:other-user'];
    expect(localKeysFor(keys, USER)).toEqual([`healthi:movement:weightUnit:v1:${USER}`]);
    expect(localKeysFor(keys, '')).toEqual([]);
  });
});

describe('export coverage', () => {
  /*
   * The export is only as complete as its table list. Every table a migration creates
   * with a user column must be in it, or be named here with the reason it is not.
   */
  const NOT_PERSONAL_DATA: Record<string, string> = {
    lab_reviewer_memberships: 'staff role for the evidence review tool, not app data about the person'
  };

  it('lists every user-owned table in the migrations', () => {
    const dir = join(__dirname, '../../../supabase/migrations');
    const owned = new Set<string>();
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql'))) {
      const sql = readFileSync(join(dir, file), 'utf8');
      for (const match of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
        const [, table, body] = match;
        if (/^\s*(user_id|id)\s+uuid[^,\n]*references (auth\.users|public\.profiles)/m.test(body)) owned.add(table);
      }
    }
    const listed = new Set(USER_DATA_TABLES.map((entry) => entry.table));
    const missing = [...owned].filter((table) => !listed.has(table) && !NOT_PERSONAL_DATA[table]);
    expect(missing).toEqual([]);
    expect(owned.size).toBeGreaterThan(50);
  });
});

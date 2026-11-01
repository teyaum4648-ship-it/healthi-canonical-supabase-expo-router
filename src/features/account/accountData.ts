/**
 * Exporting and deleting an account: the two requests a person can make about all of
 * their data at once.
 *
 * Both run as edge functions (`export-account`, `delete-account`) because both need the
 * service role — a complete copy regardless of table grants, and the right to remove the
 * auth user itself. This module is the client half, kept free of react-native so the
 * logic can be tested directly. Every failure becomes a sentence a screen can show.
 */

export type AccountFunctionsClient = {
  functions: {
    invoke(
      name: 'export-account' | 'delete-account',
      options: { body: Record<string, unknown> }
    ): Promise<{ data: unknown; error: unknown }>;
  };
};

export type AccountRequestResult<T> = { ok: true; value: T } | { ok: false; detail: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const EXPORT_UNAVAILABLE = 'Your export could not be prepared right now. Please try again in a moment.';
export const DELETE_UNAVAILABLE =
  'Your account could not be deleted right now. Please try again, or contact support and we will delete it for you.';

export async function requestAccountExport(
  client: AccountFunctionsClient | null
): Promise<AccountRequestResult<Record<string, unknown>>> {
  if (!client) return { ok: false, detail: 'Exports need a signed-in account.' };
  try {
    const { data, error } = await client.functions.invoke('export-account', { body: {} });
    if (error || !isRecord(data) || data.format !== 'daywoven-export') return { ok: false, detail: EXPORT_UNAVAILABLE };
    return { ok: true, value: data };
  } catch {
    return { ok: false, detail: EXPORT_UNAVAILABLE };
  }
}

export async function requestAccountDeletion(
  client: AccountFunctionsClient | null
): Promise<AccountRequestResult<true>> {
  if (!client) return { ok: false, detail: 'There is no signed-in account to delete.' };
  try {
    const { data, error } = await client.functions.invoke('delete-account', { body: { confirm: 'delete' } });
    if (error || !isRecord(data) || data.deleted !== true) return { ok: false, detail: DELETE_UNAVAILABLE };
    return { ok: true, value: true };
  } catch {
    return { ok: false, detail: DELETE_UNAVAILABLE };
  }
}

/**
 * The on-device keys that belong to one account. Local stores scope their keys with the
 * user's id, so matching on it finds this person's entries and never another account's
 * or the demo's — and never the auth session, which is not stored under the id.
 */
export function localKeysFor(keys: readonly string[], userId: string): string[] {
  if (!userId) return [];
  return keys.filter((key) => key.includes(userId));
}

/** Adds what is kept only on this device, so the export is the whole picture. */
export function withDeviceData(
  exported: Record<string, unknown>,
  entries: readonly (readonly [string, string | null])[]
): Record<string, unknown> {
  const device: Record<string, unknown> = {};
  for (const [key, raw] of entries) {
    if (raw === null) continue;
    try {
      device[key] = JSON.parse(raw) as unknown;
    } catch {
      device[key] = raw;
    }
  }
  return { ...exported, device };
}

export function exportFileName(now: Date): string {
  return `daywoven-export-${now.toISOString().slice(0, 10)}.json`;
}

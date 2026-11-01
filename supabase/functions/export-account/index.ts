import { authenticatedUser, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { USER_DATA_TABLES } from '../_shared/userDataTables.ts';

/**
 * Hands a signed-in person a copy of everything daywoven holds about them.
 *
 * This is the access right under the CCPA and California's medical-information law, and
 * what the signup screen promises ("export … all of it at any time"). It runs with the
 * service role so the copy is complete whatever the table grants say, and it filters
 * every query to the caller's own id, which comes from their verified token and never
 * from the request body.
 *
 * A table that cannot be read is reported by name rather than failing the whole export,
 * so a person always gets what can be given plus an honest list of what could not.
 */

const PAGE = 1000;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const user = await authenticatedUser(request);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  const client = serviceClient();
  const tables: Record<string, unknown[]> = {};
  const unavailable: string[] = [];

  for (const { table, owner } of USER_DATA_TABLES) {
    const rows: unknown[] = [];
    let failed = false;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from(table).select('*').eq(owner, user.id).range(from, from + PAGE - 1);
      if (error) { failed = true; break; }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    if (failed) unavailable.push(table);
    else if (rows.length) tables[table] = rows;
  }

  await client.from('privacy_events').insert({ user_id: user.id, event_type: 'data_export', metadata: { tables: Object.keys(tables).length } });

  return jsonResponse({
    format: 'daywoven-export',
    version: 1,
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      metadata: user.user_metadata ?? {}
    },
    tables,
    unavailable
  });
});

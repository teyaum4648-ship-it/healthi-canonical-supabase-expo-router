import { authenticatedUser, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

/**
 * Permanently deletes the signed-in person's account and everything attached to it.
 *
 * App Store guideline 5.1.1(v) requires that an app which lets people create an account
 * also lets them delete it from inside the app, and the CCPA and California's
 * medical-information law give the same right. Deleting the auth user is the whole
 * operation: every user-owned table references `auth.users` (directly or through
 * `profiles`) with `on delete cascade`, so the rows go in the same transaction.
 *
 * The id comes only from the caller's verified token. The body must carry
 * `{ "confirm": "delete" }`, so a stray call with a valid session cannot do this by itself.
 */

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const user = await authenticatedUser(request);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  const body = await request.json().catch(() => null) as { confirm?: unknown } | null;
  if (body?.confirm !== 'delete') {
    return jsonResponse({ error: 'confirmation_required', detail: 'Deletion was not confirmed.' }, 400);
  }

  const { error } = await serviceClient().auth.admin.deleteUser(user.id);
  if (error) {
    // Logged without the id's data; the person is told to contact support, never shown internals.
    console.error('delete-account failed', error.message);
    return jsonResponse({
      error: 'delete_failed',
      detail: 'Your account could not be deleted right now. Please try again, or contact support and we will delete it for you.'
    }, 500);
  }

  return jsonResponse({ deleted: true });
});

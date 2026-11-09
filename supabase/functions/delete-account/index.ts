import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticatedUser, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { readLimitedJson } from '../_shared/requestLimits.ts';

// The identity always comes from a verified bearer token, never a request user_id.
// Password verification uses Supabase Auth's rate limiting and a separate, nonpersistent client.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  try {
    const user = await authenticatedUser(request);
    if (!user?.email) return jsonResponse({ error: 'unauthorized' }, 401);
    let body: unknown;
    try { body = await readLimitedJson(request, 4096); }
    catch { return jsonResponse({ error: 'invalid_request' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ error: 'invalid_request' }, 400);
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(key => !['confirmation', 'password'].includes(key)) || input.confirmation !== 'DELETE' || typeof input.password !== 'string' || !input.password || input.password.length > 1024) {
      return jsonResponse({ error: 'confirmation_required' }, 400);
    }
    const verifier = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data, error } = await verifier.auth.signInWithPassword({ email: user.email, password: input.password });
    if (error || data.user?.id !== user.id) return jsonResponse({ error: 'reauthentication_failed' }, 403);
    // Hard delete; existing FK cascades remove account-owned rows. No soft deletion.
    const { error: deletionError } = await serviceClient().auth.admin.deleteUser(user.id, false);
    if (deletionError) return jsonResponse({ error: 'deletion_failed' }, 503);
    return jsonResponse({ deleted: true });
  } catch {
    // Never log passwords, bearer tokens, provider responses, or health records.
    return jsonResponse({ error: 'deletion_unavailable' }, 503);
  }
});

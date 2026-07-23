import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }
  );
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export function isServiceRequest(request: Request): boolean {
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return Boolean(expected && request.headers.get('Authorization') === `Bearer ${expected}`);
}

export async function reviewerUser(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return null;
  const client = serviceClient();
  const { data } = await client
    .from('lab_reviewer_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  return data ? { user, role: data.role as 'reviewer' | 'admin' } : null;
}

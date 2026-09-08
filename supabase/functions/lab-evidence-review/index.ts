import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { reviewerUser, serviceClient } from '../_shared/auth.ts';

const reviewTables = {
  record: 'lab_evidence_records',
  certification: 'lab_certifications',
  context: 'lab_evidence_contexts'
} as const;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const reviewer = await reviewerUser(request);
  if (!reviewer) return jsonResponse({ error: 'forbidden' }, 403);
  const client = serviceClient();
  const { data: reviewerFlag } = await client
    .from('lab_evidence_feature_flags')
    .select('enabled')
    .eq('flag_key', 'reviewer_console')
    .maybeSingle();
  if (!reviewerFlag?.enabled) return jsonResponse({ error: 'reviewer_console_disabled' }, 503);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  if (body.action === 'me') return jsonResponse({ authorized: true, role: reviewer.role });
  if (body.action === 'queue') {
    const [records, certifications, contexts, alerts] = await Promise.all([
      client.from('lab_evidence_records').select('id, record_type, source_id, created_at').in('review_status', ['draft', 'in_review']).limit(50),
      client.from('lab_certifications').select('id, certification_name, source_id, created_at').in('review_status', ['draft', 'in_review']).limit(50),
      client.from('lab_evidence_contexts').select('id, title, scope, source_id, created_at').in('review_status', ['draft', 'in_review']).limit(50),
      client.from('lab_regulatory_alerts').select('id, authority, title, created_at').eq('match_status', 'pending_review').limit(50)
    ]);
    return jsonResponse({
      records: records.data ?? [],
      certifications: certifications.data ?? [],
      contexts: contexts.data ?? [],
      regulatoryAlerts: alerts.data ?? []
    });
  }

  if (body.action !== 'review' || typeof body.kind !== 'string' || typeof body.id !== 'string' || typeof body.decision !== 'string') {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }
  if (body.kind === 'regulatory_alert') {
    const allowed = ['approved_exact_lot', 'approved_exact_product', 'approved_related', 'withheld'];
    if (!allowed.includes(body.decision)) return jsonResponse({ error: 'invalid_decision' }, 400);
    const { error } = await client.from('lab_regulatory_alerts').update({
      match_status: body.decision,
      match_reason_codes: Array.isArray(body.reasonCodes) ? body.reasonCodes : [],
      reviewed_by: reviewer.user.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', body.id);
    if (error) return jsonResponse({ error: 'review_failed' }, 500);
  } else {
    const table = reviewTables[body.kind as keyof typeof reviewTables];
    if (!table || !['in_review', 'approved', 'rejected'].includes(body.decision)) return jsonResponse({ error: 'invalid_decision' }, 400);
    const update: Record<string, unknown> = {
      review_status: body.decision,
      reviewed_by: reviewer.user.id,
      reviewed_at: new Date().toISOString()
    };
    if (body.kind === 'record' && body.decision === 'approved') update.published_at = new Date().toISOString();
    const { error } = await client.from(table).update(update).eq('id', body.id);
    if (error) return jsonResponse({ error: 'review_failed' }, 500);
  }

  await client.from('lab_audit_events').insert({
    actor_user_id: reviewer.user.id,
    actor_type: 'reviewer',
    action: `review_${body.decision}`,
    entity_type: body.kind,
    entity_id: body.id,
    details: { reasonCodes: Array.isArray(body.reasonCodes) ? body.reasonCodes : [] }
  });
  return jsonResponse({ ok: true });
});

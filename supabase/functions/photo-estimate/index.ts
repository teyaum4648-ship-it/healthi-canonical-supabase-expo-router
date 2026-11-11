import { authenticatedUser, serviceClient } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { BodyTooLargeError, readLimitedJson } from '../_shared/requestLimits.ts';
import { premiumAccessForUser } from '../_shared/premiumAccess.ts';

/**
 * Estimates the foods in a meal photo.
 *
 * Runs server-side for two reasons. The API key stays out of the app bundle — the same rule
 * the USDA key follows, never in an Expo public variable or in Git — and every call costs
 * money. A database transaction reserves one of 25 account requests per UTC day,
 * shared across instances and restarts. A failed provider attempt also consumes it.
 *
 * Unconfigured is a first-class state. With no ANTHROPIC_API_KEY set the function reports
 * `not_configured` and spends nothing, which is how the feature ships dark: the photo path
 * is wired end to end and simply declines until a key exists.
 */

const DEFAULT_MODEL = 'claude-opus-5';
const ANTHROPIC_VERSION = '2023-06-01';

/** Server-controlled durable quota; migration 0022 must be deployed first. */
const DAILY_ESTIMATE_LIMIT = 25;
/** Roughly 8 MB of base64 — larger than any sensibly downscaled photo. */
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 16_384;
const MAX_UPSTREAM_BYTES = 256_000;
const UPSTREAM_TIMEOUT_MS = 30_000;
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * What the model is asked to return.
 *
 * The instructions are written to make declining cheap: an empty list is an acceptable
 * answer, and portion confidence is asked for separately because that is where the error
 * lives. Nothing here asks for ingredients or allergens — a photo is not a label, and a
 * guess at either would be presented alongside real label evidence elsewhere in the app.
 */
const SYSTEM_PROMPT = [
  'You identify foods in a photo of a meal and estimate the portion of each.',
  '',
  'Return one entry per distinct food you can actually see. Rules:',
  '- Estimate the portion as it appears, using grams for solids, millilitres for liquids,',
  '  or a count for discrete items (eggs, slices, bars).',
  '- Give identification_confidence and portion_confidence separately. Being sure a fillet',
  '  is salmon says nothing about whether it is 120 g or 220 g. Portion confidence should be',
  '  "low" unless there is a clear size reference in the frame.',
  '- Nutrients are for the portion you estimated, not per 100 g.',
  '- Omit any nutrient you cannot reasonably estimate rather than guessing a number.',
  '- Do not report ingredients, brands or allergens. A photo does not show a label.',
  '- If you cannot make out any food, return an empty items array. That is a useful answer,',
  '  not a failure; do not invent a plausible meal.'
].join('\n');

const ESTIMATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'amount', 'unit', 'identification_confidence', 'portion_confidence'],
        properties: {
          name: { type: 'string', description: 'The food, e.g. "Grilled salmon fillet".' },
          detail: { type: 'string', description: 'Which item in the frame this is.' },
          amount: { type: 'number', description: 'Portion size in the stated unit.' },
          unit: { type: 'string', enum: ['g', 'ml', 'count'] },
          described_as: { type: 'string', description: 'Plain phrasing, e.g. "about a palm".' },
          identification_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          portion_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          nutrients: {
            type: 'object',
            additionalProperties: false,
            properties: {
              calories: { type: 'number' },
              protein_g: { type: 'number' },
              carbs_g: { type: 'number' },
              fat_g: { type: 'number' },
              fiber_g: { type: 'number' },
              sugar_g: { type: 'number' },
              sodium_mg: { type: 'number' },
              saturated_fat_g: { type: 'number' }
            }
          }
        }
      }
    }
  }
} as const;

type RequestBody = { image_base64?: unknown; media_type?: unknown; note?: unknown };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // A signed-in account only: an estimate spends money, so it is never available
  // to the project's public anon key the way a barcode lookup is.
  const user = await authenticatedUser(request);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return jsonResponse({
      not_configured: true,
      detail: 'Photo estimates are not switched on for this deployment.'
    });
  }

  // Premium API costs are authorized on the server, not by a client-provided
  // entitlement flag. When billing launches, expired/free accounts cannot spend
  // provider quota. While billing is disabled, the existing demo behavior stays.
  const premium = await premiumAccessForUser(user.id);
  if (premium === 'unavailable') return jsonResponse({ error: 'billing_temporarily_unavailable' }, 503);
  if (premium === 'subscription_required') return jsonResponse({
    error: 'subscription_required',
    detail: 'An active Daywoven subscription is required for photo estimates.'
  }, 402);

  let body: RequestBody | null = null;
  try { body = await readLimitedJson(request, MAX_REQUEST_BYTES) as RequestBody | null; } catch (error) {
    if (error instanceof BodyTooLargeError) return jsonResponse({ error: 'invalid_image', detail: 'That photo request is too large.' }, 413);
  }
  const image = typeof body?.image_base64 === 'string' ? body.image_base64 : null;
  const mediaType = typeof body?.media_type === 'string' ? body.media_type : 'image/jpeg';
  if (!image) return jsonResponse({ error: 'invalid_image', detail: 'No photo was supplied.' }, 400);
  if (image.length > MAX_IMAGE_BYTES) {
    return jsonResponse({ error: 'invalid_image', detail: 'That photo is too large; it should be downscaled before sending.' }, 413);
  }
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return jsonResponse({ error: 'invalid_image', detail: 'Unsupported image format.' }, 415);
  }

  // Fail closed if the database is unavailable or the quota migration is missing.
  try {
    const { data, error } = await serviceClient().rpc('consume_photo_estimate_quota', { account_id: user.id });
    if (error || typeof data !== 'boolean') return jsonResponse({ error: 'unavailable', detail: 'Photo estimates are temporarily unavailable.' }, 503);
    if (!data) {
      const response = jsonResponse({ error: 'rate_limited', detail: `Photo estimates are limited to ${DAILY_ESTIMATE_LIMIT} a day.` }, 429);
      response.headers.set('Retry-After', '3600');
      return response;
    }
  } catch { return jsonResponse({ error: 'unavailable' }, 503); }

  const model = Deno.env.get('PHOTO_ESTIMATE_MODEL') ?? DEFAULT_MODEL;
  // The person's own note ("this is a half portion") is context, not instruction: it is
  // placed in the user turn where the system prompt still governs the output shape.
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : '';

  let upstream: Response;
  let payload: { content?: Array<{ type?: string; text?: string }>; stop_reason?: string; model?: string } | null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: 'json_schema', schema: ESTIMATE_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: note ? `Identify the foods and portions. Context from the person eating it: ${note}` : 'Identify the foods and portions.' }
          ]
        }]
      })
    });
    if (upstream.status === 429) {
      const response = jsonResponse({ error: 'rate_limited', detail: 'The estimate service is busy. Try again shortly.' }, 429);
      response.headers.set('Retry-After', upstream.headers.get('retry-after') ?? '30');
      return response;
    }
    if (!upstream.ok) {
      // Keep provider account details, request content and credentials out of logs.
      console.error('photo-estimate upstream failure', upstream.status);
      return jsonResponse({ error: 'unavailable', detail: 'The estimate service could not complete that request.' }, 502);
    }
    payload = await readLimitedJson(upstream, MAX_UPSTREAM_BYTES) as typeof payload;
  } catch {
    return jsonResponse({ error: 'unavailable', detail: 'Could not reach or complete the estimate service response.' }, 502);
  } finally { clearTimeout(timeout); }

  if (payload?.stop_reason === 'refusal') {
    return jsonResponse({ error: 'too_unclear', detail: 'That photo could not be assessed. Try another, or search for the food instead.' });
  }

  const text = Array.isArray(payload?.content)
    ? payload.content.find((block) => block && block.type === 'text' && typeof block.text === 'string')?.text ?? ''
    : '';
  let items: unknown = null;
  try {
    items = JSON.parse(text) as unknown;
  } catch {
    return jsonResponse({ error: 'malformed_response', detail: 'The estimate came back in a shape Healthi could not read.' });
  }

  // The client validates and clamps every field; this only forwards the shape plus the
  // model that produced it, so a stored estimate records what made the guess.
  return jsonResponse({ estimate: items, model: payload?.model ?? model });
});

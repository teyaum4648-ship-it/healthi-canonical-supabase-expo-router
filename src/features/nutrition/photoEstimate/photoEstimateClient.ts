import { parsePhotoEstimate } from './photoEstimate';
import type { PhotoEstimateRefusal, PhotoEstimateResult } from './photoEstimateTypes';

/**
 * Calls the photo-estimate edge function and hands the reply to the validator.
 *
 * The client never talks to a model directly: the API key lives only in the function's
 * environment. Every failure path becomes a named refusal rather than an exception, so a
 * screen can always say what went wrong, and an unconfigured deployment is an ordinary
 * answer rather than an error.
 */

export type PhotoEstimateInvoker = {
  functions: {
    invoke(
      name: 'photo-estimate',
      options: { body: { image_base64: string; media_type: string; note?: string } }
    ): Promise<{ data: unknown; error: unknown }>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 240) : fallback;
}

/** FunctionsHttpError keeps an HTTP error's body on its Response context. */
async function functionErrorPayload(error: unknown): Promise<{ payload: Record<string, unknown> | null; status: number | null }> {
  const context = isRecord(error) ? error.context : null;
  if (!isRecord(context) || typeof context.status !== 'number' || typeof context.clone !== 'function') {
    return { payload: null, status: null };
  }
  const status = context.status;
  try {
    const response = (context as Pick<Response, 'clone'>).clone();
    const maximumBytes = 4096;
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null && Number(declaredLength) > maximumBytes) return { payload: null, status };
    const reader = response.body?.getReader?.();
    let raw: string;
    if (reader) {
      const chunks: Uint8Array[] = [];
      let byteLength = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          byteLength += value.byteLength;
          if (byteLength > maximumBytes) {
            void reader.cancel().catch(() => undefined);
            return { payload: null, status };
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(byteLength);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      raw = await new Response(bytes).text();
    } else {
      // Native fetch implementations may not expose a readable stream. Only
      // read a body with a declared bounded length; the status still maps a 429.
      if (declaredLength === null || !Number.isFinite(Number(declaredLength)) || Number(declaredLength) < 0) {
        return { payload: null, status };
      }
      raw = await response.text();
      if (raw.length > maximumBytes) return { payload: null, status };
    }
    const payload: unknown = JSON.parse(raw);
    return { payload: isRecord(payload) ? payload : null, status };
  } catch {
    return { payload: null, status };
  }
}

/** Maps a reported error code onto a refusal, defaulting to `unavailable` for anything new. */
function refusalFor(code: unknown, detail: unknown): PhotoEstimateRefusal {
  switch (code) {
    case 'rate_limited':
      return { reason: 'rate_limited', detail: text(detail, 'You have reached today’s photo estimate limit.') };
    case 'too_unclear':
      return { reason: 'too_unclear', detail: text(detail, 'That photo could not be assessed. Try another angle.') };
    case 'malformed_response':
      return { reason: 'malformed_response', detail: text(detail, 'The estimate came back in a shape daywoven could not read.') };
    case 'invalid_image':
      return { reason: 'unavailable', detail: text(detail, 'That photo could not be sent.') };
    default:
      return { reason: 'unavailable', detail: text(detail, 'Photo estimates are unavailable right now.') };
  }
}

export async function requestPhotoEstimate(params: {
  client: PhotoEstimateInvoker | null;
  imageBase64: string;
  mediaType: string;
  note?: string;
  now?: string;
}): Promise<PhotoEstimateResult> {
  if (!params.client) {
    return {
      ok: false,
      refusal: { reason: 'not_configured', detail: 'Photo estimates need a signed-in account and a configured deployment.' }
    };
  }

  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await params.client.functions.invoke('photo-estimate', {
      body: { image_base64: params.imageBase64, media_type: params.mediaType, note: params.note }
    }));
  } catch {
    return { ok: false, refusal: { reason: 'unavailable', detail: 'Could not reach the estimate service.' } };
  }

  if (error) {
    const { payload, status } = await functionErrorPayload(error);
    if (payload?.error) return { ok: false, refusal: refusalFor(payload.error, payload.detail) };
    if (status === 429) return { ok: false, refusal: refusalFor('rate_limited', null) };
    // A transport-level failure has no HTTP response body to classify.
    const code = isRecord(error) ? error.code ?? error.name : null;
    return { ok: false, refusal: refusalFor(code, isRecord(error) ? error.message : null) };
  }
  if (!isRecord(data)) {
    return { ok: false, refusal: { reason: 'malformed_response', detail: 'The estimate came back empty.' } };
  }

  if (data.not_configured === true) {
    return {
      ok: false,
      refusal: { reason: 'not_configured', detail: text(data.detail, 'Photo estimates are not switched on for this deployment.') }
    };
  }
  if (data.error) return { ok: false, refusal: refusalFor(data.error, data.detail) };

  return parsePhotoEstimate(data.estimate, {
    model: typeof data.model === 'string' ? data.model : null,
    now: params.now
  });
}

/** Copy for a refusal, so every caller says the same thing about the same failure. */
export function photoEstimateRefusalTitle(refusal: PhotoEstimateRefusal): string {
  switch (refusal.reason) {
    case 'not_configured': return 'Photo estimates are off';
    case 'no_food_found': return 'No food recognised';
    case 'too_unclear': return 'That photo was too unclear';
    case 'rate_limited': return 'Daily limit reached';
    case 'malformed_response': return 'Estimate could not be read';
    default: return 'Estimates unavailable';
  }
}

/**
 * Sizing maths for a meal photo. No native imports, so it stays testable.
 *
 * Downscaling before upload is the single biggest cost lever in the feature. Image tokens
 * run at roughly (width × height) / 750, so a 4032 × 3024 phone photo is about 16,000
 * input tokens, while the same photo at 1024 px on its long edge is about 1,000 — a
 * fifteen-fold difference in what one estimate costs, for no measurable loss in
 * identifying food. It also keeps the request well inside the function's size ceiling on a
 * slow connection.
 */

/** Long edge in pixels. Above this, cost rises faster than identification improves. */
export const MAX_IMAGE_EDGE = 1024;

/** JPEG quality for the resized upload. Lower than this starts to cost identification. */
export const JPEG_QUALITY = 0.7;

/**
 * The size to request, preserving aspect ratio.
 *
 * Only ever shrinks: upscaling a small photo would add tokens and no detail.
 */
export function downscaleTarget(
  width: number,
  height: number,
  maxEdge = MAX_IMAGE_EDGE
): { width: number; height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return null;
  const scale = maxEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Rough input-token count for a photo, used to explain cost rather than to enforce it. */
export function estimateImageTokens(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  return Math.round((width * height) / 750);
}

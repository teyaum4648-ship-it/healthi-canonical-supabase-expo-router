/**
 * WCAG relative luminance and contrast ratio, per the formulae in WCAG 2.2.
 *
 * This lives in the source tree rather than in a test helper because the accessibility
 * statement on the website claims contrast is "calculated from the theme values, not
 * sampled from screenshots". That claim has to be backed by something that runs.
 *
 * Only opaque hex is handled. A translucent colour has no single ratio — it depends on
 * what is behind it — so the caller has to composite it first or test the result.
 */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const normalized = hex.trim().replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not an opaque hex colour: ${hex}`);

  const r = channel(parseInt(full.slice(0, 2), 16));
  const g = channel(parseInt(full.slice(2, 4), 16));
  const b = channel(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG 2.2 success criteria, as the thresholds they actually are. */
export const WCAG = {
  /** 1.4.3 — body text. */
  AA_TEXT: 4.5,
  /** 1.4.3 — text at 18.66px bold or 24px and above. */
  AA_LARGE_TEXT: 3,
  /** 1.4.11 — icons, control borders, chart strokes. */
  AA_NON_TEXT: 3
} as const;

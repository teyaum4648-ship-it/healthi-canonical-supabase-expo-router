import { describe, expect, it } from 'vitest';

import {
  MAX_IMAGE_EDGE,
  downscaleTarget,
  estimateImageTokens
} from '../../../src/features/nutrition/photoEstimate/photoImageSizing';

describe('downscaling before upload', () => {
  it('shrinks a phone photo onto the long edge, keeping the aspect ratio', () => {
    expect(downscaleTarget(4032, 3024)).toEqual({ width: 1024, height: 768 });
    expect(downscaleTarget(3024, 4032)).toEqual({ width: 768, height: 1024 });
    expect(downscaleTarget(4000, 4000)).toEqual({ width: 1024, height: 1024 });
  });

  it('leaves an already-small photo alone rather than upscaling it', () => {
    // Upscaling would add tokens and no detail.
    expect(downscaleTarget(800, 600)).toBeNull();
    expect(downscaleTarget(MAX_IMAGE_EDGE, 400)).toBeNull();
  });

  it('returns nothing for dimensions it cannot use', () => {
    for (const [w, h] of [[0, 100], [100, 0], [-5, 100], [Number.NaN, 100], [Number.POSITIVE_INFINITY, 100]]) {
      expect(downscaleTarget(w!, h!)).toBeNull();
    }
  });
});

describe('what downscaling saves', () => {
  it('cuts a full-resolution photo to a fraction of the input tokens', () => {
    const original = estimateImageTokens(4032, 3024);
    const target = downscaleTarget(4032, 3024)!;
    const resized = estimateImageTokens(target.width, target.height);
    expect(original).toBe(16257);
    expect(resized).toBe(1049);
    // The cost lever the feature leans on: roughly fifteen times fewer input tokens.
    expect(original / resized).toBeGreaterThan(14);
  });

  it('reports nothing for unusable dimensions', () => {
    expect(estimateImageTokens(0, 0)).toBe(0);
    expect(estimateImageTokens(Number.NaN, 10)).toBe(0);
  });
});

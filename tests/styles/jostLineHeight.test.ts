import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { font, type as type1c } from '../../src/styles/daywoven1c';

/**
 * Jost sits tall: its descender is 0.375em and its ascenders reach above the cap height.
 * On iOS a line height smaller than about 1.2× the size takes the missing room off the
 * top of the glyphs, which is how the week cards' "6h 30m" and "0 of 7" lost their tops
 * on a phone while looking fine on the web. Every Jost style keeps at least 1.2×.
 */
const MIN_RATIO = 1.2;
const JOST_FAMILIES = new Set<string>([font.display, font.displayMedium]);
/* How a style names Jost in source: the 1c and legacy font tables, and Food's own aliases. */
const JOST_SOURCE = /\b(fonts?|themeFonts)\.(display|displayMedium|displayLight|displayItalic)\b|\bfontFamily: (serif|serifLight|serifItalic)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe('Jost line heights', () => {
  it('leave room for the glyphs in the 1c type scale', () => {
    const tight = Object.entries(type1c as Record<string, { fontFamily?: string; fontSize?: number; lineHeight?: number }>)
      .filter(([, style]) => style.fontFamily && JOST_FAMILIES.has(style.fontFamily) && style.fontSize && style.lineHeight !== undefined)
      .filter(([, style]) => style.lineHeight! < style.fontSize! * MIN_RATIO)
      .map(([name, style]) => `${name}: ${style.fontSize}/${style.lineHeight}`);
    expect(tight).toEqual([]);
  });

  it('leave room for the glyphs in every style in the app, the legacy theme included', () => {
    const files = ['app', 'src'].flatMap(sourceFiles);
    expect(files.length).toBeGreaterThan(100);
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\{([^{}]{0,500})\}/g)) {
        const body = match[1]!;
        if (!JOST_SOURCE.test(body)) continue;
        const size = /fontSize: ([\d.]+)\b(?!\s*\*)/.exec(body);
        const line = /lineHeight: ([\d.]+)\b(?!\s*\*)/.exec(body);
        if (size && line && Number(line[1]) < Number(size[1]) * MIN_RATIO) offenders.push(`${file}: ${size[1]}/${line[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Keeps the app on the 1c theme (docs/design/1c/HANDOFF.md, Phase 3): a colour is defined
 * once, in src/styles, and every screen and component refers to it by name. A hex value
 * typed into a .tsx file is a colour that will not follow the next theme change.
 */

const ROOTS = ['app', 'src'];
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === join('src', 'styles') ? [] : tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('no raw hex colours outside src/styles', () => {
  const files = ROOTS.flatMap(tsxFiles);

  it('finds the screens and components it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has none in any .tsx file', () => {
    const offenders = files.flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      return lines.flatMap((line, index) => {
        const matches = line.match(HEX) ?? [];
        return matches.map((hex) => `${relative('.', file)}:${index + 1} ${hex}`);
      });
    });
    expect(offenders, `Use a token from src/styles/daywoven1c.ts instead:\n${offenders.join('\n')}`).toEqual([]);
  });
});

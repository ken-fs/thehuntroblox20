/**
 * i18n smoke test — regression guard for the "hardcoded locale" bug class.
 *
 * In v1.1.0 five getStaticPaths implementations inlined `['ja']` while the
 * CLI accepted any locale list — forks adding a 3rd language got site-wide
 * 404s. This test greps the route/i18n sources for hardcoded locale arrays
 * so the bug class can't silently return.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

const ROUTE_FILES = [
  'src/pages/[locale]/index.astro',
  'src/pages/[locale]/faq.astro',
  'src/pages/[locale]/[...slug].astro',
  'src/pages/[locale]/[legal].astro',
  'src/i18n/content.ts',
];

describe('i18n: no hardcoded locale arrays', () => {
  for (const rel of ROUTE_FILES) {
    it(`${rel} derives locales from routing.ts (no inline ['xx'] arrays)`, () => {
      const src = fs.readFileSync(path.resolve(ROOT, rel), 'utf8');
      // Matches ['ja'], ['en'], ['ja','zh'] etc. — but NOT `locales` identifiers.
      const hardcoded = src.match(/\[\s*['"][a-z]{2}['"]\s*(,\s*['"][a-z]{2}['"]\s*)*\]/g);
      expect(hardcoded ?? [], `found hardcoded locale array in ${rel}: ${hardcoded?.join(', ')}`).toHaveLength(0);
    });
  }

  it('routing.ts locales array is parseable and non-empty', () => {
    const src = fs.readFileSync(path.resolve(ROOT, 'src/i18n/routing.ts'), 'utf8');
    const m = src.match(/export const locales = \[([^\]]+)\] as const;/);
    expect(m).toBeTruthy();
    const list = Array.from(m![1].matchAll(/['"]([^'"]+)['"]/g)).map((x) => x[1]);
    expect(list.length).toBeGreaterThan(0);
    expect(list).toContain('en');
  });
});

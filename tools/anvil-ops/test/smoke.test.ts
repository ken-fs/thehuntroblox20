import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Package integrity — the things npm consumers depend on at install time.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as {
  name: string;
  version: string;
  bin: Record<string, string>;
  files: string[];
};

describe('package integrity', () => {
  it('declares the bin aliases this repo documents (anvil-ops + anvilwiki-ops + anvil-ops-mcp)', () => {
    expect(Object.keys(pkg.bin)).toEqual(['anvil-ops', 'anvilwiki-ops', 'anvil-ops-mcp']);
    for (const target of new Set(Object.values(pkg.bin))) {
      expect(target.startsWith('dist/'), `bin target ${target} must live under dist/`).toBe(true);
    }
  });

  it('ships dist only', () => {
    expect(pkg.files).toEqual(['dist']);
  });

  it('is a valid publishable version', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(pkg.name).toBe('anvilwiki-ops');
  });
});

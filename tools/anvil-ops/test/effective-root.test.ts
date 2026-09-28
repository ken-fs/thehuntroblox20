import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveEffectiveRoot, saveSitesRegistry } from '../src/core/sites.js';

const base = mkdtempSync(join(tmpdir(), 'anvil-ops-effroot-'));
afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('resolveEffectiveRoot error discrimination', () => {
  it('a CORRUPT wrangler.toml in cwd throws instead of silently redirecting to defaultSite', () => {
    const broken = join(base, 'broken-site');
    mkdirSync(broken, { recursive: true });
    writeFileSync(join(broken, 'wrangler.toml'), 'this is [ not valid toml {{{');

    const other = join(base, 'other-site');
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, 'wrangler.toml'), '[vars]\nSITE_URL = "https://other.example"\n');

    const registryPath = join(base, 'sites.toml');
    saveSitesRegistry(
      { defaultSite: 'other', sites: [{ name: 'other', path: other }] },
      registryPath,
    );

    // The whole point: a TOML parse error must surface — redirecting a write
    // command (submit_pr) to another site's repo would be the worst outcome.
    expect(() =>
      resolveEffectiveRoot({ cwd: broken, registryPath }),
    ).toThrowError(/TOML|parse|Unexpected|expected/i);
  });

  it('cwd with NO site config still falls through to defaultSite (documented 1.0 behavior)', () => {
    const empty = join(base, 'empty-dir');
    mkdirSync(empty, { recursive: true });

    const other = join(base, 'other-site');
    const registryPath = join(base, 'sites.toml');
    expect(resolveEffectiveRoot({ cwd: empty, registryPath })).toBe(other);
  });

  it('a VALID wrangler.toml in cwd wins over defaultSite', () => {
    const local = join(base, 'local-site');
    mkdirSync(local, { recursive: true });
    writeFileSync(join(local, 'wrangler.toml'), '[vars]\nSITE_URL = "https://local.example"\n');
    const registryPath = join(base, 'sites.toml');
    expect(resolveEffectiveRoot({ cwd: local, registryPath })).toBe(local);
  });
});

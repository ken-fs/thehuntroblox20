import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOpsEnv } from '../src/core/env.js';

const SA = JSON.stringify({
  client_email: 'sa@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
});

function tmpWith(dotenv: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-env-'));
  writeFileSync(join(dir, '.env'), dotenv);
  return dir;
}

describe('loadOpsEnv', () => {
  it('parses file-path style GSC_SERVICE_ACCOUNT_JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-env-'));
    writeFileSync(join(dir, 'sa.json'), SA);
    writeFileSync(join(dir, '.env'), `GSC_SERVICE_ACCOUNT_JSON=sa.json\nCF_API_TOKEN=tok\nCF_ACCOUNT_ID=acc\n`);
    const r = loadOpsEnv(dir);
    expect(r.gscServiceAccount?.clientEmail).toBe('sa@project.iam.gserviceaccount.com');
    expect(r.cfApiToken).toBe('tok');
    expect(r.cfAccountId).toBe('acc');
    expect(r.problems).toEqual([]);
  });

  it('parses inline JSON (value starts with {)', () => {
    const dir = tmpWith(`GSC_SERVICE_ACCOUNT_JSON='${SA}'\n`);
    const r = loadOpsEnv(dir);
    expect(r.gscServiceAccount?.privateKey).toContain('PRIVATE KEY');
    expect(r.problems).toEqual([]);
  });

  it('empty env = all features disabled, no problems', () => {
    const r = loadOpsEnv(tmpWith(''));
    expect(r.gscServiceAccount).toBeUndefined();
    expect(r.cfApiToken).toBeUndefined();
    expect(r.problems).toEqual([]);
  });

  it('missing SA file / broken JSON become problems with fix guidance', () => {
    const missing = loadOpsEnv(tmpWith('GSC_SERVICE_ACCOUNT_JSON=nope.json\n'));
    expect(missing.problems[0]).toMatch(/nope\.json/);
    expect(missing.problems[0]).toMatch(/anvil-ops doctor/);

    const dir = mkdtempSync(join(tmpdir(), 'ops-env-'));
    writeFileSync(join(dir, 'sa.json'), '{ not json');
    writeFileSync(join(dir, '.env'), 'GSC_SERVICE_ACCOUNT_JSON=sa.json\n');
    const broken = loadOpsEnv(dir);
    expect(broken.problems.length).toBeGreaterThan(0);
    expect(broken.gscServiceAccount).toBeUndefined();
  });

  it('SA JSON missing required keys becomes a problem', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-env-'));
    writeFileSync(join(dir, 'sa.json'), JSON.stringify({ foo: 1 }));
    writeFileSync(join(dir, '.env'), 'GSC_SERVICE_ACCOUNT_JSON=sa.json\n');
    const r = loadOpsEnv(dir);
    expect(r.problems[0]).toMatch(/client_email|private_key/);
  });
});

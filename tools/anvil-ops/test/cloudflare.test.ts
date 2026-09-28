import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCfQuery, buildCfVariables, parseCfResponse, queryCloudflare } from '../src/core/providers/cloudflare.js';
import { OpsError } from '../src/core/errors.js';

const fixture = JSON.parse(readFileSync('test/fixtures/cf-response.json', 'utf8'));

describe('parseCfResponse', () => {
  it('maps groups to page rows and totals', () => {
    const r = parseCfResponse(fixture);
    expect(r.pages[0]).toEqual({ page: 'https://wiki.example.com/', visits: 5400 });
    expect(r.totals.visits).toBe(7500);
  });

  it('empty groups = zeroed totals', () => {
    const r = parseCfResponse({ data: { viewer: { accounts: [{ rumOperationsGroups: [] }] } } });
    expect(r.totals.visits).toBe(0);
  });

  it('GraphQL errors throw OpsError with introspection hint', () => {
    const bad = { errors: [{ message: 'Unknown field rumPageUrl' }] };
    expect(() => parseCfResponse(bad)).toThrow(OpsError);
    try {
      parseCfResponse(bad);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as OpsError).fix).toMatch(/introspection|curl/);
    }
  });

  it('HTTP 401 throws OpsError mentioning token permission', async () => {
    const fake = (async () => new Response(JSON.stringify({ errors: [{ message: 'authentication failed' }] }), { status: 401 })) as typeof fetch;
    await expect(
      queryCloudflare({ apiToken: 'bad', accountId: 'acc', siteTag: 'tag', days: 7, fetchImpl: fake }),
    ).rejects.toMatchObject({ fix: expect.stringMatching(/Analytics.*Read|token/i) });
  });
});

describe('query/variables builders', () => {
  it('uses rumOperationsGroups with siteTag + datetime filter', () => {
    expect(buildCfQuery()).toContain('rumOperationsGroups');
    expect(buildCfQuery()).toContain('rumPageUrl');
    const v = buildCfVariables({ siteTag: 'tag', days: 28 });
    expect(v.filter).toMatchObject({ _siteTag: 'tag' });
    expect((v.filter as Record<string, string>)._datetime_geq).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

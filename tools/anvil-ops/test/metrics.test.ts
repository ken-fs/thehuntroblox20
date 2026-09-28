import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectMetrics, formatMetrics } from '../src/core/metrics.js';
import type { GscClient } from '../src/core/providers/gsc.js';
import type { queryCloudflare, fetchAiReferrals } from '../src/core/providers/cloudflare.js';

function tmpSite(dotenv: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-metrics-'));
  writeFileSync(join(dir, 'wrangler.toml'), '[vars]\nSITE_URL = "https://wiki.example.com"\nPUBLIC_CF_BEACON_TOKEN = "tag1"\n');
  writeFileSync(join(dir, '.env'), dotenv);
  return dir;
}

const fakeGsc: GscClient = {
  async query() {
    return {
      rows: [{ page: '/b', query: 'q', clicks: 10, impressions: 100, ctr: 0.1, position: 3 }],
      totals: { clicks: 10, impressions: 100, ctr: 0.1, position: 3 },
    };
  },
  async listAccessibleSites() {
    return ['https://wiki.example.com/'];
  },
};

const fakeCf = (async () => ({
  totals: { visits: 42 },
  pages: [{ page: 'https://wiki.example.com/', visits: 42 }],
})) as unknown as typeof queryCloudflare;

const fakeAi = (async () => ({
  available: true,
  rows: [{ host: 'chatgpt.com', requests: 5, pageviews: 5 }],
  totals: { requests: 5, pageviews: 5 },
})) as unknown as typeof fetchAiReferrals;

const failingAi = (async () => {
  throw new Error('boom');
}) as unknown as typeof fetchAiReferrals;

describe('collectMetrics', () => {
  it('full config: both sources present', async () => {
    const dir = tmpSite(`CF_API_TOKEN=t\nCF_ACCOUNT_ID=a\nGSC_SERVICE_ACCOUNT_JSON=${JSON.stringify({ client_email: 'e@x', private_key: 'k' })}\n`);
    const r = await collectMetrics({
      cwd: dir,
      days: 7,
      gscClientFactory: () => fakeGsc,
      cfQuery: fakeCf,
      aiReferralsQuery: fakeAi,
    });
    expect(r.gsc?.totals.clicks).toBe(10);
    expect(r.cf?.totals.visits).toBe(42);
    expect(r.aiReferrals?.totals.requests).toBe(5);
    expect(r.degraded).toEqual([]);
  });

  it('no GSC config: CF-only with degraded note', async () => {
    const dir = tmpSite('CF_API_TOKEN=t\nCF_ACCOUNT_ID=a\n');
    const r = await collectMetrics({ cwd: dir, days: 7, cfQuery: fakeCf, aiReferralsQuery: fakeAi });
    expect(r.gsc).toBeUndefined();
    expect(r.degraded).toEqual(['gsc']);
  });

  it('AI referral failure degrades to a note, metrics still returned', async () => {
    const dir = tmpSite('CF_API_TOKEN=t\nCF_ACCOUNT_ID=a\n');
    const r = await collectMetrics({ cwd: dir, days: 7, cfQuery: fakeCf, aiReferralsQuery: failingAi });
    expect(r.cf?.totals.visits).toBe(42);
    expect(r.aiReferrals).toBeUndefined();
    expect(r.notes.join(' ')).toMatch(/AI referrals unavailable: boom/);
  });

  it('nothing configured: OpsError pointing at doctor', async () => {
    const dir = tmpSite('');
    await expect(collectMetrics({ cwd: dir, days: 7 })).rejects.toMatchObject({ fix: expect.stringMatching(/doctor/) });
  });
});

describe('formatMetrics', () => {
  const base = {
    days: 28,
    siteUrl: 'https://wiki.example.com',
    degraded: ['gsc'] as ('gsc' | 'cf')[],
    notes: [] as string[],
    cf: { totals: { visits: 42 }, pages: [{ page: 'https://wiki.example.com/', visits: 42 }] },
  };

  it('json is parseable and lossless', () => {
    const parsed = JSON.parse(formatMetrics(base, 'json'));
    expect(parsed.cf.totals.visits).toBe(42);
  });

  it('md mentions degraded source', () => {
    const md = formatMetrics(base, 'md');
    expect(md).toContain('# Metrics');
    expect(md).toContain('gsc');
  });

  it('table renders a header row', () => {
    expect(formatMetrics(base, 'table')).toContain('visits');
  });

  it('AI referrals section: rows, totals and empty-state note', () => {
    const withAi = {
      ...base,
      aiReferrals: {
        available: true,
        rows: [
          { host: 'chatgpt.com', requests: 12, pageviews: 12 },
          { host: 'perplexity.ai', requests: 3, pageviews: 3 },
        ],
        totals: { requests: 15, pageviews: 15 },
      },
    };
    const table = formatMetrics(withAi, 'table');
    expect(table).toContain('AI referrals (last 28 days)');
    expect(table).toContain('chatgpt.com');
    expect(table).toContain('total requests=15 pageviews=15');
    const empty = formatMetrics({ ...base, aiReferrals: { available: true, rows: [], totals: { requests: 0, pageviews: 0 } } }, 'md');
    expect(empty).toContain('## AI referrals');
    expect(empty).toMatch(/No AI referrer traffic/);
  });
});

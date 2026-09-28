import { describe, expect, it } from 'vitest';
import { buildAioRequestBody, parseAioResponse } from '../src/core/providers/gsc.js';

describe('buildAioRequestBody', () => {
  it('queries the page dimension filtered to AI_OVERVIEWS, rowLimit 25', () => {
    const body = buildAioRequestBody(28) as Record<string, unknown> & {
      dimensions: string[];
      dimensionFilterGroups: {
        groupType: string;
        filters: { dimension: string; operator: string; expression: string }[];
      }[];
      rowLimit: number;
      startDate: string;
      endDate: string;
    };
    expect(body.dimensions).toEqual(['page']);
    expect(body.dimensionFilterGroups).toHaveLength(1);
    expect(body.dimensionFilterGroups[0].groupType).toBe('and');
    expect(body.dimensionFilterGroups[0].filters[0]).toEqual({
      dimension: 'searchAppearance',
      operator: 'equals',
      expression: 'AI_OVERVIEWS',
    });
    expect(body.rowLimit).toBe(25);
    expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseAioResponse', () => {
  it('maps keys[0] to page with metrics', () => {
    const json = {
      rows: [{ keys: ['https://x.com/a'], clicks: 3, impressions: 400, ctr: 0.0075, position: 1.9 }],
    };
    const r = parseAioResponse(json);
    expect(r.rows).toEqual([{ page: 'https://x.com/a', clicks: 3, impressions: 400, ctr: 0.0075, position: 1.9 }]);
  });

  it('API error shape throws OpsError with fix', () => {
    const bad = { error: { code: 403, message: 'User does not have sufficient permission' } };
    expect(() => parseAioResponse(bad)).toThrow(/403/);
  });

  it('empty rows is not an error', () => {
    expect(parseAioResponse({ rows: [] }).rows).toEqual([]);
  });
});

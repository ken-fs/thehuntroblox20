import { describe, expect, it } from 'vitest';
import { runAudit, formatAudit } from '../src/core/audit.js';
import type { RunFn } from '../src/core/content.js';

function fakeRun(results: Record<string, { status: number | null; stdout: string; stderr?: string }>): RunFn {
  const calls: string[][] = [];
  const fn = ((_cmd: string, args: string[]) => {
    const key = args[0] ?? '';
    calls.push(args);
    const r = results[key] ?? { status: 0, stdout: '' };
    return { status: r.status, stdout: r.stdout, stderr: r.stderr ?? '' };
  }) as RunFn;
  (fn as unknown as { calls: string[][] }).calls = calls;
  return fn;
}

describe('runAudit', () => {
  it('runs the four template scripts', () => {
    const run = fakeRun({});
    const report = runAudit({ cwd: '/repo', run });
    expect((run as unknown as { calls: string[][] }).calls.map((c) => c[0])).toEqual([
      'refresh-audit',
      'check-i18n',
      'check-content',
      'check-links',
    ]);
    expect(report.checks.map((c) => c.name)).toEqual(['refresh-audit', 'check-i18n', 'check-content', 'check-links']);
  });

  it('check-links failure mentioning dist adds build hint', () => {
    const run = fakeRun({ 'check-links': { status: 1, stdout: '', stderr: 'ENOENT dist/index.html' } });
    const report = runAudit({ cwd: '/repo', run });
    const cl = report.checks.find((c) => c.name === 'check-links')!;
    expect(cl.ok).toBe(false);
    expect(cl.summary).toMatch(/pnpm build/);
  });

  it('formatAudit renders markdown with all check names', () => {
    const report = runAudit({ cwd: '/repo', run: fakeRun({}) });
    const md = formatAudit(report);
    expect(md).toContain('# anvil-ops audit');
    expect(md).toContain('refresh-audit');
    expect(md).toContain('check-links');
  });
});

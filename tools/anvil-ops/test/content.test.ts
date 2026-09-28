import { describe, expect, it } from 'vitest';
import { runValidation, type RunFn } from '../src/core/content.js';

function fakeRun(results: Record<string, { status: number | null; stdout: string; stderr?: string }>): RunFn {
  const calls: string[][] = [];
  const fn = ((cmd: string, args: string[]) => {
    const key = args[0] ?? '';
    calls.push([cmd, ...args]);
    const r = results[key] ?? { status: 0, stdout: '' };
    return { status: r.status, stdout: r.stdout, stderr: r.stderr ?? '' };
  }) as RunFn;
  (fn as unknown as { calls: string[][] }).calls = calls;
  return fn;
}

describe('runValidation', () => {
  it('runs check-content, check-i18n (non-strict), build in order', () => {
    const run = fakeRun({});
    const results = runValidation({ cwd: '/repo', run });
    expect((run as unknown as { calls: string[][] }).calls.map((c) => c.join(' '))).toEqual([
      'pnpm check-content',
      'pnpm check-i18n',
      'pnpm build',
    ]);
    expect(results.map((r) => r.name)).toEqual(['check-content', 'check-i18n', 'build']);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('failing command -> ok=false and does not stop later checks', () => {
    const run = fakeRun({ 'check-content': { status: 1, stdout: 'line1\nline2\nerror: H1 found' } });
    const results = runValidation({ cwd: '/repo', run });
    expect(results.find((r) => r.name === 'check-content')?.ok).toBe(false);
    expect(results.find((r) => r.name === 'build')?.ok).toBe(true);
  });

  it('summary keeps last 5 lines of combined output', () => {
    const stdout = Array.from({ length: 8 }, (_, i) => `line${i + 1}`).join('\n');
    const run = fakeRun({ 'check-content': { status: 0, stdout } });
    const results = runValidation({ cwd: '/repo', run });
    expect(results[0].summary.split('\n')).toEqual(['line4', 'line5', 'line6', 'line7', 'line8']);
  });

  it('null status (command missing) -> ok=false', () => {
    const run = fakeRun({ build: { status: null, stdout: '' } });
    const results = runValidation({ cwd: '/repo', run });
    expect(results.find((r) => r.name === 'build')?.ok).toBe(false);
  });
});

import { defaultRun, type CheckResult, type RunFn } from './content.js';

export interface AuditReport {
  checks: CheckResult[];
}

function lastLines(text: string, n = 5): string {
  const lines = text.trimEnd().split('\n');
  return lines.slice(Math.max(0, lines.length - n)).join('\n');
}

export function runAudit(opts: { cwd: string; run?: RunFn }): AuditReport {
  const run = opts.run ?? defaultRun;
  const checks: CheckResult[] = [];
  const names = ['refresh-audit', 'check-i18n', 'check-content', 'check-links'];
  for (const name of names) {
    const res = run('pnpm', [name], { cwd: opts.cwd });
    let summary = lastLines(`${res.stdout}\n${res.stderr}`.trim());
    if (name === 'check-links' && res.status !== 0 && /dist/i.test(res.stderr + res.stdout)) {
      summary = `${summary}\n(check-links audits dist/ — run \`pnpm build\` first for a full link audit)`;
    }
    checks.push({ name, ok: res.status === 0, summary });
  }
  return { checks };
}

export function formatAudit(report: AuditReport): string {
  const lines = ['# anvil-ops audit'];
  for (const c of report.checks) {
    lines.push(`## ${c.name} ${c.ok ? '[ok]' : '[FAIL]'}`);
    lines.push(c.summary || '(no output)');
    lines.push('');
  }
  const failed = report.checks.filter((c) => !c.ok).length;
  lines.push(failed === 0 ? 'All audit checks passed.' : `${failed} audit check(s) failed.`);
  return lines.join('\n') + '\n';
}

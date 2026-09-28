import { runAudit, formatAudit } from '../../core/audit.js';

export async function auditCommand(opts?: { cwd?: string }): Promise<number> {
  const report = runAudit({ cwd: opts?.cwd ?? process.cwd() });
  process.stdout.write(formatAudit(report));
  return report.checks.some((c) => !c.ok) ? 1 : 0;
}

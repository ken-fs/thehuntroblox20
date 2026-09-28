import { spawnSync } from 'node:child_process';

export type RunFn = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => { status: number | null; stdout: string; stderr: string };

export const defaultRun: RunFn = (cmd, args, opts) => {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    // Default 1MB truncates a busy `pnpm build` into a misleading failure.
    maxBuffer: 16 * 1024 * 1024,
    // A hung pnpm build must fail, not block submit/audit forever (Node sets
    // res.error = ETIMEDOUT and kills the child).
    timeout: 15 * 60_000,
    // pnpm on Windows is a .cmd shim (npm/corepack) and Node >= 18.20 refuses
    // .cmd shims without a shell. ONLY pnpm gets the shell: the args here are
    // fixed repo literals, while git/gh take free text (PR titles, bodies)
    // that must never be shell-interpreted.
    shell: process.platform === 'win32' && cmd === 'pnpm',
  });
  if (res.error) {
    const code = (res.error as NodeJS.ErrnoException).code;
    const detail =
      code === 'ENOENT'
        ? `${cmd} not found on PATH`
        : `${cmd} failed to spawn (${String(code ?? res.error.name)}): ${res.error.message}`;
    return { status: null, stdout: '', stderr: detail };
  }
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
};

export interface CheckResult {
  name: string;
  ok: boolean;
  summary: string;
}

function lastLines(text: string, n = 5): string {
  const lines = text.trimEnd().split('\n');
  return lines.slice(Math.max(0, lines.length - n)).join('\n');
}

function runCheck(name: string, args: string[], opts: { cwd: string; run?: RunFn }): CheckResult {
  const res = (opts.run ?? defaultRun)('pnpm', args, { cwd: opts.cwd });
  return {
    name,
    ok: res.status === 0,
    summary: lastLines(`${res.stdout}\n${res.stderr}`.trim()),
  };
}

// Runs to completion without short-circuiting: audit reports want the full
// picture, and submit decides on all().ok afterwards.
// check-i18n runs NON-strict here on purpose: the wiki's fallback design means
// a locale may legitimately have untranslated articles (detail pages fall
// back to English), so article-depth gating would fail every multi-locale
// repo. CI additionally runs `--strict-ui` (missing UI keys = template
// defect, must fail) — that mode is orthogonal to submit validation.
export function runValidation(opts: { cwd: string; run?: RunFn }): CheckResult[] {
  const run = opts.run ?? defaultRun;
  return [
    runCheck('check-content', ['check-content'], opts),
    runCheck('check-i18n', ['check-i18n'], opts),
    runCheck('build', ['build'], opts),
  ];
}

import { parentPort, workerData } from 'node:worker_threads';
import { runAudit, formatAudit } from '../core/audit.js';
import { submit } from '../core/gitops.js';
import { OpsError } from '../core/errors.js';
import type { OffloadMessage, OffloadResult } from './offload.js';

const errText = (e: unknown): string =>
  e instanceof OpsError ? `Error: ${e.message}\nFix: ${e.fix}` : `Error: ${String(e)}`;

const post = (result: OffloadResult): void => {
  parentPort?.postMessage(result);
};

try {
  const msg = workerData as OffloadMessage;
  if (msg.kind === 'audit') {
    post({ ok: true, text: formatAudit(runAudit({ cwd: msg.cwd })) });
  } else {
    const result = await submit({ cwd: msg.cwd, title: msg.title, base: msg.base });
    post({
      ok: true,
      text: `# PR opened\n\n- Branch: ${result.branch}\n- Pull request: ${result.prUrl}\n\nMerge after review; Cloudflare Pages deploys automatically.`,
    });
  }
} catch (e) {
  post({ ok: false, errorText: errText(e) });
}

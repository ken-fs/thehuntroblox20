import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadSiteConfig } from '../../core/site.js';
import { OpsError } from '../../core/errors.js';
import { parseAioCsv, formatAioCsv, aioArchivePath } from '../../core/aio-csv.js';

/**
 * `anvil-ops metrics --import-aio <csv>`: parse a GSC UI
 * "Search Generative AI performance report" CSV export (the gen-AI report is
 * UI/CSV-only — the API does not expose it) and print a metrics-style table.
 * With --save the CSV is archived into <site>/ops/ai-visibility/.
 */
export async function importAioCommand(opts: { cwd: string; csvPath: string; save?: boolean }): Promise<number> {
  let text: string;
  try {
    text = readFileSync(opts.csvPath, 'utf8');
  } catch (e) {
    throw new OpsError(
      `Cannot read CSV file ${opts.csvPath}: ${e instanceof Error ? e.message : String(e)}`,
      'Pass the path to the CSV exported from GSC (Performance > Search results > Search Generative AI performance report > Export).',
    );
  }
  const rows = parseAioCsv(text);
  if (opts.save) {
    const site = loadSiteConfig(opts.cwd);
    const dest = aioArchivePath(site.root);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(opts.csvPath, dest);
    process.stdout.write(`Saved: ${dest}\n`);
  }
  process.stdout.write(formatAioCsv(rows, opts.csvPath));
  if (rows.length === 0) {
    process.stdout.write('No rows found in the CSV (header only?).\n');
  }
  return 0;
}

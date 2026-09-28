import type { ListedSite } from '../core/sites.js';
import { OpsError } from '../core/errors.js';

/**
 * Runs one command across every registered site: a `== name (path) ==` section
 * per site, one site's failure never aborts the loop, summary at the end.
 * Returns the process exit code (0 only when every site reported 0).
 */
export async function runAcrossSites(
  sites: ListedSite[],
  runOne: (site: ListedSite) => Promise<number>,
  write: (s: string) => void = (s) => process.stdout.write(s),
): Promise<number> {
  let ok = 0;
  for (const site of sites) {
    write(`\n== ${site.name} (${site.path}) ==\n`);
    if (site.missing) {
      write(
        `Error: registered path does not exist.\nFix: point the site elsewhere or run \`anvil-ops sites remove ${site.name}\`.\n`,
      );
      continue;
    }
    try {
      if ((await runOne(site)) === 0) ok++;
    } catch (e) {
      if (e instanceof OpsError) write(`Error: ${e.message}\nFix: ${e.fix}\n`);
      else write(`Error: ${String(e)}\n`);
    }
  }
  write(`\n${ok}/${sites.length} site(s) ok.\n`);
  return ok === sites.length ? 0 : 1;
}

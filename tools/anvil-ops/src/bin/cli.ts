#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { doctorCommand } from '../cli/commands/doctor.js';
import { metricsCommand } from '../cli/commands/metrics.js';
import { auditCommand } from '../cli/commands/audit.js';
import { insightsCommand } from '../cli/commands/insights.js';
import { submitCommand } from '../cli/commands/submit.js';
import { sitesAddCommand, sitesListCommand, sitesRemoveCommand } from '../cli/commands/sites.js';
import { importAioCommand } from '../cli/commands/import-aio.js';
import { runAcrossSites } from '../cli/run-all.js';
import { listSites, resolveSitePath, sitesRegistryPath } from '../core/sites.js';
import { OpsError } from '../core/errors.js';
import { mergeSiteFlags, assertNotBothSiteAndAll, type SiteFlags } from '../cli/flags.js';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as {
  version: string;
};

const program = new Command();
program.name('anvil-ops').description('Ops toolkit for AnvilWiki fork sites').version(pkg.version);

// Multi-site flags are declared both here (before the subcommand) and on each
// supporting subcommand (after it), so `anvil-ops --site x doctor` and
// `anvil-ops doctor --site x` both work.
program
  .option('--site <name>', 'run against a registered site (anvil-ops sites list) instead of the cwd')
  .option('--all', 'run across every registered site (doctor/metrics/audit/insights only)');

const SITE_OPTION = ['--site <name>', 'run against a registered site (anvil-ops sites list) instead of the cwd'] as const;
const ALL_OPTION = ['--all', 'run across every registered site'] as const;

function mergedFlags(cmdOpts: SiteFlags): SiteFlags & { all: boolean } {
  return mergeSiteFlags(program.opts<SiteFlags>(), cmdOpts);
}

/** `sites` and `mcp` ignore the global --site/--all by design — say so instead
 *  of silently running against the wrong mental target. */
function rejectSiteFlagsFor(cmdName: string): void {
  const g = program.opts<SiteFlags>();
  if (g.site || g.all) {
    throw new OpsError(
      `--site/--all do not apply to \`${cmdName}\`.`,
      cmdName === 'mcp'
        ? 'The MCP server resolves the site per request (every tool takes its own `site` argument) — start it in the repo you want as default, or set defaultSite in the registry.'
        : 'The sites subcommands manage the registry itself; target a site via doctor/metrics/audit/insights/submit.',
    );
  }
}

type Target = { mode: 'single'; cwd: string } | { mode: 'all' };

function resolveTarget(cmdOpts: SiteFlags): Target {
  const { site, all } = mergedFlags(cmdOpts);
  assertNotBothSiteAndAll({ site, all });
  if (all) {
    const sites = listSites();
    if (sites.length === 0) {
      throw new OpsError(
        `No sites registered for --all (registry: ${sitesRegistryPath()}).`,
        'Add sites with `anvil-ops sites add <name> /absolute/path/to/repo`, or drop --all to use the cwd.',
      );
    }
    return { mode: 'all' };
  }
  return { mode: 'single', cwd: site ? resolveSitePath(site) : process.cwd() };
}

program
  .command('doctor')
  .description('Check site config, env credentials, gh, GSC and CF access')
  .option(...SITE_OPTION)
  .option(...ALL_OPTION)
  .action(async (opts: SiteFlags) => {
    const target = resolveTarget(opts);
    process.exitCode =
      target.mode === 'all'
        ? await runAcrossSites(listSites(), (s) => doctorCommand({ cwd: s.path }))
        : await doctorCommand({ cwd: target.cwd });
  });

program
  .command('metrics')
  .description('Pull GSC + Cloudflare Web Analytics metrics')
  .option('--days <n>', 'lookback window in days', '28')
  .option('--format <fmt>', 'output format: table | json | md', 'table')
  .option('--source <s>', 'limit to gsc | cf | all', 'all')
  .option('--import-aio <csv>', 'offline: parse a GSC "Search Generative AI performance report" CSV export instead of pulling APIs')
  .option('--save', 'with --import-aio: archive the CSV into <site>/ops/ai-visibility/')
  .option(...SITE_OPTION)
  .option(...ALL_OPTION)
  .action(async (opts: SiteFlags & { days: string; format: string; source: string; importAio?: string; save?: boolean }) => {
    if (!['table', 'json', 'md'].includes(opts.format)) {
      process.stderr.write(`Invalid --format "${opts.format}". Use table, json or md.\n`);
      process.exitCode = 1;
      return;
    }
    if (!['gsc', 'cf', 'all'].includes(opts.source)) {
      process.stderr.write(`Invalid --source "${opts.source}". Use gsc, cf or all.\n`);
      process.exitCode = 1;
      return;
    }
    const days = Number(opts.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      process.stderr.write('--days must be an integer between 1 and 365.\n');
      process.exitCode = 1;
      return;
    }
    if (opts.save && !opts.importAio) {
      process.stderr.write('--save requires --import-aio <csv>.\n');
      process.exitCode = 1;
      return;
    }
    if (opts.importAio) {
      const { site, all } = mergedFlags(opts);
      if (all) {
        process.stderr.write('--all is not supported with --import-aio. Import the CSV per site with --site <name>.\n');
        process.exitCode = 1;
        return;
      }
      process.exitCode = await importAioCommand({
        cwd: site ? resolveSitePath(site) : process.cwd(),
        csvPath: opts.importAio,
        save: opts.save,
      });
      return;
    }
    const target = resolveTarget(opts);
    process.exitCode =
      target.mode === 'all'
        ? await runAcrossSites(listSites(), (s) =>
            metricsCommand({
              cwd: s.path,
              days,
              format: opts.format as 'table' | 'json' | 'md',
              source: opts.source as 'gsc' | 'cf' | 'all',
            }),
          )
        : await metricsCommand({
            cwd: target.cwd,
            days,
            format: opts.format as 'table' | 'json' | 'md',
            source: opts.source as 'gsc' | 'cf' | 'all',
          });
  });

program
  .command('audit')
  .description('Aggregate template checks (refresh-audit / check-i18n / check-content / check-links) into one report')
  .option(...SITE_OPTION)
  .option(...ALL_OPTION)
  .action(async (opts: SiteFlags) => {
    const target = resolveTarget(opts);
    process.exitCode =
      target.mode === 'all'
        ? await runAcrossSites(listSites(), (s) => auditCommand({ cwd: s.path }))
        : await auditCommand({ cwd: target.cwd });
  });

program
  .command('insights')
  .description('Data-driven action list: GSC x CF rules + stale codes pages + AI Overviews probe (experimental)')
  .option('--days <n>', 'metrics lookback window in days', '28')
  .option(...SITE_OPTION)
  .option(...ALL_OPTION)
  .action(async (opts: SiteFlags & { days: string }) => {
    const days = Number(opts.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      process.stderr.write('--days must be an integer between 1 and 365.\n');
      process.exitCode = 1;
      return;
    }
    const target = resolveTarget(opts);
    process.exitCode =
      target.mode === 'all'
        ? await runAcrossSites(listSites(), (s) => insightsCommand({ cwd: s.path, days }))
        : await insightsCommand({ cwd: target.cwd, days });
  });

program
  .command('submit')
  .description('Validate changes, then branch + commit + push + open a PR (never pushes main)')
  .option('--title <t>', 'PR / commit title')
  .option('--base <b>', 'PR base branch', 'main')
  .option(...SITE_OPTION)
  .action(async (opts: SiteFlags & { title?: string; base?: string }) => {
    if (mergedFlags(opts).all) {
      process.stderr.write(
        'Error: submit does not support --all.\n' +
          'Fix: multi-site submit is unsafe (it would branch/commit/push/PR in several repos at once). Run submit per site with --site <name>.\n',
      );
      process.exitCode = 1;
      return;
    }
    const target = resolveTarget(opts);
    process.exitCode = await submitCommand({ cwd: target.mode === 'single' ? target.cwd : process.cwd(), title: opts.title, base: opts.base });
  });

const sites = program
  .command('sites')
  .description('Manage the multi-site registry (credentials never live here — each site reads its own .env)');

sites
  .command('list')
  .description('List registered sites (name / path / siteUrl / missing)')
  .action(() => {
    rejectSiteFlagsFor('sites list');
    process.exitCode = sitesListCommand();
  });

sites
  .command('add <name> <path>')
  .description('Register a site (path is resolved to absolute and must exist)')
  .option('--url <siteUrl>', 'optional siteUrl override (skips wrangler.toml/.env SITE_URL)')
  .action((name: string, path: string, opts: { url?: string }) => {
    rejectSiteFlagsFor('sites add');
    process.exitCode = sitesAddCommand({ name, path, url: opts.url });
  });

sites
  .command('remove <name>')
  .description('Remove a site from the registry')
  .action((name: string) => {
    rejectSiteFlagsFor('sites remove');
    process.exitCode = sitesRemoveCommand(name);
  });

program
  .command('mcp')
  .description('Start the anvil-ops MCP server on stdio (for Claude / ZCode / other MCP clients)')
  .action(async () => {
    rejectSiteFlagsFor('mcp');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const { buildServer } = await import('../mcp/server.js');
    const server = buildServer({ cwd: process.cwd() });
    await server.connect(new StdioServerTransport());
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  if (e instanceof OpsError) {
    process.stderr.write(`Error: ${e.message}\nFix: ${e.fix}\n`);
  } else {
    process.stderr.write(`Error: ${String(e)}\n`);
  }
  process.exitCode = 1;
});

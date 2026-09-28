import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OpsError } from './errors.js';

export interface AioCsvRow {
  page: string;
  impressions: number;
  clicks: number;
}

// GSC UI "Search Generative AI performance report" CSV export. Headers vary a
// little between exports, so columns are located by name (defensive) and the
// parser tolerates quotes, blank lines, CRLF and a UTF-8 BOM.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function toCount(cell: string): number {
  const n = Number(cell.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function findColumn(headers: string[], predicates: ((h: string) => boolean)[]): number {
  for (const p of predicates) {
    const idx = headers.findIndex(p);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseAioCsv(text: string): AioCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, '') // tolerate BOM
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    throw new OpsError(
      'AIO CSV is empty.',
      'Export from Google Search Console: Performance > Search results > Search Generative AI performance report > Export (CSV), then pass the file to `anvil-ops metrics --import-aio <csv>`.',
    );
  }
  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const pageIdx = findColumn(headers, [(h) => h === 'page', (h) => h === 'page path', (h) => h.includes('page')]);
  const imprIdx = findColumn(headers, [(h) => h === 'impressions', (h) => h.includes('impress')]);
  const clicksIdx = headers.findIndex((h) => h === 'clicks');
  if (pageIdx === -1 || imprIdx === -1) {
    throw new OpsError(
      `AIO CSV is missing the "${pageIdx === -1 ? 'Page' : 'Impressions'}" column (found headers: ${headers.join(', ')}).`,
      'Use the CSV exported from GSC\'s Search Generative AI performance report, not another report. Column names: Page, Impressions (Clicks optional).',
    );
  }
  const rows: AioCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const page = cells[pageIdx] ?? '';
    if (!page) continue;
    rows.push({
      page,
      impressions: toCount(cells[imprIdx] ?? '0'),
      clicks: clicksIdx === -1 ? 0 : toCount(cells[clicksIdx] ?? '0'),
    });
  }
  return rows.sort((a, b) => b.impressions - a.impressions || a.page.localeCompare(b.page));
}

export function aioArchivePath(siteRoot: string, now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const base = join(siteRoot, 'ops', 'ai-visibility', `${stamp}-aio.csv`);
  if (!existsSync(base)) return base;
  // Two imports on the same day must not silently clobber each other —
  // keep the first archive and suffix the rest (-2, -3, …).
  for (let i = 2; i < 100; i++) {
    const candidate = base.replace(/\.csv$/, `-${i}.csv`);
    if (!existsSync(candidate)) return candidate;
  }
  return base.replace(/\.csv$/, `-${now.getTime()}.csv`);
}

function pad(cell: string, width: number): string {
  return cell + ' '.repeat(Math.max(0, width - cell.length));
}

export function formatAioCsv(rows: AioCsvRow[], source: string): string {
  const lines: string[] = [`AI Overviews — imported from ${source} (experimental, GSC UI export)`];
  lines.push('');
  lines.push([pad('page', 60), pad('impressions', 12), 'clicks'].join(' '));
  for (const r of rows.slice(0, 25)) {
    lines.push([pad(r.page.slice(0, 59), 60), pad(String(r.impressions), 12), r.clicks].join(' '));
  }
  lines.push('');
  lines.push(
    `total impressions=${rows.reduce((s, r) => s + r.impressions, 0)} clicks=${rows.reduce((s, r) => s + r.clicks, 0)}`,
  );
  return lines.join('\n').trim() + '\n';
}

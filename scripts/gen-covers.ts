/**
 * gen-covers — generate og:image covers for wiki articles (v2.0).
 *
 * Usage:
 *   pnpm gen-covers                    # articles WITHOUT a cover (PNG + wires frontmatter)
 *   pnpm gen-covers --all              # also refresh covers this script generated before
 *   pnpm gen-covers --force            # ignore the manifest cache
 *   pnpm gen-covers --out <dir>        # render elsewhere — frontmatter is NOT touched
 *   pnpm gen-covers --fonts-dir <dir>  # offline source for Noto CJK OTFs (see below)
 *
 * Covers are 1200×675 PNGs (og:image standard since v2.0: Google Discover
 * large-image previews need ≥1200px width) rendered with satori + resvg.
 *
 * Fonts:
 *   - Latin: bundled OFL Lato (scripts/fonts/) — deterministic, no network.
 *   - CJK titles: Noto Sans SC/JP. Full OTFs (~16MB each) are NOT committed;
 *     they download once into node_modules/.cache/gen-covers/fonts/ (or use
 *     --fonts-dir with pre-downloaded files) and are subset per title with
 *     subset-font (60–200KB per render) — satori only accepts TTF/OTF.
 *
 * Cache: <out>/.gen-covers-manifest.json maps filename → hash(title + brand +
 * size). Unchanged entries are skipped; --force regenerates everything.
 *
 * Frontmatter wiring (only when writing to the default covers dir and the
 * article has no `image:` yet): inserts `image: '<relative path>'` after the
 * `category:` line so the Zod image() helper picks the PNG up on next build.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import subsetFont from 'subset-font';
import { site } from '~/config/site';
import {
  coverFilename,
  hslToHex,
  parseBrandHsl,
  pickCjkScript,
  pickFontSize,
  spliceImageIntoFrontmatter,
  stableHash,
  stripEmoji,
  subsetText,
} from '~/lib/covers';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 675;
const CONTENT_DIR = join(root, 'src/content/wiki');
const COVERS_DIR = join(root, 'src/assets/covers');
/**
 * FORK ADDITION (thehuntroblox20): official-art brand assets.
 *
 * `cover-bg.png` is the game's own promotional thumbnail and `<category>-<slug>.png`
 * are the game's own badge icons (one per article, keyed by topic) — both fetched
 * from Roblox's public thumbnail API, so they are the developer's assets rather
 * than anything scraped from a third-party wiki. Text-only covers read as
 * low-trust next to real screenshots; these make every card show actual game art.
 *
 * Both are OPTIONAL: with neither present the renderer falls back to the original
 * gradient cover, so a fork that deletes this folder still builds.
 *
 * Resolution order for the BACKGROUND:
 *   <category>-<slug>-bg.png  →  cover-bg.png  →  built-in gradient
 * A game with several official screenshots can therefore give each article its
 * own backdrop, while a game with only one (or none) just shares the fallback.
 * The ICON is always <category>-<slug>.png, with no shared fallback.
 */
const BRAND_DIR = join(root, 'src/assets/brand');
const COVER_BG = join(BRAND_DIR, 'cover-bg.png');
const FONT_CACHE = join(root, 'node_modules/.cache/gen-covers/fonts');
const MANIFEST_VERSION = 1;

const NOTO_BASE = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF';
// Per-locale merged CJK fonts (NotoSansCJKjp/sc, ~16MB each) — family names
// must match the internal font family satori matches on.
const NOTO_VARIANTS = {
  ja: { region: 'Japanese', family: 'Noto Sans CJK JP', prefix: 'NotoSansCJKjp' },
  zh: { region: 'SimplifiedChinese', family: 'Noto Sans CJK SC', prefix: 'NotoSansCJKsc' },
} as const;

type Script = keyof typeof NOTO_VARIANTS;
interface Article {
  id: string;
  absPath: string;
  locale: string;
  title: string;
  hasImage: boolean;
  draft: boolean;
}

// --- CLI ---------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ALL = flag('all');
const FORCE = flag('force');
const OUT_DIR = opt('out') ? resolve(opt('out') as string) : COVERS_DIR;
const FONTS_DIR = opt('fonts-dir') ? resolve(opt('fonts-dir') as string) : undefined;
const WIRE_FRONTMATTER = OUT_DIR === COVERS_DIR;

// --- content scanning ----------------------------------------------------------

function listMdxFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) listMdxFiles(p, acc);
    else if (name.name.endsWith('.mdx')) acc.push(p);
  }
  return acc;
}

/** Minimal frontmatter read — same split-on-'---' approach as refresh-audit. */
function fmValue(fm: string, key: string): string | undefined {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!m) return undefined;
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

function collectArticles(): Article[] {
  return listMdxFiles(CONTENT_DIR).map((absPath) => {
    const src = readFileSync(absPath, 'utf8');
    const fm = src.split('---')[1] ?? '';
    // Normalize win32 separators before splitting: path.relative yields
    // backslashes there, and locale/coverFilename both split on '/'.
    const rel = relative(CONTENT_DIR, absPath)
      .split('\\')
      .join('/')
      .replace(/\.mdx$/, '');
    const [locale] = rel.split('/');
    return {
      id: rel,
      absPath,
      locale,
      title: fmValue(fm, 'title') ?? rel,
      hasImage: /^image:/m.test(fm),
      draft: /^draft:\s*true/m.test(fm),
    };
  });
}

// --- fonts ---------------------------------------------------------------------

interface SatoriFont {
  name: string;
  data: Buffer;
  /** satori's weight type is a literal union (100–900). */
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: 'normal';
}

function readLatinFonts(): SatoriFont[] {
  return (
    [
      ['Lato-Regular.ttf', 400],
      ['Lato-Bold.ttf', 700],
    ] as const
  ).map(([file, weight]) => ({
    name: 'Lato',
    data: readFileSync(join(root, 'scripts/fonts', file)),
    weight,
    style: 'normal' as const,
  }));
}

async function ensureNotoOtf(script: Script, weight: 'Regular' | 'Bold'): Promise<Buffer> {
  const v = NOTO_VARIANTS[script];
  const file = `${v.prefix}-${weight}.otf`;
  const candidates = [FONTS_DIR, FONT_CACHE].filter(Boolean) as string[];
  for (const dir of candidates) {
    const p = join(dir, file);
    if (existsSync(p)) return readFileSync(p);
  }
  const url = `${NOTO_BASE}/${v.region}/${file}`;
  console.log(`  downloading ${file} (~16MB, cached for future runs) …`);
  // AbortSignal — without it a stalled connection hangs the script forever.
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    throw new Error(
      `${url} → HTTP ${res.status}. Offline? Pre-download ${file} into a dir and pass --fonts-dir <dir>.`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000) throw new Error(`${file} looks truncated (${buf.length} bytes) — not cached.`);
  mkdirSync(FONT_CACHE, { recursive: true });
  writeFileSync(join(FONT_CACHE, file), buf);
  return buf;
}

async function subsetNoto(script: Script, glyphs: string): Promise<SatoriFont[]> {
  const v = NOTO_VARIANTS[script];
  const full = {
    400: await ensureNotoOtf(script, 'Regular'),
    700: await ensureNotoOtf(script, 'Bold'),
  };
  return Promise.all(
    (
      [
        [400, full[400]],
        [700, full[700]],
      ] as const
    ).map(async ([weight, buffer]) => ({
      name: v.family,
      weight,
      style: 'normal' as const,
      data: await subsetFont(buffer, glyphs, { targetFormat: 'sfnt' }),
    })),
  );
}

// --- rendering -------------------------------------------------------------------

interface Element {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: unknown;
    [key: string]: unknown;
  };
}

function el(type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Element {
  return { type, props: { ...extra, style, ...(children !== undefined ? { children } : {}) } };
}

function coverElement(opts: {
  title: string;
  fontSize: number;
  brandHex: string;
  brandDeepHex: string;
  lang: string;
  fontFamily: string;
  bgUri?: string;
  iconUri?: string;
}): Element {
  const shortName = site.shortName.toUpperCase();
  // With official art behind the text, the gradient turns into a legibility
  // scrim: dark enough at the left for the title, lighter at the right so the
  // screenshot still reads as a screenshot.
  const backgroundImage = opts.bgUri
    ? `linear-gradient(100deg, rgba(9,12,19,0.95) 0%, rgba(11,15,23,0.88) 42%, rgba(15,19,28,0.62) 100%), url(${opts.bgUri})`
    : `linear-gradient(135deg, #0f131c 0%, #151b28 55%, ${opts.brandDeepHex} 100%)`;
  return el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px 72px 64px 96px',
      backgroundImage,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      position: 'relative',
      fontFamily: opts.fontFamily,
      backgroundColor: '#0f131c',
    },
    [
      // Brand accent bar — the only brand-colored surface on the cover.
      el('div', { position: 'absolute', left: 0, top: 0, bottom: 0, width: '14px', backgroundColor: opts.brandHex }),
      // Top row: wiki short name, with the article's topic icon opposite it.
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
        el(
          'div',
          {
            fontSize: '30px',
            fontWeight: 700,
            color: opts.brandHex,
            letterSpacing: '6px',
          },
          shortName,
        ),
        opts.iconUri
          ? el('img', { borderRadius: '18px', opacity: 0.95 }, undefined, {
              src: opts.iconUri,
              width: 128,
              height: 128,
            })
          : el('div', { display: 'flex' }),
      ]),
      // Title — sized by pickFontSize to stay within ~2 lines.
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          flexGrow: 1,
          paddingTop: '24px',
          paddingBottom: '24px',
        },
        el(
          'div',
          {
            fontSize: `${opts.fontSize}px`,
            fontWeight: 700,
            color: '#f8fafc',
            lineHeight: 1.18,
            maxWidth: '900px',
            textWrap: 'balance',
            textShadow: '0 2px 18px rgba(0,0,0,0.55)',
          },
          opts.title,
        ),
      ),
      // Bottom row: game name · domain.
      el('div', { display: 'flex', alignItems: 'center', gap: '18px' }, [
        el('div', { width: '46px', height: '5px', backgroundColor: opts.brandHex, borderRadius: '3px' }),
        el(
          'div',
          { fontSize: '26px', color: '#cbd5e1', letterSpacing: '1px' },
          `${site.game.name}  ·  ${site.domain}`,
        ),
      ]),
    ],
    { lang: opts.lang },
  );
}

async function renderCover(article: Article, brandHex: string, brandDeepHex: string): Promise<Buffer> {
  const title = stripEmoji(article.title);
  if (title !== article.title) console.warn(`  ⚠ stripped emoji from "${article.title}"`);
  const script = pickCjkScript(article.locale, title);
  const fonts: SatoriFont[] = readLatinFonts();
  let fontFamily = 'Lato';
  let lang = 'en';
  if (script) {
    const glyphs = subsetText(title, site.shortName, site.game.name);
    fonts.push(...(await subsetNoto(script, glyphs)));
    fontFamily = `Lato, ${NOTO_VARIANTS[script].family}`;
    lang = script === 'ja' ? 'ja-JP' : 'zh-CN';
  }
  // Official art (optional). article.id is "<locale>/<category>/<slug>", so the
  // brand files are "<category>-<slug>-bg.png" (per-article backdrop, falling
  // back to the shared cover-bg.png) and "<category>-<slug>.png" (topic icon).
  const brandKey = article.id.split('/').slice(1).join('-');
  const bgUri = dataUri(join(BRAND_DIR, `${brandKey}-bg.png`)) ?? dataUri(COVER_BG);
  const iconUri = dataUri(join(BRAND_DIR, `${brandKey}.png`));
  const element = coverElement({
    title,
    fontSize: pickFontSize(title),
    brandHex,
    brandDeepHex,
    lang,
    fontFamily,
    bgUri,
    iconUri,
  });
  const svg = await satori(element as unknown as Parameters<typeof satori>[0], {
    width: W,
    height: H,
    fonts,
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

/** Read a PNG as a data URI for satori. Missing file → undefined (caller falls back). */
function dataUri(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

// --- frontmatter wiring ------------------------------------------------------------

function wireFrontmatter(mdxPath: string, imageRelPath: string): boolean {
  const src = readFileSync(mdxPath, 'utf8');
  const updated = spliceImageIntoFrontmatter(src, imageRelPath);
  if (updated === null) return false;
  // Atomic replace (same dir + rename): a crash mid-write must never leave a
  // truncated MDX behind — same contract as sync-codes.
  const tmpPath = `${mdxPath}.tmp`;
  writeFileSync(tmpPath, updated, 'utf8');
  renameSync(tmpPath, mdxPath);
  return true;
}

// --- main ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(CONTENT_DIR)) {
    console.error('No src/content/wiki — run from the repo root.');
    process.exit(1);
  }
  const css = readFileSync(join(root, 'src/styles/globals.css'), 'utf8');
  const brand = parseBrandHsl(css);
  if (!brand) {
    console.error('Could not parse --brand from src/styles/globals.css.');
    process.exit(1);
  }
  const brandHex = hslToHex(brand.h, brand.s, brand.l);
  const brandDeepHex = hslToHex(brand.h, brand.s, 20);

  const articles = collectArticles().filter((a) => !a.draft);
  const manifestPath = join(OUT_DIR, '.gen-covers-manifest.json');
  let manifest: { version: number; entries: Record<string, string> } = { version: MANIFEST_VERSION, entries: {} };
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      console.warn('manifest unreadable — regenerating all covers.');
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let generated = 0;
  let skipped = 0;
  let wired = 0;

  for (const article of articles) {
    const ours = manifest.entries[coverFilename(article.id)] !== undefined;
    // Custom --out is a preview run: render everything (frontmatter untouched).
    const eligible = !WIRE_FRONTMATTER || !article.hasImage || (ALL && ours);
    if (!eligible) continue;

    const file = coverFilename(article.id);
    const key = stableHash(
      `${article.title}|${site.shortName}|${site.game.name}|${brandHex}|${W}x${H}|v${MANIFEST_VERSION}`,
    );
    if (!FORCE && manifest.entries[file] === key && existsSync(join(OUT_DIR, file))) {
      skipped++;
      continue;
    }

    console.log(`▸ ${file} — ${article.title}`);
    const png = await renderCover(article, brandHex, brandDeepHex);
    writeFileSync(join(OUT_DIR, file), png);
    manifest.entries[file] = key;
    generated++;

    if (WIRE_FRONTMATTER && !article.hasImage) {
      const absCover = join(COVERS_DIR, file);
      const relFromMdx = relative(dirname(article.absPath), absCover).split('\\').join('/');
      if (wireFrontmatter(article.absPath, relFromMdx)) {
        wired++;
        console.log('  wired frontmatter image');
      }
    }
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nDone: ${generated} generated, ${skipped} cached, ${wired} wired → ${relative(root, OUT_DIR)}`);
  if (!WIRE_FRONTMATTER) console.log('(custom --out: frontmatter untouched)');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

# anvilwiki-ops P1(core + CLI)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `tools/anvil-ops/` 建立独立 npm 包 `anvilwiki-ops` 的 core + CLI:site 发现、doctor 体检、metrics(GSC + CF Web Analytics 双 provider),全量单测,可 `npx tsx` 本地跑通。

**Architecture:** core 层(env/site/providers/doctor/metrics)不知道 CLI 存在;providers 拆成「纯解析函数(单测)+ 薄 IO 客户端(dogfood 验收)」;CLI 是 commander 薄壳。与根仓库完全隔离(独立 package.json/node_modules/tsconfig,根 tsconfig+eslint 排除 `tools/**`)。

**Tech Stack:** TypeScript(NodeNext,Node ≥22 原生 fetch)、commander 13、dotenv 16、smol-toml 1、google-auth-library 9、vitest 4。

**Spec:** `docs/superpowers/specs/2026-08-18-anvil-ops-cli-mcp-design.md`(本计划只覆盖 §10 的 P1;P2 MCP、P3 insights/submit、P4 文档发布不在本计划)。

## Global Constraints

- 包名 `anvilwiki-ops`,仓内路径 `tools/anvil-ops/`,独立 semver(0.x),与根 package.json 零依赖关系。
- Node ≥22(`engines.node`);ESM(`"type": "module"`);不用任何 JS 框架/运行时改动模板 `src/`。
- env 门控:空 = 功能禁用不报错;`GSC_SERVICE_ACCOUNT_JSON` 以 `{` 开头 = 内联 JSON,否则 = 文件路径。
- 包内零硬编码 key/域名;site tag 从 `wrangler.toml [vars]` 的 `PUBLIC_CF_BEACON_TOKEN` 读,域名从 `SITE_URL` 读。
- 错误输出必须含「哪一步 + 什么原因 + 跑什么命令修」,非零退出码。
- 根仓库的 `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` 在每个 task 结束时必须保持绿(tools 不许污染根 CI)。
- 每个 task 结束 commit;测试先行(TDD)。

## 文件结构(全部新建,除 Task 1 改根配置)

```
tools/anvil-ops/
├── package.json          # 独立包;bin: anvil-ops → dist/bin/cli.js
├── tsconfig.json         # NodeNext + strict + outDir dist + include src
├── vitest.config.ts      # node env,include test/**/*.test.ts
├── .gitignore            # node_modules/ dist/
├── README.md             # P1 版:命令表 + env 契约(Task 9)
├── src/
│   ├── bin/cli.ts        # bin 入口:commander program
│   ├── cli/commands/doctor.ts    # 薄壳:cwd → runDoctor → 打印
│   ├── cli/commands/metrics.ts   # 薄壳:flags → collectMetrics → formatMetrics → 打印
│   └── core/
│       ├── env.ts        # loadOpsEnv(.env 解析 + SA JSON 内联/路径判别)
│       ├── site.ts       # loadSiteConfig(找 wrangler.toml,读 [vars])
│       ├── metrics.ts    # collectMetrics + formatMetrics(table/json/md)
│       ├── doctor.ts     # runDoctor + formatDoctor
│       ├── errors.ts     # OpsError(带 fix 指引)
│       └── providers/
│           ├── gsc.ts         # parseGscResponse + createGscClient
│           └── cloudflare.ts  # parseCfResponse + queryCloudflare
└── test/
    ├── fixtures/wrangler-*.toml、gsc-response.json、cf-response.json、env-*.txt
    └── env.test.ts、site.test.ts、gsc.test.ts、cloudflare.test.ts、metrics.test.ts、doctor.test.ts
```

Task 1 同时修改:`tsconfig.json`(根,exclude 加 `tools`)、`eslint.config.js`(ignores 加 `tools/**`)。

---

### Task 1: 包脚手架 + 根仓库隔离

**Files:**
- Create: `tools/anvil-ops/package.json`、`tsconfig.json`、`vitest.config.ts`、`.gitignore`、`test/smoke.test.ts`
- Modify: `/tsconfig.json`(根)、`/eslint.config.js`

**Interfaces:**
- Consumes: 无(第一个 task)
- Produces: 可 `pnpm -C tools/anvil-ops test` 的空包;根 CI 不受影响

- [ ] **Step 1: 创建包文件**

`tools/anvil-ops/package.json`:

```json
{
  "name": "anvilwiki-ops",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Ops CLI + MCP server for AnvilWiki fork sites: metrics, SEO insights, PR-gated publishing.",
  "license": "MIT",
  "engines": { "node": ">=22.0.0" },
  "bin": { "anvil-ops": "dist/bin/cli.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "commander": "^13.1.0",
    "dotenv": "^16.4.5",
    "google-auth-library": "^9.15.1",
    "smol-toml": "^1.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^4.1.10"
  }
}
```

`tools/anvil-ops/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

`tools/anvil-ops/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
```

`tools/anvil-ops/.gitignore`:

```
node_modules/
dist/
```

`tools/anvil-ops/test/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('scaffold', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: 隔离根仓库配置**

根 `tsconfig.json` 的 `"exclude": ["dist"]` 改为 `"exclude": ["dist", "tools"]`(根 astro check 不得扫 tools/)。
根 `eslint.config.js` 的 ignores 行改为:

```js
ignores: ['dist/**', 'node_modules/**', '.astro/**', '*.config.{js,ts,mjs}', 'tools/**'],
```

- [ ] **Step 3: 安装并验证包测试 + 根仓库四绿**

```bash
cd tools/anvil-ops && pnpm install && pnpm test
cd ../.. && pnpm typecheck && pnpm lint && pnpm test
```

Expected: tools 包 1 test passed;根四命令全绿无新告警。

- [ ] **Step 4: Commit**

```bash
git add tools/anvil-ops tsconfig.json eslint.config.js pnpm-lock.yaml
git commit -m "feat(ops): scaffold anvilwiki-ops package + isolate root configs"
```

---

### Task 2: errors.ts + env.ts(ops env 加载)

**Files:**
- Create: `src/core/errors.ts`、`src/core/env.ts`
- Test: `test/env.test.ts`、fixtures `test/fixtures/env-basic.txt`、`env-inline-gsc.txt`、`env-broken-gsc.txt`

**Interfaces:**
- Produces(后续 task 全依赖):

```ts
// errors.ts
export class OpsError extends Error {
  constructor(message: string, public readonly fix: string) { super(message); this.name = 'OpsError'; }
}

// env.ts
export interface GscCredential { clientEmail: string; privateKey: string }
export interface OpsEnv {
  gscServiceAccount?: GscCredential;   // 三者均可缺省 = 对应功能禁用
  cfApiToken?: string;
  cfAccountId?: string;
}
export interface OpsEnvResolution extends OpsEnv {
  problems: string[];  // 每条已含修复指引,doctor/metrics 直接展示
}
export function loadOpsEnv(cwd: string): OpsEnvResolution
```

- [ ] **Step 1: 写失败测试**

`test/env.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOpsEnv } from '../src/core/env.js';

const SA = JSON.stringify({
  client_email: 'sa@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
});

function tmpWith(dotenv: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-env-'));
  writeFileSync(join(dir, '.env'), dotenv);
  return dir;
}

describe('loadOpsEnv', () => {
  it('parses file-path style GSC_SERVICE_ACCOUNT_JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-env-'));
    writeFileSync(join(dir, 'sa.json'), SA);
    writeFileSync(join(dir, '.env'), `GSC_SERVICE_ACCOUNT_JSON=sa.json\nCF_API_TOKEN=tok\nCF_ACCOUNT_ID=acc\n`);
    const r = loadOpsEnv(dir);
    expect(r.gscServiceAccount?.clientEmail).toBe('sa@project.iam.gserviceaccount.com');
    expect(r.cfApiToken).toBe('tok');
    expect(r.cfAccountId).toBe('acc');
    expect(r.problems).toEqual([]);
  });

  it('parses inline JSON (value starts with {)', () => {
    const dir = tmpWith(`GSC_SERVICE_ACCOUNT_JSON='${SA}'\n`);
    const r = loadOpsEnv(dir);
    expect(r.gscServiceAccount?.privateKey).toContain('PRIVATE KEY');
    expect(r.problems).toEqual([]);
  });

  it('empty env = all features disabled, no problems', () => {
    const r = loadOpsEnv(tmpWith(''));
    expect(r.gscServiceAccount).toBeUndefined();
    expect(r.cfApiToken).toBeUndefined();
    expect(r.problems).toEqual([]);
  });

  it('missing SA file / broken JSON become problems with fix guidance', () => {
    const missing = loadOpsEnv(tmpWith('GSC_SERVICE_ACCOUNT_JSON=nope.json\n'));
    expect(missing.problems[0]).toMatch(/nope\.json/);
    expect(missing.problems[0]).toMatch(/anvil-ops doctor/);

    const dir = mkdtempSync(join(tmpdir(), 'ops-env-'));
    writeFileSync(join(dir, 'sa.json'), '{ not json');
    writeFileSync(join(dir, '.env'), 'GSC_SERVICE_ACCOUNT_JSON=sa.json\n');
    const broken = loadOpsEnv(dir);
    expect(broken.problems.length).toBeGreaterThan(0);
    expect(broken.gscServiceAccount).toBeUndefined();
  });

  it('SA JSON missing required keys becomes a problem', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-env-'));
    writeFileSync(join(dir, 'sa.json'), JSON.stringify({ foo: 1 }));
    writeFileSync(join(dir, '.env'), 'GSC_SERVICE_ACCOUNT_JSON=sa.json\n');
    const r = loadOpsEnv(dir);
    expect(r.problems[0]).toMatch(/client_email|private_key/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C tools/anvil-ops test`
Expected: FAIL — `Cannot find module '../src/core/env.js'`

- [ ] **Step 3: 最小实现**

`src/core/errors.ts`:

```ts
export class OpsError extends Error {
  constructor(
    message: string,
    public readonly fix: string,
  ) {
    super(message);
    this.name = 'OpsError';
  }
}
```

`src/core/env.ts`:

```ts
import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { parse } from 'dotenv';

export interface GscCredential {
  clientEmail: string;
  privateKey: string;
}

export interface OpsEnv {
  gscServiceAccount?: GscCredential;
  cfApiToken?: string;
  cfAccountId?: string;
}

export interface OpsEnvResolution extends OpsEnv {
  problems: string[];
}

interface RawServiceAccount {
  client_email?: string;
  private_key?: string;
}

function parseServiceAccount(raw: string, problems: string[]): GscCredential | undefined {
  let parsed: RawServiceAccount;
  try {
    parsed = JSON.parse(raw) as RawServiceAccount;
  } catch {
    problems.push(
      'GSC_SERVICE_ACCOUNT_JSON is not valid JSON. Re-download the key file from Google Cloud (IAM > Service Accounts > Keys) and set it again. Run `anvil-ops doctor` to re-check.',
    );
    return undefined;
  }
  if (!parsed.client_email || !parsed.private_key) {
    problems.push(
      'GSC_SERVICE_ACCOUNT_JSON is missing client_email or private_key. Use the key JSON downloaded from Google Cloud IAM, not another file. Run `anvil-ops doctor` to re-check.',
    );
    return undefined;
  }
  return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
}

export function loadOpsEnv(cwd: string): OpsEnvResolution {
  const problems: string[] = [];
  const result: OpsEnvResolution = { problems };

  let parsed: Record<string, string> = {};
  try {
    parsed = parse(readFileSync(join(cwd, '.env'), 'utf8'));
  } catch {
    return result; // no .env = everything disabled, not an error (doctor reports it)
  }

  const gscRaw = parsed['GSC_SERVICE_ACCOUNT_JSON']?.trim();
  if (gscRaw) {
    const raw = gscRaw.startsWith('{')
      ? gscRaw
      : readFileSync(resolve(cwd, gscRaw), 'utf8').catch(() => {
          problems.push(
            `GSC_SERVICE_ACCOUNT_JSON points to a missing file (${gscRaw} relative to ${cwd}). Fix the path or switch to inline JSON. Run \`anvil-ops doctor\` to re-check.`,
          );
          return undefined as string | undefined;
        }) as string | undefined;
    // readFileSync does not return a promise; use existsSync + explicit read instead
    if (raw !== undefined) {
      const sa = parseServiceAccount(raw, problems);
      if (sa) result.gscServiceAccount = sa;
    }
  }

  if (parsed['CF_API_TOKEN']) result.cfApiToken = parsed['CF_API_TOKEN'];
  if (parsed['CF_ACCOUNT_ID']) result.cfAccountId = parsed['CF_ACCOUNT_ID'];
  return result;
}
```

注意:上面 `.catch` 写法不对——`readFileSync` 是同步的。实现时改用:

```ts
import { existsSync } from 'node:fs';
// ...
let raw: string | undefined;
if (gscRaw.startsWith('{')) {
  raw = gscRaw;
} else {
  const p = isAbsolute(gscRaw) ? gscRaw : join(cwd, gscRaw);
  if (!existsSync(p)) {
    problems.push(
      `GSC_SERVICE_ACCOUNT_JSON points to a missing file (${p}). Fix the path or paste the JSON inline. Run \`anvil-ops doctor\` to re-check.`,
    );
  } else {
    raw = readFileSync(p, 'utf8');
  }
}
if (raw !== undefined) {
  const sa = parseServiceAccount(raw, problems);
  if (sa) result.gscServiceAccount = sa;
}
```

(以这个同步版本为准;前一段代码块中的异步写法作废。)

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm -C tools/anvil-ops test`
Expected: PASS(env.test.ts 5 cases + smoke)

- [ ] **Step 5: 根仓库回归 + Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add tools/anvil-ops
git commit -m "feat(ops): loadOpsEnv with inline/path service-account detection"
```

---

### Task 3: site.ts(仓库根发现 + wrangler.toml 解析)

**Files:**
- Create: `src/core/site.ts`
- Test: `test/site.test.ts` + fixtures `test/fixtures/wrangler-full.toml`、`wrangler-minimal.toml`

**Interfaces:**
- Consumes: `OpsError`(Task 2)
- Produces:

```ts
export interface SiteConfig {
  root: string;            // 仓库根(wrangler.toml 所在目录)的绝对路径
  siteUrl?: string;        // SITE_URL,已去尾斜杠
  cfBeaconToken?: string;  // PUBLIC_CF_BEACON_TOKEN
}
export function loadSiteConfig(startDir: string): SiteConfig
```

- [ ] **Step 1: fixtures**

`test/fixtures/wrangler-full.toml`:

```toml
name = "anvilwiki"
compatibility_date = "2026-01-01"

[vars]
SITE_URL = "https://wiki.example.com/"
PUBLIC_CF_BEACON_TOKEN = "beacon123"
```

`test/fixtures/wrangler-minimal.toml`:

```toml
name = "anvilwiki"
compatibility_date = "2026-01-01"
```

- [ ] **Step 2: 写失败测试**

`test/site.test.ts`:

```ts
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSiteConfig } from '../src/core/site.js';

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'ops-site-'));
}

describe('loadSiteConfig', () => {
  it('reads [vars] from wrangler.toml in the given dir and strips trailing slash', () => {
    const dir = tmpDir();
    copyFileSync('test/fixtures/wrangler-full.toml', join(dir, 'wrangler.toml'));
    const cfg = loadSiteConfig(dir);
    expect(cfg.root).toBe(dir);
    expect(cfg.siteUrl).toBe('https://wiki.example.com');
    expect(cfg.cfBeaconToken).toBe('beacon123');
  });

  it('walks up parent dirs to find wrangler.toml', () => {
    const dir = tmpDir();
    copyFileSync('test/fixtures/wrangler-minimal.toml', join(dir, 'wrangler.toml'));
    const nested = join(dir, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    const cfg = loadSiteConfig(nested);
    expect(cfg.root).toBe(dir);
    expect(cfg.siteUrl).toBeUndefined();
    expect(cfg.cfBeaconToken).toBeUndefined();
  });

  it('empty beacon token string = undefined (env-gated)', () => {
    const dir = tmpDir();
    copyFileSync('test/fixtures/wrangler-full.toml', join(dir, 'wrangler.toml'));
    // beacon is set in full fixture; use minimal + custom content
    const { writeFileSync } = await import('node:fs');
    writeFileSync(
      join(dir, 'wrangler.toml'),
      '[vars]\nSITE_URL = "https://x.com"\nPUBLIC_CF_BEACON_TOKEN = ""\n',
    );
    const cfg = loadSiteConfig(dir);
    expect(cfg.cfBeaconToken).toBeUndefined();
  });

  it('no wrangler.toml anywhere = OpsError with fix guidance', () => {
    const dir = tmpDir();
    expect(() => loadSiteConfig(dir)).toThrow(/wrangler\.toml/);
  });
});
```

注意第 3 个 case 用了顶层 `await import`,把 `writeFileSync` 直接加到顶部 import 更简单——实现时统一为顶部 `import { writeFileSync } from 'node:fs'`。

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm -C tools/anvil-ops test -- site`
Expected: FAIL — module not found

- [ ] **Step 4: 实现**

`src/core/site.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'smol-toml';
import { OpsError } from './errors.js';

export interface SiteConfig {
  root: string;
  siteUrl?: string;
  cfBeaconToken?: string;
}

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export function loadSiteConfig(startDir: string): SiteConfig {
  let dir = resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'wrangler.toml'))) {
      const parsed = parse(readFileSync(join(dir, 'wrangler.toml'), 'utf8')) as {
        vars?: Record<string, string>;
      };
      const vars = parsed.vars ?? {};
      return {
        root: dir,
        siteUrl: clean(vars['SITE_URL'])?.replace(/\/+$/, ''),
        cfBeaconToken: clean(vars['PUBLIC_CF_BEACON_TOKEN']),
      };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new OpsError(
    'No wrangler.toml found (searched up from ' + startDir + ').',
    'Run `anvil-ops` from inside your AnvilWiki fork. If you deleted wrangler.toml (see docs/deployment.md), re-create it with a [vars] SITE_URL, or restore it so anvil-ops can read your site config.',
  );
}
```

- [ ] **Step 5: 测试通过 + Commit**

Run: `pnpm -C tools/anvil-ops test -- site`(会同时跑 env,全绿即可)
Expected: PASS

```bash
git add tools/anvil-ops
git commit -m "feat(ops): loadSiteConfig discovers repo root and reads wrangler.toml vars"
```

---

### Task 4: providers/gsc.ts(解析 + 客户端)

**Files:**
- Create: `src/core/providers/gsc.ts`
- Test: `test/gsc.test.ts` + fixture `test/fixtures/gsc-response.json`

**Interfaces:**
- Consumes: `GscCredential`(Task 2)、`OpsError`
- Produces(Task 6/7 依赖):

```ts
export interface GscRow { page: string; query: string; clicks: number; impressions: number; ctr: number; position: number }
export interface GscQueryResult {
  rows: GscRow[];
  totals: { clicks: number; impressions: number; ctr: number; position: number };
}
export interface GscClient {
  query(params: { days: number }): Promise<GscQueryResult>;
  listAccessibleSites(): Promise<string[]>;
}
export function parseGscResponse(json: unknown): GscQueryResult
export function gscQueryUrl(siteUrl: string): string
export function createGscClient(opts: {
  credential: GscCredential;
  siteUrl: string;
}): GscClient
```

GSC API 事实(实现依据):
- 端点 `POST https://searchconsole.googleapis.com/webmasters/v3/sites/{encodedSiteUrl}/searchAnalytics/query`,`encodedSiteUrl = encodeURIComponent(siteUrl + '/')`(属性必须带尾斜杠再编码)。
- 请求体 `{ startDate, endDate, dimensions: ['page', 'query'], rowLimit: 1000 }`;endDate = 昨天(数据滞后),startDate = endDate - days 天。
- 响应 `{ rows: [{ keys: [page, query], clicks, impressions, ctr, position }] }`。
- doctor 探活:`GET https://searchconsole.googleapis.com/webmasters/v3/sites` 返回 `{ siteEntry: [{ siteUrl }] }`。
- 认证:google-auth-library `JWT`,scope `https://www.googleapis.com/auth/webmasters.readonly`。
- 403 = GSC 资源未授权给服务账号邮箱 → fix:在 Search Console 资源「设置 > 用户和权限」添加 `client_email`。

- [ ] **Step 1: fixture**

`test/fixtures/gsc-response.json`:

```json
{
  "rows": [
    { "keys": ["https://wiki.example.com/bosses/emberfang", "emberfang boss guide"], "clicks": 120, "impressions": 6000, "ctr": 0.02, "position": 4.2 },
    { "keys": ["https://wiki.example.com/codes", "wiki codes"], "clicks": 30, "impressions": 1000, "ctr": 0.03, "position": 8.5 }
  ]
}
```

- [ ] **Step 2: 写失败测试**

`test/gsc.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gscQueryUrl, parseGscResponse } from '../src/core/providers/gsc.js';

const fixture = JSON.parse(readFileSync('test/fixtures/gsc-response.json', 'utf8'));

describe('parseGscResponse', () => {
  it('maps keys to page/query and computes totals', () => {
    const r = parseGscResponse(fixture);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ page: 'https://wiki.example.com/bosses/emberfang', query: 'emberfang boss guide', clicks: 120 });
    expect(r.totals.clicks).toBe(150);
    expect(r.totals.impressions).toBe(7000);
    expect(r.totals.position).toBeCloseTo(6.35, 1);
  });

  it('empty rows = zeroed totals, not an error', () => {
    const r = parseGscResponse({ rows: [] });
    expect(r.rows).toEqual([]);
    expect(r.totals.clicks).toBe(0);
  });

  it('API error shape throws OpsError with fix', () => {
    const bad = { error: { code: 403, message: 'User does not have sufficient permission' } };
    expect(() => parseGscResponse(bad)).toThrow(/403/);
  });
});

describe('gscQueryUrl', () => {
  it('appends trailing slash and encodes', () => {
    expect(gscQueryUrl('https://wiki.example.com')).toBe(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/' +
        encodeURIComponent('https://wiki.example.com/') +
        '/searchAnalytics/query',
    );
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm -C tools/anvil-ops test -- gsc`
Expected: FAIL — module not found

- [ ] **Step 4: 实现**

`src/core/providers/gsc.ts`:

```ts
import { JWT } from 'google-auth-library';
import { OpsError } from '../errors.js';
import type { GscCredential } from '../env.js';

export interface GscRow {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryResult {
  rows: GscRow[];
  totals: { clicks: number; impressions: number; ctr: number; position: number };
}

interface GscApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

function windowDays(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1); // GSC data lags ~2 days; end at yesterday
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

export function gscQueryUrl(siteUrl: string): string {
  const property = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';
  return `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
}

export function parseGscResponse(json: unknown): GscQueryResult {
  const maybeError = json as { error?: { code?: number; message?: string } };
  if (maybeError?.error) {
    const code = maybeError.error.code ?? 0;
    const fix =
      code === 403
        ? 'Share the Search Console property with your service account email (Search Console > Settings > Users and permissions > Add user).'
        : 'Check the service account key with `anvil-ops doctor`.';
    throw new OpsError(`Google Search Console API error ${code}: ${maybeError.error.message ?? 'unknown'}`, fix);
  }
  const rows = ((json as { rows?: GscApiRow[] }).rows ?? []).map((r) => ({
    page: r.keys?.[0] ?? '',
    query: r.keys?.[1] ?? '',
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
  const n = rows.length || 1;
  const totals = {
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    ctr: rows.reduce((s, r) => s + r.ctr * r.impressions, 0) / (rows.reduce((s, r) => s + r.impressions, 0) || 1),
    position: rows.reduce((s, r) => s + r.position, 0) / n,
  };
  return { rows, totals };
}

export interface GscClient {
  query(params: { days: number }): Promise<GscQueryResult>;
  listAccessibleSites(): Promise<string[]>;
}

export function createGscClient(opts: { credential: GscCredential; siteUrl: string }): GscClient {
  const auth = new JWT({
    email: opts.credential.clientEmail,
    key: opts.credential.privateKey,
    scopes: [GSC_SCOPE],
  });
  return {
    async query({ days }) {
      const res = await auth.request({
        url: gscQueryUrl(opts.siteUrl),
        method: 'POST',
        data: { ...windowDays(days), dimensions: ['page', 'query'], rowLimit: 1000 },
      });
      return parseGscResponse(res.data);
    },
    async listAccessibleSites() {
      const res = await auth.request({
        url: 'https://searchconsole.googleapis.com/webmasters/v3/sites',
      });
      const data = res.data as { siteEntry?: { siteUrl?: string }[] };
      return (data.siteEntry ?? []).map((s) => s.siteUrl ?? '').filter(Boolean);
    },
  };
}
```

- [ ] **Step 5: 测试通过 + Commit**

Run: `pnpm -C tools/anvil-ops test -- gsc`
Expected: PASS

```bash
git add tools/anvil-ops
git commit -m "feat(ops): GSC provider with pure parser and JWT client"
```

---

### Task 5: providers/cloudflare.ts(解析 + GraphQL 查询)

**Files:**
- Create: `src/core/providers/cloudflare.ts`
- Test: `test/cloudflare.test.ts` + fixture `test/fixtures/cf-response.json`

**Interfaces:**
- Consumes: `OpsError`
- Produces(Task 6/7 依赖):

```ts
export interface CfPageRow { page: string; visits: number }
export interface CfQueryResult { totals: { visits: number }; pages: CfPageRow[] }
export function parseCfResponse(json: unknown): CfQueryResult
export function buildCfQuery(): string          // GraphQL 查询字符串
export function buildCfVariables(args: { siteTag: string; days: number }): Record<string, unknown>
export async function queryCloudflare(opts: {
  apiToken: string; accountId: string; siteTag: string; days: number;
  fetchImpl?: typeof fetch;
}): Promise<CfQueryResult>
```

CF API 事实(实现依据):
- 端点 `POST https://api.cloudflare.com/client/v4/graphql`,头 `Authorization: Bearer <token>` + `Content-Type: application/json`。
- Web Analytics(RUM)数据集在 account 级:`viewer > accounts(filter: {accountTag}) > rumOperationsGroups`,维度 `rumPageUrl`,指标 `count`,过滤 `_siteTag` / `_datetime_geq` / `_datetime_lt`,`orderBy: [_count_DESC]`,`limit: 100`。
- 响应:`{ data: { viewer: { accounts: [{ rumOperationsGroups: [{ count, dimensions: { rumPageUrl } }] }] } }, errors?: [...] }`。
- 若返回 GraphQL validation error(字段名随 schema 演进),错误信息附带 introspection 自查命令:`curl -sS https://api.cloudflare.com/client/v4/graphql -H "Authorization: Bearer $CF_API_TOKEN" -H 'Content-Type: application/json' --data '{"query":"{ __type(name: \"RumOperationsGroupsDimensionGroup\") { fields { name } } }"}'`。
- 401 = token 无效/无 Analytics Read 权限 → fix:dashboard 创建 token,权限 Account > Analytics > Read。

- [ ] **Step 1: fixture**

`test/fixtures/cf-response.json`:

```json
{
  "data": {
    "viewer": {
      "accounts": [
        {
          "rumOperationsGroups": [
            { "count": 5400, "dimensions": { "rumPageUrl": "https://wiki.example.com/" } },
            { "count": 2100, "dimensions": { "rumPageUrl": "https://wiki.example.com/bosses/emberfang" } }
          ]
        }
      ]
    }
  }
}
```

- [ ] **Step 2: 写失败测试**

`test/cloudflare.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCfQuery, buildCfVariables, parseCfResponse, queryCloudflare } from '../src/core/providers/cloudflare.js';

const fixture = JSON.parse(readFileSync('test/fixtures/cf-response.json', 'utf8'));

describe('parseCfResponse', () => {
  it('maps groups to page rows and totals', () => {
    const r = parseCfResponse(fixture);
    expect(r.pages[0]).toEqual({ page: 'https://wiki.example.com/', visits: 5400 });
    expect(r.totals.visits).toBe(7500);
  });

  it('empty groups = zeroed totals', () => {
    const r = parseCfResponse({ data: { viewer: { accounts: [{ rumOperationsGroups: [] }] } } });
    expect(r.totals.visits).toBe(0);
  });

  it('GraphQL errors throw OpsError with introspection hint', () => {
    const bad = { errors: [{ message: 'Unknown field rumPageUrl' }] };
    expect(() => parseCfResponse(bad)).toThrow(/introspection|curl/);
  });

  it('HTTP 401 throws OpsError mentioning token permission', async () => {
    const fake = (async () => new Response(JSON.stringify({ errors: [{ message: 'authentication failed' }] }), { status: 401 })) as typeof fetch;
    await expect(
      queryCloudflare({ apiToken: 'bad', accountId: 'acc', siteTag: 'tag', days: 7, fetchImpl: fake }),
    ).rejects.toThrow(/Analytics.*Read|token/i);
  });
});

describe('query/variables builders', () => {
  it('uses rumOperationsGroups with siteTag + datetime filter', () => {
    expect(buildCfQuery()).toContain('rumOperationsGroups');
    expect(buildCfQuery()).toContain('rumPageUrl');
    const v = buildCfVariables({ siteTag: 'tag', days: 28 });
    expect(v.filter).toMatchObject({ _siteTag: 'tag' });
    expect((v.filter as Record<string, string>)._datetime_geq).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm -C tools/anvil-ops test -- cloudflare`
Expected: FAIL — module not found

- [ ] **Step 4: 实现**

`src/core/providers/cloudflare.ts`:

```ts
import { OpsError } from '../errors.js';

export interface CfPageRow {
  page: string;
  visits: number;
}

export interface CfQueryResult {
  totals: { visits: number };
  pages: CfPageRow[];
}

const CF_GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

export function buildCfQuery(): string {
  return `query ($accountTag: string!, $filter: rumOperationsGroups_filter) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumOperationsGroups(limit: 100, filter: $filter, orderBy: [_count_DESC]) {
        count
        dimensions { rumPageUrl }
      }
    }
  }
}`;
}

export function buildCfVariables(args: { siteTag: string; days: number }): Record<string, unknown> {
  const to = new Date();
  const from = new Date(to.getTime() - args.days * 24 * 3600 * 1000);
  return {
    accountTag: '',
    filter: {
      _siteTag: args.siteTag,
      _datetime_geq: from.toISOString(),
      _datetime_lt: to.toISOString(),
    },
    // accountTag filled by queryCloudflare; kept here for shape stability
    ...(args.siteTag ? {} : {}),
  };
}

interface CfGroup {
  count?: number;
  dimensions?: { rumPageUrl?: string };
}

export function parseCfResponse(json: unknown): CfQueryResult {
  const withErrors = json as { errors?: { message?: string }[] };
  if (withErrors?.errors?.length) {
    throw new OpsError(
      'Cloudflare GraphQL error: ' + withErrors.errors.map((e) => e.message ?? '').join('; '),
      'If this is a field-validation error, inspect the live schema: curl -sS https://api.cloudflare.com/client/v4/graphql -H "Authorization: Bearer $CF_API_TOKEN" -H \'Content-Type: application/json\' --data \'{"query":"{ __type(name: \\"RumOperationsGroupsDimensionGroup\\") { fields { name } }"}\'',
    );
  }
  const groups =
    (json as { data?: { viewer?: { accounts?: { rumOperationsGroups?: CfGroup[] }[] } } })
      ?.data?.viewer?.accounts?.[0]?.rumOperationsGroups ?? [];
  const pages = groups.map((g) => ({ page: g.dimensions?.rumPageUrl ?? '(unknown)', visits: g.count ?? 0 }));
  return { totals: { visits: pages.reduce((s, p) => s + p.visits, 0) }, pages };
}

export async function queryCloudflare(opts: {
  apiToken: string;
  accountId: string;
  siteTag: string;
  days: number;
  fetchImpl?: typeof fetch;
}): Promise<CfQueryResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const variables = buildCfVariables({ siteTag: opts.siteTag, days: opts.days });
  variables.accountTag = opts.accountId;
  const res = await doFetch(CF_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: buildCfQuery(), variables }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new OpsError(
      `Cloudflare API returned ${res.status}.`,
      'Create an API token in the Cloudflare dashboard with permission Account > Analytics > Read, set CF_API_TOKEN in .env, then re-run `anvil-ops doctor`.',
    );
  }
  if (!res.ok) {
    throw new OpsError(`Cloudflare API returned ${res.status}.`, 'Re-run in a moment; if it persists run `anvil-ops doctor`.');
  }
  return parseCfResponse(await res.json());
}
```

(实现时把 `buildCfVariables` 里多余的 `...(args.siteTag ? {} : {})` 展开残留清掉,签名保持不变。)

- [ ] **Step 5: 测试通过 + Commit**

Run: `pnpm -C tools/anvil-ops test -- cloudflare`
Expected: PASS

```bash
git add tools/anvil-ops
git commit -m "feat(ops): Cloudflare Web Analytics GraphQL provider"
```

---

### Task 6: metrics.ts(编排 + 降级 + 三格式输出)

**Files:**
- Create: `src/core/metrics.ts`
- Test: `test/metrics.test.ts`

**Interfaces:**
- Consumes: `loadOpsEnv`(Task 2)、`loadSiteConfig`(Task 3)、`createGscClient`/`GscQueryResult`(Task 4)、`queryCloudflare`/`CfQueryResult`(Task 5)
- Produces(Task 8 CLI 依赖):

```ts
export type MetricsSource = 'gsc' | 'cf' | 'all';
export interface MetricsReport {
  days: number;
  siteUrl?: string;
  gsc?: GscQueryResult;
  cf?: CfQueryResult;
  degraded: ('gsc' | 'cf')[];   // 未配置(而非失败)的来源
  notes: string[];              // env problems 等透传信息
}
export async function collectMetrics(opts: {
  cwd: string; days: number; source?: MetricsSource;
  gscClientFactory?: (o: { credential: GscCredential; siteUrl: string }) => GscClient;  // 测试注入
  cfQuery?: typeof queryCloudflare;                                                      // 测试注入
}): Promise<MetricsReport>
export function formatMetrics(report: MetricsReport, format: 'table' | 'json' | 'md'): string
```

降级规则(spec §7):GSC 未配 → 只出 CF;CF 未配 → 只出 GSC;全部未配 → 抛 `OpsError`(指向 doctor)。已配置但调用失败(401 等)→ 异常直接上抛(provider 已带 fix 文案)。

- [ ] **Step 1: 写失败测试**

`test/metrics.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectMetrics, formatMetrics } from '../src/core/metrics.js';
import type { GscClient } from '../src/core/providers/gsc.js';

function tmpSite(dotenv: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-metrics-'));
  writeFileSync(join(dir, 'wrangler.toml'), '[vars]\nSITE_URL = "https://wiki.example.com"\nPUBLIC_CF_BEACON_TOKEN = "tag1"\n');
  writeFileSync(join(dir, '.env'), dotenv);
  return dir;
}

const fakeGsc: GscClient = {
  async query() {
    return {
      rows: [{ page: '/b', query: 'q', clicks: 10, impressions: 100, ctr: 0.1, position: 3 }],
      totals: { clicks: 10, impressions: 100, ctr: 0.1, position: 3 },
    };
  },
  async listAccessibleSites() { return ['https://wiki.example.com/']; },
};

const fakeCf = (async () => ({
  totals: { visits: 42 },
  pages: [{ page: 'https://wiki.example.com/', visits: 42 }],
})) as unknown as typeof import('../src/core/providers/cloudflare.js').queryCloudflare;

describe('collectMetrics', () => {
  it('full config: both sources present', async () => {
    const dir = tmpSite(`CF_API_TOKEN=t\nCF_ACCOUNT_ID=a\nGSC_SERVICE_ACCOUNT_JSON=${JSON.stringify({ client_email: 'e@x', private_key: 'k' })}\n`);
    const r = await collectMetrics({
      cwd: dir, days: 7,
      gscClientFactory: () => fakeGsc,
      cfQuery: fakeCf,
    });
    expect(r.gsc?.totals.clicks).toBe(10);
    expect(r.cf?.totals.visits).toBe(42);
    expect(r.degraded).toEqual([]);
  });

  it('no GSC config: CF-only with degraded note', async () => {
    const dir = tmpSite('CF_API_TOKEN=t\nCF_ACCOUNT_ID=a\n');
    const r = await collectMetrics({ cwd: dir, days: 7, cfQuery: fakeCf });
    expect(r.gsc).toBeUndefined();
    expect(r.degraded).toEqual(['gsc']);
  });

  it('nothing configured: OpsError pointing at doctor', async () => {
    const dir = tmpSite('');
    await expect(collectMetrics({ cwd: dir, days: 7 })).rejects.toThrow(/doctor/);
  });
});

describe('formatMetrics', () => {
  const base = {
    days: 28,
    siteUrl: 'https://wiki.example.com',
    degraded: ['gsc'] as const,
    notes: [],
    cf: { totals: { visits: 42 }, pages: [{ page: 'https://wiki.example.com/', visits: 42 }] },
  };

  it('json is parseable and lossless', () => {
    const parsed = JSON.parse(formatMetrics(base as never, 'json'));
    expect(parsed.cf.totals.visits).toBe(42);
  });

  it('md mentions degraded source', () => {
    const md = formatMetrics(base as never, 'md');
    expect(md).toContain('# Metrics');
    expect(md).toContain('gsc');
  });

  it('table renders a header row', () => {
    expect(formatMetrics(base as never, 'table')).toContain('visits');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C tools/anvil-ops test -- metrics`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

`src/core/metrics.ts`:

```ts
import { loadOpsEnv } from './env.js';
import type { GscCredential } from './env.js';
import { OpsError } from './errors.js';
import { loadSiteConfig } from './site.js';
import { createGscClient } from './providers/gsc.js';
import type { GscClient, GscQueryResult } from './providers/gsc.js';
import { queryCloudflare } from './providers/cloudflare.js';
import type { CfQueryResult } from './providers/cloudflare.js';

export type MetricsSource = 'gsc' | 'cf' | 'all';

export interface MetricsReport {
  days: number;
  siteUrl?: string;
  gsc?: GscQueryResult;
  cf?: CfQueryResult;
  degraded: ('gsc' | 'cf')[];
  notes: string[];
}

function pad(cell: string, width: number): string {
  return cell + ' '.repeat(Math.max(0, width - cell.length));
}

export async function collectMetrics(opts: {
  cwd: string;
  days: number;
  source?: MetricsSource;
  gscClientFactory?: (o: { credential: GscCredential; siteUrl: string }) => GscClient;
  cfQuery?: typeof queryCloudflare;
}): Promise<MetricsReport> {
  const site = loadSiteConfig(opts.cwd);
  const env = loadOpsEnv(site.root);
  const wanted = opts.source ?? 'all';
  const degraded: ('gsc' | 'cf')[] = [];

  const gscReady = wanted !== 'cf' && env.gscServiceAccount && site.siteUrl;
  const cfReady = wanted !== 'gsc' && env.cfApiToken && env.cfAccountId && site.cfBeaconToken;
  if (!gscReady && !cfReady) {
    throw new OpsError(
      'No analytics source is configured.',
      'Set GSC_SERVICE_ACCOUNT_JSON and/or CF_API_TOKEN + CF_ACCOUNT_ID in .env (site tag comes from wrangler.toml). Run `anvil-ops doctor` for a guided check.',
    );
  }

  const report: MetricsReport = { days: opts.days, siteUrl: site.siteUrl, degraded, notes: [...env.problems] };

  if (gscReady) {
    const factory = opts.gscClientFactory ?? createGscClient;
    const client = factory({ credential: env.gscServiceAccount!, siteUrl: site.siteUrl! });
    report.gsc = await client.query({ days: opts.days });
  } else if (wanted !== 'cf') {
    degraded.push('gsc');
  }

  if (cfReady) {
    const q = opts.cfQuery ?? queryCloudflare;
    report.cf = await q({
      apiToken: env.cfApiToken!,
      accountId: env.cfAccountId!,
      siteTag: site.cfBeaconToken!,
      days: opts.days,
    });
  } else if (wanted !== 'gsc') {
    degraded.push('cf');
  }

  return report;
}

export function formatMetrics(report: MetricsReport, format: 'table' | 'json' | 'md'): string {
  if (format === 'json') return JSON.stringify(report, null, 2);

  const lines: string[] = [];
  if (format === 'md') {
    lines.push(`# Metrics — last ${report.days} days`);
    if (report.siteUrl) lines.push(`Site: ${report.siteUrl}`);
    lines.push('');
  }
  if (report.gsc) {
    const t = report.gsc.totals;
    lines.push(format === 'md' ? '## Google Search Console' : 'Google Search Console');
    lines.push(`clicks=${t.clicks} impressions=${t.impressions} ctr=${(t.ctr * 100).toFixed(1)}% position=${t.position.toFixed(1)}`);
    lines.push('');
    const rows = report.gsc.rows.slice(0, 20);
    lines.push([pad('page', 44), pad('query', 24), pad('clicks', 8), pad('impr', 8), pad('ctr', 7), 'pos'].join(' '));
    for (const r of rows) lines.push([pad(r.page.slice(0, 43), 44), pad(r.query.slice(0, 23), 24), pad(String(r.clicks), 8), pad(String(r.impressions), 8), pad((r.ctr * 100).toFixed(1) + '%', 7), r.position.toFixed(1)].join(' '));
    lines.push('');
  }
  if (report.cf) {
    lines.push(format === 'md' ? '## Cloudflare Web Analytics' : 'Cloudflare Web Analytics');
    lines.push(`visits=${report.cf.totals.visits}`);
    lines.push('');
    lines.push([pad('page', 60), 'visits'].join(' '));
    for (const p of report.cf.pages.slice(0, 20)) lines.push([pad(p.page.slice(0, 59), 60), p.visits].join(' '));
    lines.push('');
  }
  if (report.degraded.length) lines.push(`Not configured (skipped): ${report.degraded.join(', ')}. Run \`anvil-ops doctor\` to enable.`);
  for (const n of report.notes) lines.push(`Note: ${n}`);
  return lines.join('\n').trim() + '\n';
}
```

- [ ] **Step 4: 测试通过 + Commit**

Run: `pnpm -C tools/anvil-ops test -- metrics`
Expected: PASS

```bash
git add tools/anvil-ops
git commit -m "feat(ops): metrics orchestration with graceful degradation and 3 output formats"
```

---

### Task 7: doctor.ts(体检报告)

**Files:**
- Create: `src/core/doctor.ts`
- Test: `test/doctor.test.ts`

**Interfaces:**
- Consumes: `loadOpsEnv`、`loadSiteConfig`、`createGscClient`、`queryCloudflare`(全部注入化)
- Produces(Task 8 依赖):

```ts
export interface DoctorCheck {
  name: string;      // 'site-config' | 'gh' | 'gsc-config' | 'gsc-access' | 'cf-config' | 'cf-access'
  ok: boolean;
  detail: string;    // 现象描述
  fix?: string;      // ok=false 时必填
}
export interface DoctorReport { checks: DoctorCheck[] }
export interface DoctorDeps {           // 全部可注入,测试不碰网络/进程
  ghVersion?: () => { ok: boolean; detail: string };
  gscClient?: GscClient;
  cfQuery?: typeof queryCloudflare;
}
export async function runDoctor(opts: { cwd: string; deps?: DoctorDeps }): Promise<DoctorReport>
export function formatDoctor(report: DoctorReport): string   // markdown,含 doctor 退出码语义说明
```

检查项(spec §4):env 逐项、gh 可用性、GSC 资源可访问性(`listAccessibleSites()` 是否包含 `siteUrl + '/'`)、CF token 有效性(`queryCloudflare` days=1 探活)、SITE_URL 解析。

- [ ] **Step 1: 写失败测试**

`test/doctor.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDoctor, formatDoctor } from '../src/core/doctor.js';

function tmpSite(dotenv: string, toml = '[vars]\nSITE_URL = "https://wiki.example.com"\nPUBLIC_CF_BEACON_TOKEN = "tag1"\n'): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-doctor-'));
  writeFileSync(join(dir, 'wrangler.toml'), toml);
  if (dotenv) writeFileSync(join(dir, '.env'), dotenv);
  return dir;
}

const ghOk = () => ({ ok: true, detail: 'gh version 2.x found' });
const gscOk = {
  async query() { throw new Error('not used'); },
  async listAccessibleSites() { return ['https://wiki.example.com/']; },
} as never;
const cfOk = (async () => ({ totals: { visits: 0 }, pages: [] })) as never;

describe('runDoctor', () => {
  it('all green when everything configured and reachable', async () => {
    const dir = tmpSite(`CF_API_TOKEN=t\nCF_ACCOUNT_ID=a\nGSC_SERVICE_ACCOUNT_JSON=${JSON.stringify({ client_email: 'e@x', private_key: 'k' })}\n`);
    const r = await runDoctor({ cwd: dir, deps: { ghVersion: ghOk, gscClient: gscOk, cfQuery: cfOk } });
    expect(r.checks.map((c) => c.name)).toEqual(['site-config', 'gh', 'gsc-config', 'gsc-access', 'cf-config', 'cf-access']);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  it('missing SITE_URL fails site-config with fix', async () => {
    const dir = tmpSite('', '[vars]\n');
    const r = await runDoctor({ cwd: dir, deps: { ghVersion: ghOk } });
    const site = r.checks.find((c) => c.name === 'site-config')!;
    expect(site.ok).toBe(false);
    expect(site.fix).toMatch(/SITE_URL/);
  });

  it('gsc-config skipped-ok when GSC not configured (env-gated)', async () => {
    const dir = tmpSite('CF_API_TOKEN=t\nCF_ACCOUNT_ID=a\n');
    const r = await runDoctor({ cwd: dir, deps: { ghVersion: ghOk, cfQuery: cfOk } });
    expect(r.checks.find((c) => c.name === 'gsc-config')?.ok).toBe(true);
    expect(r.checks.find((c) => c.name === 'gsc-access')).toBeUndefined();
  });

  it('gsc-access fails when property not shared with SA', async () => {
    const dir = tmpSite(`GSC_SERVICE_ACCOUNT_JSON=${JSON.stringify({ client_email: 'e@x', private_key: 'k' })}\n`);
    const gscNoAccess = { async query() { throw new Error('x'); }, async listAccessibleSites() { return ['https://other.com/']; } } as never;
    const r = await runDoctor({ cwd: dir, deps: { ghVersion: ghOk, gscClient: gscNoAccess } });
    const access = r.checks.find((c) => c.name === 'gsc-access')!;
    expect(access.ok).toBe(false);
    expect(access.fix).toMatch(/Users and permissions/);
  });

  it('formatDoctor renders markdown with per-check status', async () => {
    const dir = tmpSite('');
    const r = await runDoctor({ cwd: dir, deps: { ghVersion: ghOk } });
    const md = formatDoctor(r);
    expect(md).toContain('site-config');
    expect(md).toContain('gh');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm -C tools/anvil-ops test -- doctor`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

`src/core/doctor.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { loadOpsEnv } from './env.js';
import { loadSiteConfig } from './site.js';
import { createGscClient } from './providers/gsc.js';
import type { GscClient } from './providers/gsc.js';
import { queryCloudflare } from './providers/cloudflare.js';
import { OpsError } from './errors.js';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
}

export interface DoctorDeps {
  ghVersion?: () => { ok: boolean; detail: string };
  gscClient?: GscClient;
  cfQuery?: typeof queryCloudflare;
}

function defaultGhVersion(): { ok: boolean; detail: string } {
  const res = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (res.status === 0) return { ok: true, detail: (res.stdout ?? '').split('\n')[0] };
  return { ok: false, detail: 'gh CLI not found on PATH', fix: 'Install GitHub CLI: https://cli.github.com/ (needed for `anvil-ops submit` in P3)' };
}

export async function runDoctor(opts: { cwd: string; deps?: DoctorDeps }): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const deps = opts.deps ?? {};

  // 1. site config
  let siteUrl: string | undefined;
  let beacon: string | undefined;
  let cfAccountProbe: string | undefined;
  try {
    const site = loadSiteConfig(opts.cwd);
    siteUrl = site.siteUrl;
    beacon = site.cfBeaconToken;
    if (!site.siteUrl) {
      checks.push({ name: 'site-config', ok: false, detail: 'wrangler.toml found but SITE_URL is not set in [vars]', fix: 'Set SITE_URL = "https://your-domain" under [vars] in wrangler.toml (must include https://).' });
    } else {
      checks.push({ name: 'site-config', ok: true, detail: `repo root ${site.root}; SITE_URL=${site.siteUrl}; beacon=${site.cfBeaconToken ? 'set' : 'not set'}` });
    }
  } catch (e) {
    const msg = e instanceof OpsError ? e : new OpsError(String(e), '');
    checks.push({ name: 'site-config', ok: false, detail: msg.message, fix: msg.fix || 'Run anvil-ops inside your AnvilWiki fork.' });
  }

  // 2. gh
  const gh = deps.ghVersion ?? defaultGhVersion;
  checks.push({ name: 'gh', ...gh() });

  // 3. env / gsc
  const env = loadOpsEnv(opts.cwd);
  if (env.gscServiceAccount && siteUrl) {
    checks.push({ name: 'gsc-config', ok: true, detail: `service account ${env.gscServiceAccount.clientEmail}` });
    const client = deps.gscClient ?? createGscClient({ credential: env.gscServiceAccount, siteUrl });
    try {
      const sites = await client.listAccessibleSites();
      const wanted = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';
      if (sites.some((s) => s.replace(/\/$/, '') === wanted.replace(/\/$/, ''))) {
        checks.push({ name: 'gsc-access', ok: true, detail: `property ${wanted} accessible` });
      } else {
        checks.push({ name: 'gsc-access', ok: false, detail: `property ${wanted} not in accessible list (${sites.length} sites)`, fix: 'Search Console > Settings > Users and permissions > Add user, add the service account email as Restricted.' });
      }
    } catch (e) {
      checks.push({ name: 'gsc-access', ok: false, detail: String(e), fix: 'Check the service account key and property sharing; re-run with a fresh key from Google Cloud IAM.' });
    }
  } else {
    checks.push({ name: 'gsc-config', ok: true, detail: 'GSC not configured — metrics will run CF-only (env-gated, not an error)' });
  }
  for (const p of env.problems) checks.push({ name: 'gsc-config', ok: false, detail: p, fix: 'Fix the value in .env, then re-run `anvil-ops doctor`.' });

  // 4. cf
  if (env.cfApiToken && env.cfAccountId && beacon) {
    checks.push({ name: 'cf-config', ok: true, detail: `token + account + beacon tag ${beacon}` });
    const q = deps.cfQuery ?? queryCloudflare;
    try {
      await q({ apiToken: env.cfApiToken, accountId: env.cfAccountId, siteTag: beacon, days: 1 });
      checks.push({ name: 'cf-access', ok: true, detail: 'GraphQL probe succeeded' });
    } catch (e) {
      const msg = e instanceof OpsError ? `${e.message} ${e.fix}` : String(e);
      checks.push({ name: 'cf-access', ok: false, detail: msg, fix: 'Create a token with Account > Analytics > Read (https://dash.cloudflare.com/profile/api-tokens) and set CF_API_TOKEN.' });
    }
  } else {
    const missing = [env.cfApiToken ? null : 'CF_API_TOKEN', env.cfAccountId ? null : 'CF_ACCOUNT_ID', beacon ? null : 'PUBLIC_CF_BEACON_TOKEN'].filter(Boolean);
    checks.push({ name: 'cf-config', ok: true, detail: `CF Analytics not configured (missing: ${missing.join(', ')}) — metrics will run GSC-only (env-gated, not an error)` });
  }

  return { checks };
}

export function formatDoctor(report: DoctorReport): string {
  const lines = ['# anvil-ops doctor'];
  for (const c of report.checks) {
    lines.push(`- ${c.ok ? '[ok]' : '[FAIL]'} ${c.name}: ${c.detail}`);
    if (!c.ok && c.fix) lines.push(`  fix: ${c.fix}`);
  }
  const failed = report.checks.filter((c) => !c.ok).length;
  lines.push('', failed === 0 ? 'All checks passed.' : `${failed} check(s) failed.`);
  return lines.join('\n') + '\n';
}
```

注意:上面 `cfAccountProbe` 变量是实现草稿残留,实现时删除;`gsc-config` 在「未配置」语义下 ok=true(env 门控哲学:未配置≠失败),与测试第 3 个 case 对齐。

- [ ] **Step 4: 测试通过 + Commit**

Run: `pnpm -C tools/anvil-ops test -- doctor`
Expected: PASS

```bash
git add tools/anvil-ops
git commit -m "feat(ops): doctor checks with injectable deps and markdown report"
```

---

### Task 8: CLI 壳(commander + bin + 两命令)

**Files:**
- Create: `src/bin/cli.ts`、`src/cli/commands/doctor.ts`、`src/cli/commands/metrics.ts`
- Modify: 无(package.json bin 已在 Task 1 配好)

**Interfaces:**
- Consumes: `runDoctor`/`formatDoctor`(Task 7)、`collectMetrics`/`formatMetrics`(Task 6)、`OpsError`
- Produces: `anvil-ops doctor` / `anvil-ops metrics [--days N] [--format table|json|md] [--source gsc|cf|all]` / `--version`;退出码:doctor 有 FAIL → 1;出错 → 1 且 stderr 打「原因 + fix」

- [ ] **Step 1: 实现三个文件**

`src/cli/commands/doctor.ts`:

```ts
import { runDoctor, formatDoctor } from '../../core/doctor.js';

export async function doctorCommand(): Promise<number> {
  const report = await runDoctor({ cwd: process.cwd() });
  process.stdout.write(formatDoctor(report));
  return report.checks.some((c) => !c.ok) ? 1 : 0;
}
```

`src/cli/commands/metrics.ts`:

```ts
import { collectMetrics, formatMetrics } from '../../core/metrics.js';

export interface MetricsFlags {
  days: number;
  format: 'table' | 'json' | 'md';
  source?: 'gsc' | 'cf' | 'all';
}

export async function metricsCommand(flags: MetricsFlags): Promise<number> {
  const report = await collectMetrics({
    cwd: process.cwd(),
    days: flags.days,
    source: flags.source,
  });
  process.stdout.write(formatMetrics(report, flags.format));
  return 0;
}
```

`src/bin/cli.ts`:

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { doctorCommand } from '../cli/commands/doctor.js';
import { metricsCommand } from '../cli/commands/metrics.js';
import { OpsError } from '../core/errors.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as { version: string };

const program = new Command();
program.name('anvil-ops').description('Ops toolkit for AnvilWiki fork sites').version(pkg.version);

program.command('doctor').description('Check site config, env credentials, gh, GSC and CF access').action(async () => {
  process.exitCode = await doctorCommand();
});

program
  .command('metrics')
  .description('Pull GSC + Cloudflare Web Analytics metrics')
  .option('--days <n>', 'lookback window in days', '28')
  .option('--format <fmt>', 'output format: table | json | md', 'table')
  .option('--source <s>', 'limit to gsc | cf | all', 'all')
  .action(async (opts: { days: string; format: string; source: string }) => {
    const format = ['table', 'json', 'md'].includes(opts.format) ? (opts.format as 'table' | 'json' | 'md') : undefined;
    if (!format) {
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
    process.exitCode = await metricsCommand({ days, format, source: opts.source as 'gsc' | 'cf' | 'all' });
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  if (e instanceof OpsError) {
    process.stderr.write(`Error: ${e.message}\nFix: ${e.fix}\n`);
  } else {
    process.stderr.write(`Error: ${String(e)}\n`);
  }
  process.exitCode = 1;
});
```

- [ ] **Step 2: 本地冒烟(不发布)**

```bash
cd tools/anvil-ops
pnpm exec tsx src/bin/cli.ts --help
pnpm exec tsx src/bin/cli.ts doctor; echo "exit=$?"        # 在本仓库根跑:site-config ok + gsc/cf 未配置提示
pnpm exec tsx src/bin/cli.ts metrics --days 7 --format md; echo "exit=$?"   # 无任何 env → 应打 OpsError 指向 doctor,exit=1
pnpm build && node dist/bin/cli.js --version
```

Expected: help 列出 doctor/metrics;doctor 报告 markdown 且 exit 码语义正确;metrics 无配置时报错指向 doctor 且 exit=1;build 产物可执行,`--version` 打 `0.1.0`。

注意:`pnpm exec tsx src/bin/cli.ts doctor` 必须在**仓库根**执行(命令里先 cd 到 tools/ 的话,loadSiteConfig 从 tools/anvil-ops 往上走能找到根 wrangler.toml——两层都验证一下,walk-up 逻辑本 task 验收的一部分)。

- [ ] **Step 3: 全量测试 + 根仓库回归 + Commit**

```bash
pnpm -C tools/anvil-ops test && pnpm -C tools/anvil-ops typecheck
pnpm typecheck && pnpm lint && pnpm test
git add tools/anvil-ops
git commit -m "feat(ops): CLI shell with doctor and metrics commands"
```

---

### Task 9: 包 README + dogfood 验收 + 收尾

**Files:**
- Create: `tools/anvil-ops/README.md`

**Interfaces:**
- Consumes: 已完成的 CLI
- Produces: P1 验收证据(README + 本地跑通的记录写进 PR/commit message)

- [ ] **Step 1: 写 README(P1 范围)**

`tools/anvil-ops/README.md` 内容骨架(完整写出,不得留 TODO):

````markdown
# anvilwiki-ops

Ops toolkit for [AnvilWiki](https://github.com/PNGTRID/AnvilWiki) fork sites. Run from your fork's repo root.

> Status: 0.1 (P1). Commands: `doctor`, `metrics`. MCP server, `audit` / `insights` / `submit` ship in later milestones.

## Usage

```bash
npx anvilwiki-ops doctor
npx anvilwiki-ops metrics --days 28 --format md
```

## Configuration (.env in repo root, gitignored)

| Variable | Required for | Notes |
|---|---|---|
| `GSC_SERVICE_ACCOUNT_JSON` | GSC metrics | `{`-prefixed inline JSON or a file path |
| `CF_API_TOKEN` | CF metrics | token with Account > Analytics > Read |
| `CF_ACCOUNT_ID` | CF metrics | Cloudflare account ID |

`SITE_URL` and `PUBLIC_CF_BEACON_TOKEN` are read from `wrangler.toml [vars]` — no extra setup if your fork already deploys.

Empty values disable the feature (no error). Run `anvil-ops doctor` for guided setup checks.

## GSC setup (5 minutes)

1. Google Cloud Console → new project → enable **Search Console API**.
2. IAM → Service Accounts → create → Keys → add JSON key.
3. Search Console → your property → Settings → Users and permissions → add the service account email as **Restricted**.
4. Put the JSON path (or contents) in `.env` as `GSC_SERVICE_ACCOUNT_JSON`.

## CF Web Analytics setup

1. Cloudflare dashboard → your account → Web Analytics (already sending data via the template's beacon).
2. Create API token with **Account > Analytics > Read**.
3. Set `CF_API_TOKEN` and `CF_ACCOUNT_ID` in `.env`.
````

- [ ] **Step 2: dogfood 验收(需仓库所有者凭据;拿不到则记录为待办不算失败)**

在本仓库根:

```bash
# 有 demo 站凭据时(用户提供 CF_API_TOKEN/CF_ACCOUNT_ID 或 GSC SA):
cd tools/anvil-ops && pnpm exec tsx src/bin/cli.ts doctor
pnpm exec tsx src/bin/cli.ts metrics --days 28 --format md
```

Expected: doctor 全绿(或明确指出哪项凭据缺失);metrics 输出 anvilwiki.pages.dev 的真实数据。若本环境拿不到凭据,在 commit message 里注明「真数据 dogfood 待凭据,fixture 测试全绿」,并保留命令清单供后续执行。

- [ ] **Step 3: 最终全绿 + Commit**

```bash
pnpm -C tools/anvil-ops test && pnpm -C tools/anvil-ops typecheck && pnpm -C tools/anvil-ops build
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add tools/anvil-ops
git commit -m "docs(ops): P1 README with env contract and setup guides"
```

---

## Plan Self-Review 结果

- **Spec 覆盖(P1 范围)**:spec §3 架构(site/env/providers/metrics/doctor/cli 文件一一对应)✅;§4 doctor/metrics 两命令 ✅(audit/insights/submit 属 P3,不在本计划);§7 env 门控与降级 ✅(Task 2/6);§8 错误文案含 fix + 非零退出 ✅(errors.ts + CLI catch);§9 测试策略 providers fixture + 纯函数单测 ✅;§10 P1 验收 = npx 可跑 + doctor 准确 ✅(Task 8/9;npm 发布属 P4)。
- **占位符扫描**:Task 2/5/7 各有一处「实现时注意」的草稿残留修正说明,均给出了确定性的最终写法,非 TBD。
- **类型一致性**:`GscCredential`/`OpsEnv`(Task 2)→ gsc.ts(4)→ metrics.ts(6)→ doctor.ts(7);`CfQueryResult`(5)→ metrics/doctor;`MetricsReport`(6)→ CLI(8);签名已逐一核对一致。
- **已知风险**:CF GraphQL 字段名(`rumOperationsGroups`/`rumPageUrl`/`_siteTag`)基于官方文档与社区教程,若 schema 演进,Task 5 的错误路径已内置 introspection 自查命令,GSC 端点/响应形状是稳定 v3 API 无此风险。

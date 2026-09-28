# anvilwiki-ops P2(MCP server)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `anvilwiki-ops` 加 stdio MCP server(bin `anvil-ops-mcp` + `anvil-ops mcp` 子命令),暴露 `doctor` / `metrics` 两个工具,映射 P1 已有 core,带 in-memory client 集成测试。

**Architecture:** `buildServer(opts)` 工厂返回配置好的 `McpServer`(可注入 cwd 与依赖,测试不依赖进程全局);bin 与子命令只是接 `StdioServerTransport`。输出统一 markdown;错误转 `isError: true` + fix 文案(spec §5)。

**Tech Stack:** @modelcontextprotocol/sdk ^1.30(zod 4 传 schema)、zod ^4。

**Spec:** `docs/superpowers/specs/2026-08-18-anvil-ops-cli-mcp-design.md` §5 + §10 P2。

## Global Constraints

- 同 P1:不碰模板 src/、根仓库四命令保持绿、每 task commit、TDD。
- MCP 工具只读 + doctor(无写路径);输出 markdown 文本;不给 metrics 输出 ASCII 表。
- 工具 description 必须写清前置条件(doctor 是任何运营会话第一步)。

---

### Task 1: 依赖 + buildServer 工厂 + doctor/metrics 工具

**Files:**
- Modify: `tools/anvil-ops/package.json`(bin 加 `anvil-ops-mcp`;deps 加 `@modelcontextprotocol/sdk`、`zod`)
- Create: `tools/anvil-ops/src/mcp/server.ts`
- Test: `tools/anvil-ops/test/mcp.test.ts`

**Interfaces:**
- Consumes: `runDoctor`/`formatDoctor`(core/doctor)、`collectMetrics`/`formatMetrics`(core/metrics)、`OpsError`
- Produces: `buildServer(opts: { cwd: string; gscClientFactory?: ...; cfQuery?: ... }): McpServer`(P3 复用加 audit/insights/submit_pr 工具)

- [ ] **Step 1: 加依赖**

`package.json` bin 段:

```json
"bin": {
  "anvil-ops": "dist/bin/cli.js",
  "anvil-ops-mcp": "dist/bin/mcp.js"
}
```

dependencies 追加 `"@modelcontextprotocol/sdk": "^1.30.0"`、`"zod": "^4.4.3"`,然后 `pnpm install`(包是自己的 workspace 根,裸 install 即可)。

- [ ] **Step 2: 写失败测试(in-memory client 全链路)**

`test/mcp.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/mcp/server.js';
import type { queryCloudflare } from '../src/core/providers/cloudflare.js';

function tmpSite(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-mcp-'));
  writeFileSync(join(dir, 'wrangler.toml'), '[vars]\nSITE_URL = "https://wiki.example.com"\nPUBLIC_CF_BEACON_TOKEN = "tag1"\n');
  writeFileSync(join(dir, '.env'), 'CF_API_TOKEN=t\nCF_ACCOUNT_ID=a\n');
  return dir;
}

const fakeCf = (async () => ({
  totals: { visits: 7 },
  pages: [{ page: 'https://wiki.example.com/', visits: 7 }],
})) as unknown as typeof queryCloudflare;

async function connect(cwd: string) {
  const server = buildServer({ cwd, cfQuery: fakeCf });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

describe('anvil-ops MCP server', () => {
  it('lists doctor and metrics tools', async () => {
    const client = await connect(tmpSite());
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual(['doctor', 'metrics']);
    expect(tools.tools[0].description).toBeTruthy();
  });

  it('doctor tool returns markdown report', async () => {
    const client = await connect(tmpSite());
    const res = await client.callTool({ name: 'doctor', arguments: {} });
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('# anvil-ops doctor');
    expect(res.isError).toBeFalsy();
  });

  it('metrics tool returns markdown with cf data', async () => {
    const client = await connect(tmpSite());
    const res = await client.callTool({ name: 'metrics', arguments: { days: 7 } });
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(text).toContain('visits=7');
  });

  it('metrics with no source configured = isError with fix', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-mcp-'));
    writeFileSync(join(dir, 'wrangler.toml'), '[vars]\nSITE_URL = "https://x.com"\n');
    const client = await connect(dir);
    const res = await client.callTool({ name: 'metrics', arguments: {} });
    expect(res.isError).toBe(true);
    const text = (res.content as { type: string; text: string }[])[0].text;
    expect(text).toMatch(/doctor/);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm -C tools/anvil-ops test -- mcp`
Expected: FAIL — Cannot find module '../src/mcp/server.js'

- [ ] **Step 4: 实现 server.ts**

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runDoctor, formatDoctor } from '../core/doctor.js';
import { collectMetrics, formatMetrics } from '../core/metrics.js';
import { OpsError } from '../core/errors.js';
import type { GscClient, GscClientFactoryAlias } from '../core/mcp-types.js'; // 见下,实际直接用内联类型

// 实际实现中类型直接内联:
interface BuildServerOpts {
  cwd: string;
  gscClientFactory?: (o: { credential: { clientEmail: string; privateKey: string }; siteUrl: string }) => GscClient;
  cfQuery?: typeof import('../core/providers/cloudflare.js').queryCloudflare;
}

function errText(e: unknown): string {
  return e instanceof OpsError ? `Error: ${e.message}\nFix: ${e.fix}` : `Error: ${String(e)}`;
}

export function buildServer(opts: BuildServerOpts): McpServer {
  const server = new McpServer({ name: 'anvilwiki-ops', version: '0.1.0' });

  server.registerTool(
    'doctor',
    {
      title: 'anvil-ops doctor',
      description:
        'Health check for AnvilWiki site ops: wrangler.toml site config, gh CLI, GSC service account, CF Web Analytics token. Run this FIRST in any ops session before other anvil-ops tools.',
      inputSchema: {},
    },
    async () => {
      try {
        const report = await runDoctor({ cwd: opts.cwd });
        return { content: [{ type: 'text', text: formatDoctor(report) }] };
      } catch (e) {
        return { isError: true, content: [{ type: 'text', text: errText(e) }] };
      }
    },
  );

  server.registerTool(
    'metrics',
    {
      title: 'anvil-ops metrics',
      description:
        'Pull site traffic metrics: Google Search Console (clicks/impressions/CTR/position by page and query) + Cloudflare Web Analytics (visits by page). Requires .env credentials; run doctor first if unset.',
      inputSchema: {
        days: z.number().int().min(1).max(365).default(28).describe('lookback window in days'),
        source: z.enum(['gsc', 'cf', 'all']).default('all').describe('limit to one source'),
      },
    },
    async ({ days, source }) => {
      try {
        const report = await collectMetrics({
          cwd: opts.cwd,
          days: days ?? 28,
          source: source ?? 'all',
          gscClientFactory: opts.gscClientFactory as never,
          cfQuery: opts.cfQuery,
        });
        return { content: [{ type: 'text', text: formatMetrics(report, 'md') }] };
      } catch (e) {
        return { isError: true, content: [{ type: 'text', text: errText(e) }] };
      }
    },
  );

  return server;
}
```

(上面 import 块第一行的 `../core/mcp-types.js` 是草稿残留——实际文件只 import 真实存在的模块,`GscClient` 从 `../core/providers/gsc.js` 导入。)

- [ ] **Step 5: 测试通过 + 根仓库回归 + Commit**

```bash
pnpm -C tools/anvil-ops test && pnpm -C tools/anvil-ops typecheck
pnpm typecheck && pnpm lint && pnpm test
git add tools/anvil-ops pnpm-lock.yaml
git commit -m "feat(ops): MCP server with doctor and metrics tools"
```

---

### Task 2: bin 入口 + `anvil-ops mcp` 子命令 + 冒烟

**Files:**
- Create: `tools/anvil-ops/src/bin/mcp.ts`
- Modify: `tools/anvil-ops/src/bin/cli.ts`(加 mcp 子命令)

**Interfaces:**
- Consumes: `buildServer`(Task 1)
- Produces: `anvil-ops-mcp`(独立 bin)与 `anvil-ops mcp`(子命令)等价的 stdio server

- [ ] **Step 1: 实现**

`src/bin/mcp.ts`:

```ts
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from '../mcp/server.js';

const server = buildServer({ cwd: process.cwd() });
await server.connect(new StdioServerTransport());
```

`src/bin/cli.ts` 在 metrics 命令注册后追加:

```ts
program
  .command('mcp')
  .description('Start the anvil-ops MCP server on stdio (for Claude / ZCode / other MCP clients)')
  .action(async () => {
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const { buildServer } = await import('../mcp/server.js');
    const server = buildServer({ cwd: process.cwd() });
    await server.connect(new StdioServerTransport());
  });
```

- [ ] **Step 2: 冒烟**

```bash
cd /Users/yuanruiqin/Desktop/AI_DEV/AnvilWiki
pnpm exec tsx tools/anvil-ops/src/bin/cli.ts --help      # 应列出 mcp
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | pnpm exec tsx tools/anvil-ops/src/bin/mcp.ts | head -5
pnpm -C tools/anvil-ops build && node tools/anvil-ops/dist/bin/mcp.js --help 2>&1 | head -2
```

Expected: JSON-RPC 响应里 `tools/list` 返回 doctor+metrics。

- [ ] **Step 3: 全绿 + Commit**

```bash
pnpm -C tools/anvil-ops test && pnpm -C tools/anvil-ops typecheck && pnpm -C tools/anvil-ops build
pnpm typecheck && pnpm lint && pnpm test
git add tools/anvil-ops
git commit -m "feat(ops): anvil-ops-mcp bin + mcp subcommand"
```

---

## Plan Self-Review 结果

- **Spec 覆盖(P2 范围)**:spec §5 工具一一映射(doctor/metrics,P3 补 audit/insights/submit_pr)✅;isError + fix ✅;markdown 输出 ✅;description 含前置条件 ✅;§10 P2 验收「MCP 客户端实测调通」用 in-memory client 测试 + stdio JSON-RPC 冒烟代替(真实 ZCode/Claude 接入属人工验收,P4 文档里给配置样例)。
- **类型一致性**:buildServer opts 与 P1 collectMetrics 的注入参数签名一致(未用工厂时 undefined 透传,core 默认真实实现)。
- **草稿残留**:server.ts 代码块中标注了 1 处 import 残留说明,最终实现以真实模块为准。

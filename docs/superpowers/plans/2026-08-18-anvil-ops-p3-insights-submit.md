# anvilwiki-ops P3(insights + audit + submit)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 `anvilwiki-ops` 的运营闭环:insights 规则引擎(GSC×CF → 优先级行动清单)、audit 聚合报告(模板 4 检查脚本)、submit(校验→分支→commit→push→gh 开 PR),并给 CLI/MCP 各加 audit / insights / submit(_pr) 三入口。

**Architecture:** 全部新逻辑进 core(insights.ts / audit.ts / content.ts / gitops.ts),CLI 与 MCP 只是薄壳映射(与 P1/P2 同构)。所有外部交互(git、gh、pnpm 脚本)经可注入的 `run` 函数,默认真 spawn,测试注入假实现;真实 git 集成测试用本地 bare 仓库当 origin。

**Tech Stack:** 同 P1/P2,无新依赖。

**Spec:** `docs/superpowers/specs/2026-08-18-anvil-ops-cli-mcp-design.md` §4(命令)/§5(工具)/§6(规则)/§10 P3。

## Global Constraints

- 同 P1/P2:根仓库四命令保持绿、每 task commit、TDD、不碰模板 src/。
- submit 永不直接 push main;分支名 `ops/submit-<YYYYMMDD>-<HHmm>`;校验失败就地终止不出 PR。
- insights 规则=纯函数,阈值集中在 insights.ts 顶部常量。
- MCP 输出统一 markdown;submit_pr 工具 description 写明「工作区需有改动 + 需要 gh」。

---

### Task 1: content.ts(校验编排)+ audit.ts(聚合报告)

**Files:**
- Create: `src/core/content.ts`、`src/core/audit.ts`
- Test: `test/content.test.ts`、`test/audit.test.ts`

**Interfaces:**
- Produces(Task 3 submit 依赖):

```ts
// content.ts
export type RunFn = (cmd: string, args: string[], opts: { cwd: string }) => { status: number | null; stdout: string; stderr: string };
export const defaultRun: RunFn;                       // spawnSync 封装,ENOENT → status null + stderr 提示
export interface CheckResult { name: string; ok: boolean; summary: string }  // summary = 输出最后 5 行
export function runValidation(opts: { cwd: string; run?: RunFn }): CheckResult[]
// 依次: check-content → check-i18n --strict → build;全跑完不短路(submit 用 all().ok 判断,audit 报告要全量)

// audit.ts
export interface AuditReport { checks: CheckResult[] }
export function runAudit(opts: { cwd: string; run?: RunFn }): AuditReport
// 依次: refresh-audit → check-i18n → check-content → check-links(check-links 失败且 stderr 含 dist → summary 注明「需先 pnpm build」)
export function formatAudit(report: AuditReport): string   // markdown
```

- [ ] **Step 1: 写失败测试**(要点:注入 RunFn 返回固定 status/stdout,断言命令序列、summary 截取、check-links 的 dist 提示、formatAudit markdown 结构;check-i18n 在 submit 语境用 `--strict`、audit 语境不用——runValidation 固定 `--strict`,runAudit 不带)
- [ ] **Step 2: 确认失败 → 实现 → 通过 → Commit**(`feat(ops): validation orchestration and audit aggregation`)

### Task 2: insights.ts(规则引擎)

**Files:**
- Create: `src/core/insights.ts`
- Test: `test/insights.test.ts`

**Interfaces:**
- Consumes: `GscQueryResult`、`CfQueryResult`(类型)
- Produces:

```ts
export const THRESHOLDS = { lowCtrImpr: 200, lowCtr: 0.03, rankMin: 5, rankMax: 15, rankImpr: 100, cfTopVisits: 50, staleDays: 7 };
export interface Insight { rule: string; severity: 'high' | 'medium' | 'low'; finding: string; evidence: string; action: string; docs: string }
export interface InsightsInput { gsc?: GscQueryResult; cf?: CfQueryResult; staleCodesPages?: string[] }
export function buildInsights(input: InsightsInput): Insight[]
export function formatInsights(list: Insight[], degraded: ('gsc' | 'cf')[]): string  // markdown,按 severity 排序 high>medium>low
```

规则(纯函数实现):
1. `low-ctr`:GSC rows 按 page 聚合,`impressions >= 200 && ctr < 0.03` → action 改 title/description,docs 指 `.agent/skills/anvil-new-article`
2. `rank-5-15`:`100 <= impressions && 5 <= position <= 15` 的 query → 加内链/内容加深,docs 指 `docs/content-format.md`
3. `zero-impression`:`staleCodesPages` 之外的输入没有页面清单——此规则基于「GSC rows 里 impressions == 0 的页面」+ 注明完整排查看 sitemap;docs 指 `docs/seo.md`
4. `traffic-mix`:CF pages `visits >= 50` 的页在 GSC 聚合里 clicks `< visits / 20` → 流量来源结构问题(社交/直访为主),docs 指 `docs/seo.md`
5. `stale-codes`:`staleCodesPages` 每页一条 → action 走 `.agent/skills/anvil-update-codes`

- [ ] **Step 1: 写失败测试**(每规则 2 case:触发/不触发 + severity 排序 + degraded 渲染)
- [ ] **Step 2: 确认失败 → 实现 → 通过 → Commit**(`feat(ops): insights rule engine`)

### Task 3: gitops.ts + submit

**Files:**
- Create: `src/core/gitops.ts`
- Test: `test/gitops.test.ts`

**Interfaces:**
- Consumes: `runValidation`(Task 1)、`RunFn`
- Produces:

```ts
export interface SubmitResult { branch: string; prUrl: string }
export async function submit(opts: { cwd: string; title?: string; base?: string; run?: RunFn }): Promise<SubmitResult>
```

流程(全部经注入 run 执行 git/gh):
1. `git status --porcelain` 非空,否则 OpsError(fix: 先让 agent 写内容,或明确说明要提交什么)
2. `runValidation` 有 FAIL → OpsError(带失败项 summary,fix: 修复后重跑;不出 PR)
3. `git rev-parse --abbrev-ref HEAD` 确认不在 detached;分支名 `ops/submit-<YYYYMMDD>-<HHmm>`;`git checkout -b <branch>`
4. `git add -A` + `git commit -m <title|'ops: content update via anvil-ops'>`
5. `git push -u origin <branch>`
6. `gh pr create --title <title> --base <base|main> --body <校验结果 markdown>`;stdout 即 PR URL

- [ ] **Step 1: 写失败测试**:注入序列化 RunFn(按 cmd 前缀返回预设输出),断言:无改动抛错、校验失败短路(不执行 checkout)、成功路径命令顺序、PR body 含校验结果。另加 1 个真实 git 集成测试:临时目录 `git init` + 本地 bare 仓库为 origin + 注入假 gh(写 stdout PR URL),真 push 到 bare 仓库,断言分支存在。
- [ ] **Step 2: 确认失败 → 实现 → 通过 → Commit**(`feat(ops): submit flow with PR-gated publishing`)

### Task 4: CLI + MCP 三入口 + 收尾

**Files:**
- Modify: `src/bin/cli.ts`、`src/cli/commands/`(新增 audit.ts / insights.ts / submit.ts)、`src/mcp/server.ts`、`tools/anvil-ops/README.md`

**Interfaces:**
- Consumes: Task 1-3 全部
- Produces: `anvil-ops audit|insights|submit`;MCP 工具 `audit` / `insights` / `submit_pr`

要点:
- `insights` CLI/MCP:collectMetrics(注入透传)→ refresh-audit(runAudit 只取 stale 相关?直接跑 runAudit 取 refresh-audit check 输出解析过期页——v1 简化:runAudit 输出整段作为 staleCodesPages 证据传 null,规则 5 仅在传入时触发;CLI insights 先跑 refresh-audit 单命令拿 stdout,解析行首 URL 列表(每行 `path - ...` 格式由脚本决定,解析失败则跳过规则 5 不报错)。MCP insights 同 CLI 逻辑。
- `submit` flags:`--title`、`--base`(默认 main);MCP `submit_pr` 入参 `{ title?, base? }`
- README 状态行同步「P1-P3 完成」+ 命令表补 audit/insights/submit(一致性铁律)
- 冒烟:`anvil-ops audit` 在本仓库真跑一次;`anvil-ops submit` 干跑(无改动 → 应报 OpsError);MCP tools/list 五工具

- [ ] **Step 1: CLI/MCP 代码 + 测试(mcp.test.ts 补三工具的 list + insights 端到端 in-memory)**
- [ ] **Step 2: 冒烟 + 全量回归(tools test/typecheck/build + 根四命令)**
- [ ] **Step 3: Commit**(`feat(ops): audit/insights/submit in CLI and MCP` + README)

---

## Plan Self-Review 结果

- **Spec 覆盖**:§4 命令表 audit/insights/submit ✅;§5 MCP 三工具 ✅;§6 五规则+降级(gsc 缺 → 规则集缩小为 3/5,在 formatInsights degraded 参数体现)✅;§10 P3 验收「规则单测全绿 + 临时仓库 submit 出真 PR」✅(本地 bare origin 集成测试)。
- **类型一致性**:CheckResult/RunFn 在 Task 1 定义、Task 3/4 消费;SubmitResult 供 CLI/MCP 用;InsightsInput 与 collectMetrics 返回字段对齐。
- **范围**:P4(文档/发布)明确不在本计划。

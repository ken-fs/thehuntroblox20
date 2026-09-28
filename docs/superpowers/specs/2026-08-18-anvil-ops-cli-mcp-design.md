# anvilwiki-ops:站长运营 CLI + MCP server 设计

- 日期:2026-08-18
- 状态:已与用户确认(brainstorming 完成)
- 目标版本:npm 包 `anvilwiki-ops` 0.x 系列;模板侧集成随 v1.15 发版

## 1. 背景与定位

AnvilWiki 模板(v1.14.1)已解决「建站」:fork → apply-template → 部署 30 分钟上线。第一性原理推演(2026-08)结论:模板只覆盖 fork 用户目标函数的 20-25%,短板在**选品(0)与产能(5)**,护城河在内容工作流×schema 耦合(`.agent/skills/` 随模板分发)。

本包补上「上线之后」的一环:fork 用户在自己的 fork 仓库里,通过 AI agent(ZCode / Claude / 任意 MCP 客户端或 CLI 用户)自动化运营网站——

- **看数据**:拉取 Google Search Console 与 Cloudflare Web Analytics;
- **给洞察**:数据 → 优先级行动清单(SEO 优化建议);
- **产内容**:配合 `.agent/skills/` 产页 SOP,产出 MDX;
- **上线**:校验 → 分支 → commit → push → 开 PR(CI 门控全绿后人工合并,Cloudflare 自动部署)。

定位边界:只依赖「AnvilWiki 结构的仓库 + Node ≥22 + gh CLI」,不侵入模板代码,不改模板运行时(保持纯静态、零 JS 框架、Lighthouse 4×100 契约)。

## 2. 已确认的关键决策

| # | 决策点 | 结论 | 理由 |
|---|--------|------|------|
| 1 | 交付形态 | 独立 npm 包(npx 直跑)+ MCP server,共享 core | fork 用户零安装成本;MCP 一行接入;与模板解耦、独立 semver |
| 2 | 首版数据源 | GSC + Cloudflare Web Analytics | GSC 是 SEO 闭环核心数据;CF Analytics 模板默认已开、自家 API 接入成本低;AdSense API 门槛高推迟 |
| 3 | GSC 认证 | service account JSON(无头、无刷新令牌)+ CF API token,存本地 `.env` | 调用方是 AI agent,OAuth 浏览器流程与 token 刷新对无头场景是灾难 |
| 4 | 写操作边界 | 写文件 → 本地校验 → 建分支 → push → 开 PR,不碰 main | 人工把关 + 可回滚;与既定 v2.0「PR 门控 CI 内容管道」方向一致 |
| 5 | 仓库结构 | 本仓库子目录 `tools/anvil-ops/`,单包双 bin | 单仓开发、dogfood(对着 anvilwiki.pages.dev 真数据测)、文档互引零成本;fork 多带一份纯源码目录,不参与 astro build,零影响 |

## 3. 架构

```
tools/anvil-ops/
├── src/
│   ├── core/              # 唯一业务逻辑层,不知道 CLI/MCP 存在
│   │   ├── site.ts        # 站点发现:定位仓库根、读 wrangler.toml [vars]、解析 SITE_URL / PUBLIC_CF_BEACON_TOKEN
│   │   ├── providers/     # 纯数据拉取层,互不依赖
│   │   │   ├── gsc.ts     # service account JWT(google-auth-library)→ Search Analytics API searchanalytics.query(page/query 维度)
│   │   │   └── cloudflare.ts # GraphQL API api.cloudflare.com/client/v4/graphql(token 只需 Account.Analytics:Read)
│   │   ├── content.ts     # 校验编排:child process 调 pnpm check-content / check-i18n / build(不重实现模板校验,单一真相源在模板)
│   │   ├── gitops.ts      # branch / commit / push / gh pr create(复用 gh CLI,不自己管 GitHub token)
│   │   └── insights.ts    # 规则引擎:providers 数据 → 优先级行动清单(纯函数)
│   ├── cli/               # 命令壳:参数 → core → 输出格式化(table/json/md)
│   └── mcp/               # MCP stdio server 薄层:tools 定义 + JSON schema,直接映射 core 函数
├── package.json           # 独立包 name=anvilwiki-ops,bin 双入口;与模板根 package.json 互不依赖
└── vitest.config.ts
```

bin 入口:

- `anvil-ops` —— CLI(`npx anvilwiki-ops <command>`)
- `anvil-ops-mcp` —— MCP server(stdio;等价 `anvil-ops mcp` 子命令,独立 bin 方便 MCP 配置直接写)

扩展原则:core 是唯一业务层;未来加 AdSense/Plausible provider、Codex 插件、GitHub Action 入口都不动已有入口。

## 4. CLI 命令集(v1)

| 命令 | 做什么 | 依赖 |
|---|---|---|
| `anvil-ops doctor` | 体检:env 逐项检查、gh 可用性、GSC 资源可访问性、CF token 有效性、SITE_URL 解析;输出「哪里没接好 + 怎么修」报告 | 无(其他命令的前置) |
| `anvil-ops metrics [--days 28] [--format table\|json\|md] [--source gsc\|cf\|all]` | CF Analytics + GSC 汇总:请求量、点击、曝光、CTR、平均排名,按页/按查询词 | env 至少一项 |
| `anvil-ops audit` | 聚合模板已有检查(refresh-audit / check-i18n / check-content / check-links)为一份 markdown 报告 | 模板仓库 |
| `anvil-ops insights [--days 28]` | 数据 → 优先级行动清单,见 §6 | GSC+CF(可降级) |
| `anvil-ops submit [--title ...] [--base main]` | 对工作区改动:校验(check-content + check-i18n + build,由 content.ts 统一编排)→ 建分支 → commit → push → `gh pr create`;校验失败就地终止,不出 PR | gh + git + 模板仓库 |

`doctor` 是所有 agent 运营会话的第一步(工具描述中注明)。

## 5. MCP 工具集(v1)

与 core 函数一一映射,不发明第二套语义:

- `doctor` / `metrics` / `audit` / `insights` / `submit_pr`(即 submit)

约束:

- 工具 description 写清前置条件(如 submit_pr 需要工作区有改动、需要 gh);
- **不提供任何写 main / 直接 push main 的能力**,写操作只有开 PR 一条路;
- 错误以 MCP `isError: true` tool result 返回,内容为可操作修复指引;
- 输出统一 markdown(给模型读),不渲染表格为 ASCII。

## 6. insights 规则引擎(v1 规则集)

输入:GSC(page/query 级点击、曝光、CTR、排名)+ CF Analytics(页面请求、来源)+ audit 结果。输出:按预期收益排序的 markdown 行动清单,每条含**现象 / 证据(数据)/ 建议动作 / 对应技能或文档链接**。

| # | 规则 | 触发条件(v1 阈值) | 建议动作 |
|---|------|--------------------|----------|
| 1 | 低 CTR 改写 | 曝光 ≥ 200 且 CTR < 3% 的页面 | 改 title/description,指向 anvil-new-article SOP |
| 2 | 排名 5-15 加深 | 查询词平均排名 5-15 位 | 加内链、内容加深,指向内容 SOP |
| 3 | 零曝光排查 | sitemap 有页面但曝光 = 0 | 查收录与内链入口,指向 seo 文档 |
| 4 | 流量结构 | CF 高流量页 ∩ GSC 低点击 | 来源结构分析(社交/直访 vs 搜索) |
| 5 | 时效性 | refresh-audit 报告的过期 codes 页 | 走 anvil-update-codes 技能 |

阈值常量集中在 `insights.ts` 顶部;规则 = 纯函数(数据 → 建议),单测友好。GSC 未配置时跑降级规则集(3/5)并在输出注明。

## 7. 配置与认证契约

延续模板 env 门控哲学:**空 = 功能禁用,不报错**。

```
# .env(gitignored;.env.example 提供注释模板)
GSC_SERVICE_ACCOUNT_JSON=   # 以 { 开头 = 内联 JSON 字符串;否则 = 文件路径
CF_API_TOKEN=               # 权限:Account.Analytics:Read
CF_ACCOUNT_ID=              # 可选;缺省时 doctor 给出获取指引
```

- site tag(`PUBLIC_CF_BEACON_TOKEN`)从 `wrangler.toml [vars]` 读取——模板已接线,用户零额外配置;
- GSC 未配 → metrics 只出 CF 部分,insights 跑降级规则;CF 未配 → 只出 GSC;全未配 → doctor 逐项给修复指引;
- GitHub 操作复用 `gh` CLI(模板 workflow 已要求用户安装),包不接管 token;无 gh 时 submit 给出安装指引;
- 包内不硬编码任何 key/域名(与模板工程约束 8/9 一致)。

## 8. 错误处理

- 每条命令失败输出:哪一步、什么原因、跑什么命令修(优先给 doctor);非零退出码;
- providers 网络错误区分:401/403(凭据/授权问题,指向修复)vs 429(退避重试一次)vs 网络(提示重试);
- MCP 层转换为核心错误为 `isError: true`,不抛裸异常给客户端;
- 所有输出消息英文(与仓内 scripts 一致),文档(handbook/README)中英双语。

## 9. 测试策略

- **单元**:providers 用录制的 API fixture(GSC JSON、CF GraphQL 响应)mock 测;insights 规则纯函数直测;site.ts 用临时目录 fixture(wrangler.toml 各种形态)测;
- **集成**:gitops + content 编排在临时 git 仓库中测(init → 改动 → submit dry-run);
- **dogfood 端到端**:本仓库 demo 站 anvilwiki.pages.dev(CF Analytics 真实开启)+ 测试 GSC 资源,验收 metrics/insights 真数据;
- MCP 层:用 MCP SDK 的 in-memory client 测 tools 注册与调用。

## 10. 构建顺序(4 个子项目,各自 spec→plan→实现)

| 阶段 | 内容 | 验收 |
|------|------|------|
| P1 | core 基座 + CLI:site 发现、doctor、metrics(GSC+CF 双 provider)、单测 | `npx` 对 demo 站拉到真数据;doctor 报告准确 |
| P2 | MCP 薄层:`doctor` + `metrics` 两工具(基于 P1 已有 core)+ dogfood | MCP 客户端(ZCode/Claude)实测调通 doctor+metrics |
| P3 | insights 规则引擎 + audit 聚合 + submit PR 流程 + MCP 补齐 `audit`/`insights`/`submit_pr` 三工具 | 规则单测全绿;临时仓库 submit 出真 PR |
| P4 | 文档与发布:handbook 开发手册新增「AI 自动化运营」章、README、skills 引用、npm 发布流程、模板 v1.15 发版(全仓一致性扫描) | 一致性铁律检查清单清零;npm 可安装;CI 绿 |

P2 依赖 P1 的 doctor/metrics,P3 可与 P2 并行开发但发布顺序在 P2 后。

## 11. 非目标(v1 明确不做)

- AdSense / Plausible / GA4 接入(等用户反馈,加 provider 即可);
- 直接 push main 或任何绕过 PR 的写路径;
- OAuth 浏览器授权流程;
- 定时自动开 PR(继续由 content-pipeline.yml 每周 issue + agent 会话驱动,不自动改内容);
- 模板运行时改动(零 JS、纯静态契约不变)。

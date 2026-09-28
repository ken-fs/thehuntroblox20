# 三站踩坑复盘加固批（2026-08-29）

**来源**：飞书《游戏 Wiki 站踩坑复盘：Steal An Egg / No Man's Sky / Aniimo》（2026-08-18，48 类问题）对照 v2.3.1 全量审计，盘出 17 项仍存缺口。本批落地其中 16 项（1 项复核后裁定不动）。

**审计结论摘要**：复盘 48 条中大部分模板已闭环（sitemap lastmod 真值、og:image 尺寸策略、幽灵路由门禁、wrangler.toml 域名门禁、双 H1 lint、hreflang 真实覆盖、E-E-A-T 作者体系、refresh-audit 等）。本批只处理「三站用真实事故换来的教训、模板层仍然敞开」的部分。

## 批次与决策记录

### 批 1 — SEO 信号四件（复盘 #8 #11 #12 #13 #15/#44）

| 项 | 决策 | 要点 |
| --- | --- | --- |
| 尾斜杠 `never`→`always` | **翻转**（复盘盖章终态） | 见批 4，独立成批 |
| 空分类/空语言列表页 | noindex + 移出 sitemap + alternates 按真实覆盖 | ListPage `noindex={entries.length===0}`（LocaleLayout 通路已存在）；astro.config 新增 categoryCoverage，空列表路径进 noindexPaths；alternatesFor 列表分支改按覆盖语言集合；页面级 <head> 经新 `localesForCategory()` 同步，避免 sitemap 与页面 hreflang 冲突（Google 丢弃冲突簇） |
| 文章级 FAQ | frontmatter 可选 `faq: [{question, answer}]` | 可见 `<details>` 区块 + 复用 `faqPageJsonLd`；与 codes FAQ 合并为单个 FAQPage（一页一个）；新 i18n 键 `shared.faqTitle`（en/ja 双语，strict-ui 门禁） |
| 智能标题后缀 | `pageTitle()` 三分支 | 含游戏名（`site.game.name`）→ 不加后缀；>50 字符 → `— ${site.shortName}`；否则 `— ${site.name}`。BaseLayout:83 的 includes 双拼接防线同步测 shortName |
| 相关文章三层兜底 | tags 交集 → 同 category 补足 → 仍为 0 才全站最新 | 删「tags 空即 []」早退；纯函数下沉 `lib/content-utils.ts`（i18n/content.ts 依赖 astro:content 不可测） |

### 批 2 — 小件（复盘 #10 #17 #44 #安全守则）

- footer 补 `/recent` `/tags` 入口：复用 `recentPath()/tagsPath()` + `shared.recentTitle/allTags` 现成键，**零新增 i18n 键**（修 #17 孤儿页）。
- footer 免责声明与版权行**分开渲染**（copyrightText 之上/下加 `site.legalNotice` 独立行）——修 `copyrightText ?? legalNotice` 短路；apply-template.ts 重写 copyrightText 后 fork 站仍保留免责声明。
- `twitter:card` 非文章页 `summary`→无条件 `summary_large_image`（全站 og:image 均 ≥1200 宽）。
- `.gitignore` 增 `*-secret.json` / `*.pem` / `*.key` / `seo-reports/`（复盘安全守则「建站期就写好」）。
- **StickyBanner 桌面端 sticky：复核后裁定不动**。复盘 #37 的「sticky 只留移动端」针对 Adsterra 320×50 移动条在桌面误显；本模板是 728×90 桌面 leaderboard、带 dismiss + CLS 预留 + 移动端明确排除（注释在案），AdSense 政策允许。两场景不同源，不跟随。

### 批 3 — 门禁与工具（复盘 #15 #16/#22 #26）

- check-content 新规则 5：**非默认语言正文内链必须带语言前缀**（`/guides/x` 在 ja 正文里 = 静默跳英文，Aniimo 177 处事故）；error 级。排除：外部链接、锚点、带扩展名资源、图片语法。
- check-content 新规则 6：**正文站内链接 <3 条 → warning**（不炸 build）。
- `pnpm submit-indexnow`：fs 读 `dist/sitemap-index.xml`→递归展开 loc→按 10000 分批 POST `api.indexnow.org`；key 自动生成/检测（`public/{key}.txt`，hex，内容=文件名）；key 文件未部署时响亮提示（先部署再推送）。
- `pnpm gen-assets`：复用 gen-covers 管线（globals.css 品牌色 + satori/resvg/Lato + CJK subset），按**现有文件名**原地生成 favicon.svg、favicon-16/32.png、apple-touch-icon.png、android-chrome-192/512.png、hero.webp（1200×630）——引用点零改动；hash manifest 缓存同款。favicon.ico sharp 无法生成：保留旧文件、BaseLayout 改引 svg+png（有 link 标签后浏览器不再请求 .ico）。

### 批 4 — 尾斜杠全站翻转（复盘 #8，最大单批）

同步触点（侦查 agent 全量清单）：
1. `astro.config.ts` trailingSlash + filter/serialize 前 strip 归一化 + alternatesFor 输出带斜杠；
2. `src/lib/url.ts` localizePath（root 特判反转）——全站 path 构造的唯一龙头；
3. `scripts/check-content.ts` 规则 4 反转（必须以 / 结尾，排除资源/锚点/图片语法/root）；
4. `SearchButton.astro` processResult 剥斜杠→保斜杠；子结果拦截器同翻；
5. `SiteHeader.astro:61` active 态 startsWith 归一化（path 已带斜杠时不再拼接）；WikiSidebar 两侧自洽；
6. `handbook.ts` handbookPath、`llms.txt.ts:71`、`BaseLayout.astro:119`（privacyHref）、`LegalContent.astro:230`、`SiteHeader.astro:83/144` 补斜杠；
7. `src/config/landing.ts` 40+ 硬编码 `/landing/...` href（en+zh 两段）批量补斜杠；
8. 存量 demo MDX 内链迁移到带斜杠形态；
9. 测试同步：url.test / tags.test / handbook.test / seo.test 断言翻转；
10. 注释与文档口径反转：url.ts / check-content / check-links / rss.xml / SearchButton 注释、content-format.md 链接示例、两个 skill 的写作规则、AGENTS.md L98 描述。
11. 明确**不改**：deployment.md SITE_URL「无尾斜杠」（env origin 语义）、seo.md GSC UI trick、anvil-ops GSC API 契约、CHANGELOG 历史条目、manifest start_url。

### 批 5 — 文档批（复盘 #1/#45 #4 #16 #33/34/35/36 #32 #Q15）

- deployment.md：L18 后「唯一部署源」🚨 警告框（NMS 双仓库覆盖事故）；L97「先绑域名→改 SITE_URL→再部署」顺序铁律；SEO 验证节第 3 项 Crawler Hints + IndexNow 指引；L274 内链口径与 content-format 对齐（≥3）。
- ads.md：「脚本粘哪里」整节改写为**独立 html 文件 + iframe sandbox** 模式（`allow-scripts allow-same-origin allow-popups allow-forms`，绝不 `allow-top-navigation`；每位独立文件防 atOptions 串号）；新增「怎么验证广告真的在展示」（只信手机 4G 实测 + Impressions；无头 403=反自动化）。节号「三、」保持不动（多处在链锚点）。
- content-format.md：正文规则新增「关键词密度」（游戏名密度 1-3%，模板默认标题堆到 5-6% 属堆砌）；「每篇 ≥3 条站内链接」；L17 引用块升级硬规范「新建分类必须先有文章再进 navigation.ts」；frontmatter 表加 `faq` 行；L148 链接示例改带尾斜杠。
- 手册第 6 章（get-on-google，**非第 8 章**）双语：第 3 步后加「第 4 步：IndexNow 一把推全站」；「卡住了怎么办」补 GSC 网页索引四种状态灯；`updated: 2026-08-29`；**不动 tldr**（en 已 475/480 上限）。
- `.agent/skills/anvil-new-article|anvil-batch-articles` 尾斜杠口径反转。
- AGENTS.md：Authoring 硬规则插「非默认语言内链带前缀」「≥3 内链」两条；L98 命令描述同步。

## 验证口径

全部门禁本地跑绿：`pnpm lint / typecheck / test / check-config / check-content / check-i18n --strict-ui / build / check-links`（check-links 需先 build）。发版三件套（版本号三处/横幅/CHANGELOG 定档）**不在本批**，留给 release 批。

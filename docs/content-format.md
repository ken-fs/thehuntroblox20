# MDX 文章格式

> 怎么写一篇 AnvilWiki 的 MDX 文章。文章是 wiki 的核心——文件路径即 URL。

---

## 文件位置与 URL 映射

文章放在 `src/content/wiki/<locale>/<category>/<slug>.mdx`：

```
src/content/wiki/en/bosses/emberfang.mdx           → /bosses/emberfang
src/content/wiki/en/guides/beginner-guide.mdx  → /guides/beginner-guide
src/content/wiki/ja/bosses/emberfang.mdx           → /ja/bosses/emberfang（日文版）
```

> `category` 必须与 `src/config/navigation.ts` 的 `key` 一致。**新建分类必须先有文章，再进 `navigation.ts`**——空分类的列表页是 thin content（约百词的空状态页），进了导航就会进 sitemap「邀请收录」低质页面（真实事故：/starships 空分类页被收录）。正确顺序：先写好第一批 3-5 篇文章放进新分类目录，再把分类加进导航。

---

## Frontmatter（YAML 头部）

每篇文章用 YAML frontmatter 声明元数据。**构建时会用 Zod schema 校验**——字段缺失或类型错误会导致 build 失败。

```mdx
---
title: 'Emberfang Boss Guide - Complete Strategy'
description: 'Complete strategy guide for defeating Emberfang, including attack patterns and weaknesses.'
category: 'bosses'
date: 2026-08-11
lastModified: 2026-08-12
image: '../../../../assets/covers/emberfang-cover.png'
tags: ['boss', 'ice', 'early-game']
noindex: false
---
```

### 字段说明

| 字段           | 类型     | 必填 | 校验规则                             | 用途                                     |
| -------------- | -------- | ---- | ------------------------------------ | ---------------------------------------- |
| `title`        | string   | ✅   | ≤ 80 字符                            | SEO title + H1（正文不写 H1）            |
| `description`  | string   | ✅   | 40-165 字符                          | meta description + 文章副标题            |
| `category`     | string   | ✅   | 必须在 `navigation.ts` 的 key 列表里 | 决定 URL 路径和列表页归属                |
| `date`         | date     | ✅   | ISO 格式（YYYY-MM-DD）               | 发布日期 + Article JSON-LD datePublished |
| `lastModified` | date     | 可选 | ISO 格式                             | 最后修改日期（JSON-LD dateModified + sitemap lastmod；boss/tier-list 超 90 天自动显示"可能过期"提示） |
| `image`        | string   | 可选 | 相对 MDX 文件的路径（走 Astro Image） | 封面图（og:image，缺省用 hero；**1200×675**，v2.0 起标准——Google Discover 大图预览要求 ≥1200px 宽） |
| `tags`         | string[] | 可选 | 默认 `[]`                            | "相关文章"推荐 + 标签聚合页（`/tags/<tag>`，v1.5 起文章页 tag 可点击） |
| `draft`        | boolean  | 可选 | 默认 `false`                         | 草稿：`pnpm dev` 可预览，生产构建完全排除（页面/列表/RSS/sitemap） |
| `gameVersion`  | string   | 可选 | ≤ 20 字符                            | 适用的游戏版本号（如 `v2.5`），文章头渲染成徽章——快速迭代游戏的时效性/E-E-A-T 信号 |
| `noindex`      | boolean  | 可选 | 默认 `false`                         | 设为 `true` 禁止搜索引擎索引此页         |
| `summary`      | string   | 可选 | ≤ 400 字符（40–60 词直答）           | Quick Answer 卡片 + AI Overviews 摘要候选 |
| `author`       | string   | 可选 | 缺省用 `site.defaultAuthor`           | 作者署名（E-E-A-T）                       |
| `boss`         | object   | 可选 | hp/weakness/resistant/location/recommendedLevel | 结构化 Boss 数据卡（正文前渲染）   |
| `videos`       | string[] | 可选 | YouTube 视频 ID（11 位，非完整 URL）  | 文章底部"相关视频"懒加载嵌入（每条生成 VideoObject JSON-LD） |
| `gallery`      | object[] | 可选 | image/caption/alt（v1.7）            | 文章底部缩略图画廊 + 原生 dialog lightbox（每张生成 ImageObject JSON-LD） |
| `codes`        | object[] | 可选 | code/reward/status/expiryDate/source（v1.8） | codes 页结构化数据：正文前自动渲染 Active（CodeBlock 一键复制）/ Expired（表格）分区 + FAQPage JSON-LD |
| `faq`          | object[] | 可选 | 每项 `{question, answer}`（非空字符串） | 文末可见 FAQ 区块 + FAQPage JSON-LD（可见内容与结构化数据一致，符合 Google 富结果政策） |

### 可在 MDX 中使用的模板组件

MDX 里可以直接 import 模板组件（无需任何配置）：

```mdx
import CodeBlock from '~/components/article/CodeBlock.astro';
import StatBar from '~/components/article/StatBar.astro';
import Callout from '~/components/mdx/Callout.astro';
import Accordion from '~/components/mdx/Accordion.astro';

<CodeBlock code="FORGE-2026" label="+500 Gold · expires Aug 31" />

<StatBar label="Molten Gem" value={35} />
<StatBar label="Rare Helm" value={5} note="1 in 20 runs" />

<Callout type="warn" title="Patch v2.5">Mechanics changed in this patch — the old strat no longer works.</Callout>
<Callout type="tip">Ice weapons shorten this fight by a third.</Callout>

<Accordion title="Phase 2 details (spoiler)">战术细节……</Accordion>
```

- **CodeBlock** — 一键复制游戏兑换码（codes 页留存神器）
- **StatBar** — 掉落率/属性条形可视化
- **Callout** — 提示框，`type`: `info`（默认）/ `tip` / `warn` / `danger`，零 JS（v1.5）
- **Accordion** — 原生 `<details>` 折叠面板，用于分阶段打法/剧透/平台差异，零 JS（v1.5）
- **AffiliateLink** — 联盟/外链 CTA 卡片，自动带 `rel="sponsored nofollow"`（SEO 合规的第二变现渠道，v1.7）
- **Video** — 正文内联 YouTube 播放器（懒加载 facade）。放哪渲染哪：`<Video id="..." title="..."/>`；**id 必须同时登记进 frontmatter `videos`**（VideoObject JSON-LD 来源），已内联的 id 不会在文末重复渲染（v1.8）。demo 用的是稳定占位视频 ID，fork 后替换为你自己的实机视频（改内联 `id` + frontmatter `videos` 两处）

### 媒体密度建议（排名因素）

纯文字页在游戏 wiki 赛道没有竞争力。按页面类型给参考密度（demo 文章均按此示范）：

| 页面类型 | 封面 | 正文内联图 | gallery | 视频 |
| --- | --- | --- | --- | --- |
| boss 攻略 | ✅ 必配 | 机制说明处按需 | 2-4 张（机制图/路线图） | ≥1（关键躲避点） |
| 教程/路线 | ✅ 必配 | 每个大节可配 1 张 | 路线/流程图 2 张 | 按需 |
| tier list/对比 | ✅ 必配 | 重点条目 1 张卡片图 | 可选 | 按需 |
| codes | ✅ 必配（分享卡片辨识度） | 无需 | 无需 | 无需 |

> **封面图质量 = 图片搜索入口**（2026-03 起 Google 选图首选 og:image）：封面不再是装饰，每篇文章的封面直接决定该页在 Google 图片搜索里的展示。挑图三原则：清晰可辨（缩略图下仍认得出游戏）、带游戏视觉标识（角色/logo/UI，不用纯文字图）、与文章主题对应（boss 文章不配风景图）。
>
> **尺寸标准（v2.0）：1200×675**（16:9 且满足 Google Discover 大图预览的 ≥1200px 宽要求；全站已声明 `max-image-preview:large`）。没有制图条件时跑 `pnpm gen-covers`——用站点名+品牌色+标题自动生成排版封面（中/日文标题自动子集 Noto 字体），并自动写入 frontmatter `image` 字段。

### 作者体系（v1.7）

frontmatter `author` 除署名展示外，还可在 `src/config/authors.ts` 注册该作者的
主页 URL / 社交链接 —— 文章头署名变成链接，Article JSON-LD 的 author 从
Organization 升级为 **Person**（E-E-A-T 加分）。不注册则维持原样。

### Patch notes / 更新日志范式

游戏每次版本更新都是搜索流量高峰（玩家搜 "game name patch notes August"）。不需要专门的 contentType：在 `navigation.ts` 加一个 `patch-notes` 分类，每篇文章对应一个版本（`date` 用版本日期、`lastModified` 持续更新），首页用 `timeline` displayType 模块自动呈现版本时间线，RSS 会把每次更新推给订阅者。demo 的 codes 文章（`src/content/wiki/en/codes/all-codes.mdx`）演示了同类"高频更新"内容的完整写法。

### 校验失败示例

```mdx
---
title: 'Guide' # ❌ 太短（虽然 ≥1 字符就过，但 SEO 不好）
description: 'Short' # ❌ 少于 40 字符，build 失败
category: 'unknown' # ❌ 不在 navigation.ts，路由 404
date: '上周二' # ❌ 不是 ISO 格式，Zod 解析失败
---
```

---

## 正文规则

### 从 H2 开始，不写 H1

```mdx
---
title: 'Emberfang Boss Guide'
---

## Boss Overview ← ✅ 第一个标题是 H2

...
```

**不要写 H1**——`ArticlePage` 组件自动用 frontmatter 的 `title` 渲染 H1。如果你也写 H1，会导致双 H1，影响 SEO。

### 关键词密度（别堆游戏名）

标题和正文里游戏名的重复度保持在 **1-3%**。本模板的标题体系默认处处带游戏名（站名、H1、分类标题、首页模块名），正文再照抄这个习惯，游戏名密度会冲到 5-6%，属于关键词堆砌，谷歌会压排名。写法：标题里游戏名最多出现一次，正文自然提及即可——页面主题靠站内互链和分类结构传达，不靠重复名词。

### 每篇至少 3 条站内链接

从每篇文章正文链向 **≥3 篇**本站相关文章（`check-content` 会给不足 3 条的文章出 warning）。内链帮谷歌理解站点结构，也给新页面导权重；零内链的文章是「孤岛页」，收录和排名都吃亏。链接要落在自然的语境词上，不要文末堆一排。

### 支持的 Markdown 语法

- 标题（H2-H4，建议不跳级）
- 列表（有序/无序）
- 表格（GitHub Flavored Markdown）
- 代码块（```语法高亮）
- 引用（`>`）
- 链接（站内页面用带尾斜杠的绝对路径，如 `/bosses/emberfang/`——全站 trailingSlash 为 always；外链用完整 URL）
- 图片（`![alt](/images/articles/xxx.png)`，正文图片放 `public/images/articles/`，建议 16:9（800×450）——globals.css 为正文图预留 16:9 盒子，非 16:9 会信箱式留边，不裁剪、零 CLS）
  - ⚠️ 封面图（frontmatter `image` 字段）不同：走 Astro Image 优化（自动 WebP/srcset），放在 `src/assets/covers/`，写相对 MDX 文件的路径。详见上面的 frontmatter 示例。gallery 图（`src/assets/gallery/`）同封面走优化管线。
  - 💡 demo 示范：`en/bosses/stormcaller.mdx`（gallery 机制图）、`en/guides/weapon-tier-list.mdx`（正文内联卡片图）、`en/guides/beginner-guide.mdx`（gallery 路线图）。demo 素材可用 `node scripts/gen-demo-media.mjs` 复现/修改。

### MDX 扩展（可选）

MDX 支持 JSX 组件，但 AnvilWiki 默认不引入 React 组件。如果你需要复杂交互，参考 [PRD §ADR-002](./PRD.md#adr-002为什么用纯-astro-原生组件而不是-react-islands) 的说明。

---

## 从其他格式迁移文章

如果你手上的文章用的是 JS 元数据写法（常见于 Next.js / MDX 项目）：

```mdx
export const metadata = {
  title: "文章标题",
  description: "描述",
  category: "bosses",
  date: "2026-08-01",
  tags: ["guide"]
};

## 正文从 H2 开始
...
```

AnvilWiki 用 YAML frontmatter，需要手动改成：

```mdx
---
title: "文章标题"
description: "描述"
category: "bosses"
date: 2026-08-01
tags: ["guide"]
---

## 正文从 H2 开始
...
```

**迁移步骤**：
1. 删除 `export const metadata = { ... };` 整块（连同末尾分号和空行）
2. 在文件最顶部加 `---` 包裹的 YAML frontmatter，字段一一对应
3. YAML 里字符串值用双引号包裹，数组用 `[...]` 语法，日期不加引号
4. 其余正文内容不变
5. 运行 `pnpm build` 验证 frontmatter 通过 Zod schema 校验

> 批量迁移时，可以用 AI 编辑器（Cursor / Claude Code）的正则替换功能，或写一个简单的 Node 脚本完成转换。模板不内置转换脚本——frontmatter 字段少、格式简单，手动或 AI 辅助转换即可。

---

## 多语言文章

每种语言一个目录：

```
src/content/wiki/
├── en/bosses/emberfang.mdx     → /bosses/emberfang
└── ja/bosses/emberfang.mdx     → /ja/bosses/emberfang
```

### Fallback 行为

| 场景                                         | 行为                                                         |
| -------------------------------------------- | ------------------------------------------------------------ |
| 访问 `/ja/bosses/emberfang` 且**有日文版**       | 显示日文                                                     |
| 访问 `/ja/bosses/emberfang` 但**无日文版**       | **自动回退英文**（不 404），页面显示 "English fallback" 标记 |
| 访问 `/ja/bosses/`（列表页）且**无日文文章** | 显示空状态（**不回退英文**）                                 |

> 这种不对称是设计决策：详情页保证 URL 可达（不 404），列表页保证准确性（不展示没有的内容）。

---

## 文件命名规范

slug（文件名）= URL 最后一段：

```
src/content/wiki/en/bosses/emberfang-boss-guide.mdx → /bosses/emberfang-boss-guide
```

**规则**：

- 全小写
- 单词用连字符分隔（`emberfang-boss-guide`，不是 `EmberfangBossGuide` 或 `emberfang_boss_guide`）
- 不含特殊字符（`?:/`)
- 建议：与目标关键词一致（SEO）

---

## 新建文章脚手架

```bash
pnpm new-post
# 交互式输入：locale / category / slug / title
# 自动生成带 frontmatter 的 MDX 模板
```

> 已实现（`scripts/new-post.ts`）。运行 `pnpm new-post` 交互式生成。

---

## 下一步

- [套用模板指南](./apply-template.md)
- [SEO 说明](./seo.md)
- 回到 [README](../README.md)

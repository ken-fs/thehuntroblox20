# SEO 工程化

> AnvilWiki 的 SEO 设计原则：**填好内容，SEO 标签由构建流程自动生成**。
>
> 文章写好 frontmatter，首页改好 en.json，构建时自动产出 title / 结构化数据 / sitemap / 多语言 alternate 链接。

---

## 自动生成的 SEO 要素

| 要素                                       | 哪里生成                   | 数据来源                                     |
| ------------------------------------------ | -------------------------- | -------------------------------------------- |
| `<title>`                                  | `BaseLayout.astro`         | 各页面的 title prop                          |
| `<meta description>`                       | `BaseLayout.astro`         | 各页面的 description prop                    |
| `og:title` / `og:description` / `og:image` | `BaseLayout.astro`         | 同上 + image prop                            |
| `twitter:card`                             | `BaseLayout.astro`         | 自动 summary_large_image（文章页）或 summary |
| Organization JSON-LD                       | `BaseLayout.astro`（全站） | `src/config/site.ts`                         |
| WebSite JSON-LD                            | 首页 `index.astro`         | `site.ts`                                    |
| Article JSON-LD                            | `ArticlePage.astro`        | 文章 frontmatter                             |
| BreadcrumbList JSON-LD                     | `ArticlePage.astro`        | 文章 + 分类                                  |
| ItemList JSON-LD                           | `ListPage.astro`           | 分类下所有文章                               |
| FAQPage JSON-LD                            | 首页（可选）               | `en.json` 的 `home.faq.items`                |
| hreflang alternates                        | `BaseLayout.astro`         | 遍历 `routing.locales`                       |
| sitemap.xml                                | `@astrojs/sitemap`         | 自动扫描所有页面                             |
| robots.txt                                 | `src/pages/robots.txt.ts`  | 含 sitemap 链接                              |
| canonical URL                              | `BaseLayout.astro`         | `SITE_URL` + 当前路径                        |

---

## 各页面的 SEO 产出

### 首页

```html
<title>Anvil Quest Wiki - Complete Boss Guides, Codes & Tier Lists</title>
<meta name="description" content="..." />

<!-- JSON-LD -->
<script type="application/ld+json">
  { "@type": "Organization", "name": "...", "url": "...", "logo": "..." }
</script>
<script type="application/ld+json">
  { "@type": "WebSite", "name": "...", "url": "...", "potentialAction": {...} }
</script>
<script type="application/ld+json">
  { "@type": "FAQPage", "mainEntity": [...] }
</script>
```

**title 来自**：`en.json` 的 `home.meta.title`（独立配置，不复用文章格式）。

### 列表页（如 /bosses）

```html
<title>All Bosses — Anvil Quest Wiki</title>

<script type="application/ld+json">
  {
    "@type": "ItemList",
    "name": "All Bosses",
    "itemListElement": [
      { "position": 1, "name": "Emberfang Boss Guide", "url": "..." },
      ...
    ]
  }
</script>
```

**title 来自**：`en.json` 的 `overview.bosses.overviewTitle`。

### 文章页（如 /bosses/emberfang）

```html
<title>Emberfang Boss Guide - Complete Strategy — Anvil Quest Wiki</title>
<meta property="og:type" content="article" />
<meta property="og:image" content="https://domain/images/emberfang.jpg" />
<meta name="twitter:card" content="summary_large_image" />

<script type="application/ld+json">
  {
    "@type": "Article",
    "headline": "...",
    "datePublished": "...",
    "dateModified": "...",
    "author": { "@type": "Organization" },
    "publisher": { "@type": "Organization" }
  }
</script>
<script type="application/ld+json">
  {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "position": 1, "name": "Home" },
      { "position": 2, "name": "All Bosses" },
      { "position": 3, "name": "Emberfang Boss Guide" }
    ]
  }
</script>
```

**数据来自**：文章的 frontmatter（title / description / image / date / lastModified）。

> **JSON-LD 类型参考**：[schema.org](https://schema.org/)（[Organization](https://schema.org/Organization) / [WebSite](https://schema.org/WebSite) / [Article](https://schema.org/Article) / [BreadcrumbList](https://schema.org/BreadcrumbList) / [ItemList](https://schema.org/ItemList) / [FAQPage](https://schema.org/FAQPage)）、[Google 结构化数据入门](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)

---

## hreflang 多语言链接

每个页面 `<head>` 自动注入所有语言版本的 alternate：

```html
<link rel="alternate" hreflang="en" href="https://domain/bosses/emberfang" />
<link rel="alternate" hreflang="ja" href="https://domain/ja/bosses/emberfang" />
<link rel="alternate" hreflang="x-default" href="https://domain/bosses/emberfang" />
```

`x-default` 指向英文版（默认语言）。

> **参考**：[Google 多语言版本指南](https://developers.google.com/search/docs/specialty/international/localized-versions)（hreflang + x-default 用法）、[Astro i18n 文档](https://docs.astro.build/en/guides/internationalization/)

---

## sitemap 生成规则

**核心原则**：sitemap 只包含**实际存在的 MDX 文件**对应的 URL，**禁止**从硬编码数组生成。

```
构建时：
1. @astrojs/sitemap 扫描所有已生成的静态页面
2. 为每个页面生成 <url> 条目
3. 自动加 hreflang alternate（基于 astro.config.ts 的 i18n 配置）
4. 输出 dist/sitemap-0.xml + dist/sitemap-index.xml
```

**为什么不能硬编码**：列表页的卡片数据（en.json 里的 highlights）可能包含尚未写成文章的条目。如果 sitemap 从卡片数组生成，会产生指向 404 的 URL，损害 SEO。

> **参考**：[sitemaps.org 协议规范](https://www.sitemaps.org/protocol.html)、[Google sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)

---

## og:image 绝对路径（强制）

社交平台抓 OG 图要求**绝对路径**：

```html
<!-- ✅ 正确 -->
<meta property="og:image" content="https://domain.com/images/hero.webp" />

<!-- ❌ 错误（相对路径，社交平台抓不到） -->
<meta property="og:image" content="/images/hero.webp" />
```

由 `SITE_URL` 环境变量拼接，**禁止硬编码域名**。

> **参考**：[Open Graph 协议（ogp.me）](https://ogp.me/)（og:image 必须是绝对 URL）、[Google 搜索结果摘要指南](https://developers.google.com/search/docs/appearance/snippet)

---

## SEO 检查清单（上线前）

```
□ title 50-60 字符，含游戏名 + 核心关键词
□ description 150-160 字符，含关键词 + CTA
□ 每页有且仅有一个 H1
□ H1-H4 层级正确，不跳级
□ og:image 是绝对路径，图片真实存在
□ sitemap.xml 可访问，URL 数 = 实际页面数
□ robots.txt 可访问，含 sitemap 链接
□ Google Rich Results Test 验证 JSON-LD 全通过
□ hreflang 覆盖所有语言，x-default 指向英文
□ 移动端适配正常
□ Lighthouse SEO 分数 ≥ 95
```

> **检查清单依据**：[Google title 标签指南](https://developers.google.com/search/docs/appearance/title-element)（title 长度建议）、[Google 搜索结果摘要指南](https://developers.google.com/search/docs/appearance/snippet)（description）、[Google 语义 HTML 指南](https://developers.google.com/search/docs/appearances/semantic-html)（H1 单一性、标题层级）、[MDN 标题元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements)

### 用 Google Rich Results Test 验证

1. 访问 https://search.google.com/test/rich-results
2. 输入你的页面 URL
3. 确认所有 JSON-LD 类型（Organization / Article / Breadcrumb / FAQ）都通过

---

## 提交 Google Search Console

1. 打开 https://search.google.com/search-console
2. 添加资源 → 选"网域"方式 → DNS 验证
3. 在 Cloudflare 加 TXT 记录 → 验证所有权
4. 提交 `sitemap-index.xml`（注意是 sitemap-index.xml，不是 sitemap.xml）
5. 等 24-48 小时看收录

> GSC 常见 bug：第一次提交失败可能有缓存，在 URL 末尾加斜杠 `/` 重新提交。

---

## AI 搜索时代：让内容被 AI Overviews / ChatGPT 引用

2025-2026 年 Google AI Overviews 导致出版商搜索流量普遍下降（问答型查询首当其冲——而游戏 wiki 的"怎么打 X""最新 codes"正是问答型）。AnvilWiki 内置了应对这套打法的基础设施，你写作时按下面的规则做即可最大化被引用概率。

### 模板已内置的部分（自动生效）

| 能力 | 作用 |
|---|---|
| `summary` frontmatter + Quick Answer 卡片 | 40-60 词直答块，AI Overviews / featured snippet 抓取的最爱 |
| `llms.txt`（`/llms.txt`） | 给 ChatGPT/Perplexity/Claude 的站点内容索引，构建时自动生成 |
| `boss` frontmatter 数据卡 | 结构化键值对（HP/弱点/位置），AI 倾向引用结构化答案 |
| Article / FAQPage JSON-LD | 语义化结构，AI 爬虫仍解析（FAQ rich result 虽废弃） |
| sitemap `<lastmod>` | Google 唯一信任的调度字段，更新后重新抓取得更及时 |
| RSS feed（`/rss.xml`） | 内容分发的去中心化管道，配合聚合器/IFTTT 自动推送 |

### 写作规则（你需要做的）

1. **H2 用问题句式**：写 `## How do I beat Emberfang in phase 1?` 而非 `## 第一阶段打法`。用户的搜索词就是问题，AI 匹配问题标题。
2. **答案紧跟标题，40-60 词**：H2 下面第一段直接给答案，再展开细节。不要铺垫。
3. **用原生表格/有序列表呈现数据**：掉落率、配装、tier list 用 Markdown 表格（模板已做移动端横滑优化），AI 解析表格的准确率远高于散文。
4. **每篇必填 `summary`**：这是你的"AI 摘要候选人"字段。
5. **时效内容标注日期**：codes/patch notes 类文章的 `lastModified` 保持更新——AI 引用偏好新鲜内容，模板超 90 天会自动显示过期提示。

### 参考（公开权威来源）

- Google 官方：[优化生成式 AI 功能指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [llms.txt 规范](https://llmstxt.org/)
- [Google Search Central 官方更新日志（What's New）](https://developers.google.com/search/updates)

---

## 外链策略（什么时候做、做多少、去哪找、怎么接）

模板能帮你把站内 SEO 做到 100 分，但外链（别的网站链接到你的站）是站外的事，只能靠运营。本章先校准预期和时机，再给出**去哪找外链、一条条怎么接**的完整操作清单——照做即可。

### 先校准预期：外链在新站期不是主矛盾

- 外链在 Google 排名因素里占约 **13%**（实操观察值）——重要，但不是最大头。
- **弱竞争新词期是特例**：一个新游戏刚爆，所有人都是新站、都没有外链，这时**页面质量、产品体验、停留时长 > 外链**。实战中出现过外链个位数的站，排在几千条外链的老站前面——大家都在早期，比的是综合得分，谁先把内容和体验做好谁赢。

### 策略排序（按阶段）

1. **排名没起来前**：别死磕外链。把时间全部投进内容质量和页面体验（首版核心页写透、内链铺好、盯着 [deployment.md 的数据复盘指标](./deployment.md)）。
2. **排名起来了再补外链**：核心词进了前两页、增长放缓，这时候每一条外链才是雪中送炭。

### 渠道清单：去哪找外链

该补外链了，先看全景再动手。按「对你这个游戏 wiki 的匹配度 × 成功率」排序：

| 优先级 | 渠道 | 链接属性 | 成功率 | 一句话 |
| --- | --- | --- | --- | --- |
| ★★★ | Reddit 游戏社区回答问题 | nofollow 为主 | 高 | 你的目标玩家就在这 |
| ★★★ | Steam 社区（指南 + 讨论区） | 可带链接 | 高 | 每个游戏的社区页，写真指南自然带出你的站 |
| ★★☆ | Discord 游戏服务器 | 看频道设置 | 中 | 官方/社区服务器的资源频道，问版主收录 |
| ★★☆ | 同类站换链（DR 换链） | dofollow | 中 | 找 DR 高一点的同类站互挂 |
| ★★☆ | YouTube 小创作者 | 视频描述 | 中 | 换数据/时间戳，描述里挂你的站 |
| ★☆☆ | 资源页收录（outreach） | dofollow | 低-中 | 邮件求收录，模板见下 |
| ★☆☆ | 断链替代（outreach） | dofollow | 中 | 找死链给替代，站长有真实动机修 |
| ★☆☆ | HARO 类记者询源 | dofollow | 低（游戏垂类询源少） | 顺手参与，别当主渠道 |
| 兜底 | 目录站/书签站批量发 | 混合 | 看站点 | 人肉先验证再批量，质量参差 |

> **nofollow 是什么**：HTML 里带 `rel="nofollow"` 的链接，Google 把它当「不背书」信号，权重传递大打折扣——但**真实用户会点、会记住你的站、会搜你的站名**，这些间接信号对排名有实打实的帮助。游戏社区（Reddit/Steam/Discord）的链接多为 nofollow，但它们带来的是**精准玩家流量**，是新站最该先拿的东西。

### 逐个渠道怎么操作

#### 1. Reddit：回答问题式外链（首选，你的玩家就在这）

Reddit 的自推规则是全站性的「10% 规则」——你的全部活动里，自推内容不能超过一成，违反了不是删帖是封号。正确姿势不是发广告，是**回答问题**：

1. 注册账号，**先当 1 到 2 周普通用户**：在相关 subreddit 里评论、投票、参与讨论（养号是硬成本，跳过它后面全是封号）
2. 找你游戏的 subreddit：Reddit 站内搜游戏名 + 看各社区侧边栏的关联社区推荐；r/gaming（4700 万成员）这类大站也允许 10% 以内的自推
3. **读版规**：每个 subreddit 的 Rules 和 sidebar wiki（有的完全禁自推，有的有每周自留地帖）
4. 盯「有人问攻略/兑换码/boss 打法」的帖子：先给**完整的答案**（在帖子里直接解决问题），末尾附一句「我写了篇更细的图文版：你的链接」
5. 有每周自推帖（weekly self-promotion thread）的社区，固定去发一次

铁律：答案本身必须有独立价值——把答案说完了才提链接，而不是「想知道就点链接」。前者是贡献，后者是垃圾。

#### 2. Steam：社区指南和讨论区

每个 Steam 游戏都有社区页（讨论区 + 指南区），这是离目标玩家第二近的地方：

1. 打开你游戏的 Steam 页 → 右侧**社区中心**（steamcommunity.com/app/游戏ID）
2. **指南（Guides）区写一篇真指南**：比如「新手开荒 10 条」，写得和站内文章一样认真，指南内自然引用你的站（「完整数据表在我的站：链接」）
3. **讨论区回答问题**：和 Reddit 同一姿势——有人卡关提问，先给答案再给链接
4. 注意：Steam 对「开发者自推」有额外限制（开发者只能宣传 Steam 版本），你是第三方攻略站反而不受限；但**别刷**——一游戏一指南，讨论区以帮忙为主

#### 3. Discord：进官方服务器的资源频道

大部分游戏有官方或社区 Discord，里面常有 FAQ / 资源 / 攻略频道：

1. 加入你游戏的 Discord（Steam 页或官网一般有邀请链接）
2. 先潜水看频道规则（很多服务器禁直接发链接）
3. 正路两条：**问版主**「我维护了一个该游戏的攻略站，能不能收录进资源频道」；或在有人提问时**先答后链**（和 Reddit 同姿势）

#### 4. YouTube 小创作者：换挂链接

做该游戏视频的小 YouTuber（几千到几万订阅）和你一样在起步，互挂性价比高：

1. YouTube 搜游戏名，筛订阅量几千到几万的小创作者（大创作者不理你）
2. 私信提议：**你免费给他提供数据 / 时间戳 / 文字版攻略，他的视频描述里挂你的站**
3. 你的站要有他视频缺的东西（详细数据表、图文版）才有交换价值——先想清楚你能给什么

#### 5. DR 换链：同类站互挂

找 DR（Domain Rating，Ahrefs 的网站权重分）比你高一点的同类站交换友链——高太多的不理你，同量级的最好谈。

1. 用 [Ahrefs 免费 Backlink Checker](https://ahrefs.com/backlink-checker) 查候选站的 DR
2. 候选从哪来：Google 搜你的核心词，第 2-5 页的同类站（他们和你抢词，互挂等于变竞争为同盟）；或看对手的外链来源（同一个工具）
3. 找联系方式：站内 About/联系页，或用 [Hunter.io](https://hunter.io) 按域名挖邮箱（每月有免费额度）
4. 邮件照抄改：

   ```text
   Hi [Name],

   I run [你的站名] — a guide site for [游戏名] ([你的链接]). I've been reading your [具体某篇文章名] and really liked it.

   Would you be open to a link exchange? I'd add your site to my resources page, and you'd add mine — both sites cover [游戏名] from different angles, so readers win.

   Either way, keep up the good work!

   [你的名字]
   ```

5. 换链放在**真实有用的位置**（资源页 / 相关阅读），别做全站 footer 互链（Google 对 footer 链接农场敏感）

#### 6. 资源页收录：求被收录

很多站点维护「该游戏最佳资源/攻略」的列表页，这类页面本来就是给你收录的：

1. 找资源页，Google 搜这些组合：`游戏名 guides`、`游戏名 resources`、`游戏名 best tools`、`inurl:resources 游戏名`、`inurl:links "游戏名"`
2. 筛出真的资源页（列表里都是同类工具/攻略站，而不是乱七八糟的导航农场）
3. 邮件照抄改：

   ```text
   Hi [Name],

   I noticed your resource page for [游戏名] ([页面链接]) — great list!

   I maintain [你的站名] ([你的链接]), a [游戏名] wiki with [具体内容：boss 数据库 / 兑换码每日更新 / 开荒攻略]. I think it'd be a solid addition for your readers.

   Feel free to check it out — happy to answer any questions.

   [你的名字]
   ```

4. 回复率不高（5%-15% 正常），先走完 10-20 个高质量候选，再考虑扩大

#### 7. 断链替代：帮站长修死链

资源页上的老链接会失效（404），你的同类内容可以当替代品——站长有真实动机修：

1. 找到资源页后（上一步的搜索法），用 [Ahrefs 免费 Broken Link Checker](https://ahrefs.com/broken-link-checker) 扫它的死链；没工具就肉眼逐个点
2. 确认死链原来的内容主题，确认你站上有对等或更好的内容（没有就先写一篇）
3. 邮件照抄改：

   ```text
   Hi [Name],

   Quick heads-up — on your [游戏名] resources page ([页面链接]), the link to "[死链标题]" is broken (404).

   I maintain a similar resource: [你的链接] — covers [对应内容] and stays updated. Feel free to swap it in if helpful.

   [你的名字]
   ```

4. 「帮人修问题」的打开率比「求收录」高，这是 outreach 里成功率最好的一类

#### 8. HARO 类记者询源：顺手参与（低优先级）

HARO（Help a Reporter Out）是记者找信源的平台——2024 年底一度关停，2025 年被 Featured 收购后在 [helpareporter.com](https://helpareporter.com) 复活，免费。每天三封询源邮件，你以「游戏内容站长」身份回复，被引用就拿到新闻站的 dofollow 外链。

如实说：游戏垂类的询源**很少**（多为金融/健康/商业类），所以它是「顺手参与」而非主渠道——注册后每天花两分钟扫一眼，有游戏相关的就回。同类平台还有 [Qwoted](https://qwoted.com) 和 Source of Sources。

#### 9. 批量发：目录站/书签站（兜底，谨慎）

多找**免登录 / 注册后即可发帖留链接**的站点（部分论坛、书签站、聚合站）。先**人肉确认**一个站点真的能发、带链接、不被秒删，确认后再让 AI 写脚本批量发——省得脚本对着一批发不出去的站点空转。质量参差不齐，只当兜底，不当主力。

### 怎么验证外链真的生效（发出去 ≠ 有外链）

外链台账里有三种状态，**混在一起就会自己骗自己**：

| 状态 | 意思 | 怎么验证 |
| --- | --- | --- |
| 已提交 | 你把链接发出去了 | 只说明你动手了，什么都没证明 |
| 已公开 | 对方页面真的挂上了你的链接 | **打开那个公开页**，肉眼确认链接在；别信「提交成功」的回执 |
| 已收录 | Google 把那个公开页收进了索引 | `site:对方域名` 或 GSC 里能查到那个页面 |

「已公开」这一步还有两个暗坑，逐条核对渲染出来的 `<a>` 标签：

1. **最终 href 是不是你的直链**——链接先跳 `对方域名/out.php?id=123` 再 302 到你站的，是计数跳转链，权重传递和稳定性都打折扣；
2. **`rel` 属性是什么**——`nofollow` / `ugc` / `sponsored` 的链接不传递权重（但真实玩家点击、记住站名、回来搜站名的间接价值依然在，见上面渠道清单里的 nofollow 说明）。

最后一条**现实校准**：社区流传的「几百条免费外链清单」别高估——有开源项目把一份 743 条的清单逐条实测，**能免注册直接提交的只有 5.5%，两成已经死站**（部分还返回 200，内容早被改成垃圾页）。所以本节的建议从头到尾是「先人肉验证再动手」：清单只当线索，不当事实。

> **数据源推荐**：[yan-labs/yan-skills](https://github.com/yan-labs/yan-skills) 的 `backlink` 技能维护着一份机读的提交入口库（400+ 条，按「要不要注册/有没有验证码/要不要互链」分类，MIT 协议，每次实测后回写状态）。挑批量渠道前先翻它，能省掉大部分试错——本文不内置这份数据，因为外链站死活变化快，用最新版好过用快照。

### 免费工具箱

| 工具 | 用途 |
| --- | --- |
| [Ahrefs Backlink Checker](https://ahrefs.com/backlink-checker) | 免费查任意站的 DR 和前 100 条外链（找换链候选、看对手外链来源） |
| [Ahrefs Broken Link Checker](https://ahrefs.com/broken-link-checker) | 免费扫资源页死链（断链替代用） |
| [Hunter.io](https://hunter.io) | 按域名找站长邮箱，每月免费额度够个人用 |
| Google 搜索操作符 | `inurl:resources`、`inurl:links`、`"游戏名" guides` 找资源页 |

### 多久做一次、做多少（节奏）

- **outreach 类**（换链/资源页/断链）：每周固定 1-2 小时，发 10-20 封**逐封改过**的邮件，别群发一模一样的模板
- **社区类**（Reddit/Steam/Discord）：融进日常——每天刷社区顺手答题，一周带 2-3 次链接足够（守住 10% 规则）
- **增长曲线**：每周新增 3-10 条是健康节奏；一个月暴涨几百条反而像买的（Google 对链接增速异常敏感，暴涨 = 作弊信号）

### 警告

**外链质量 > 数量。** 一条相关内容站的外链胜过一百条垃圾站。别买垃圾外链（群发外链、链接农场）——轻则无效，重则手动处罚，新站直接报废。

---

## Google 官方规范更新记录（2026）

> 摘自 [Search Central What's New](https://developers.google.com/search/updates)，只列对游戏 wiki 模板有影响的条目。上次同步：2026-08-22。

| 日期 | 更新 | 对本模板的影响 |
|---|---|---|
| 2026-08-18 ~ 08-21 | **Spam update**（排名系统，全球多语言，[状态面板](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history)） | 排名更新非文档更新。模板的防 spam 打法已合规：原创内容 skill 禁伪造、`draft` 门控、`AffiliateLink` 自动加 rel。无需代码改动，发版后观察 GSC 即可 |
| 2026-08-20 | **Preferred sources 文档**新增：站点可添加自定义交互按钮（AI Mode 引用来源展示） | AI Mode 会优先引用"preferred sources"。游戏 wiki 做垂直深内容（boss 数据、codes）正是入选路径；自定义按钮需跟踪官方实现方式，暂无模板层动作 |
| 2026-07-29 | GSC 新增 **社交/视频平台内容分析** | 若你在 YouTube/TikTok 发游戏视频，可在 GSC 看平台内搜索表现；模板的 VideoObject JSON-LD + 视频页仍服务 Google Video 搜索 |
| 2026-07-24 | **Review snippet 指南**：未披露的激励好评（免费物品换好评）属违规 | tier-list / 推荐类文章如含 affiliate，必须用 `AffiliateLink` 组件（自动 rel=sponsored + 站内披露）——模板已内置，写作时不要绕过它 |
| 2026-07-10 | **Canonicalization 故障排查文档**澄清（rel=canonical 与 301 混用等反模式） | 模板是纯静态、canonical 由 `BaseLayout` 统一输出，无混用问题；fork 用户迁移旧域名时读该文档即可 |
| 2026-06-15 | **官方澄清 `llms.txt` 对 Google 搜索无影响**（不使用、无正负作用） | 保留 `/llms.txt`——它服务 ChatGPT/Perplexity/Claude 等 AI 助手（这些不遵循 Google 的表态），但对 **Google** 的 SEO 预期应为零。landing 文案将其定位为"AI 搜索基础设施"而非 Google SEO 卖点，此定位仍然准确 |
| 2026-05-08 | **FAQ rich result 从 Google 搜索完全移除** | 模板的 FAQPage JSON-LD 仅剩结构化语义价值（AI 爬虫解析），**不再有任何 SERP 富展示收益**。保留成本低，暂不移除；若追求精简可删 `faqPageJsonLd` |
| 2026-03-02 | 图片选择澄清：**`og:image` 成为 Google 搜索选取图片的首选来源** | 模板 og:image 已是绝对路径 + 真实图片（工程约束 #7），每篇文章的 cover 图现在同时决定 Google 图片搜索展示——封面图质量变得更重要 |
| 2026-02 | **Discover core update** | Discover 流量波动属正常；模板的 E-E-A-T 基建（Person JSON-LD、author 体系、时效徽章）是对 Discover 的正确长期投入 |

---

## v1.5–v1.8 新增的 SEO 资产

| 资产 | 位置 | 作用 |
|---|---|---|
| 标签聚合页 | `/tags/<tag>`(各语言独立生成,不回退) | 每篇文章的 tags 变成可收录的内链枢纽页,扩大长尾索引面 |
| `/recent` 页 | 全语言 | 承接 "patch notes / update" 类查询;配合 sitemap lastmod 提升回访 |
| VideoObject JSON-LD | 有 `videos` 的文章 | Google Video 搜索富结果资格 |
| ImageObject JSON-LD | 有 `gallery` 的文章 | Google Images 收录资格 |
| Person JSON-LD | `src/config/authors.ts` 注册过作者的文章 | author 实体从 Organization 升级为 Person(E-E-A-T),支持 sameAs |
| FAQPage JSON-LD | 有 `codes` frontmatter 的文章 | 本地化四问(redeem/过期/频率)结构化 |
| gameVersion 徽章 | 文章头 | 时效性信号,配 90 天过期横幅(STALE_CATEGORIES) |
| game.config 式新鲜度 | content-pipeline 每周审计 | codes >7 天 / 时效分类 >90 天自动开 issue |

注意:FAQPage 富结果 Google 已于 2026-05-08 从搜索中完全移除,其价值仅在结构化信号(AI 爬虫解析),无 SERP 样式收益。

## 下一步

- [挖词与选词完整指南](./sourcing.md) —— 去哪找下一个值得做的游戏
- [内容格式](./content-format.md)
- [套用模板指南](./apply-template.md)
- 回到 [README](../README.md)

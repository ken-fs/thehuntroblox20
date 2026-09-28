---
name: anvil-batch-articles
description: 从用户给的关键词清单批量生成一批符合 AnvilWiki schema 的 MDX 内页：按搜索意图归类 → 生成 new-posts.csv → pnpm bulk-new-posts 批量建草稿 → 按统一提示词模板逐篇填充 → 全批验收。触发词：批量写文章 / 一次生成一堆攻略 / 关键词清单生成页面 / batch articles。
---

# AnvilWiki 批量内页生成

把一份关键词清单变成一批构建必过的 MDX 页面。单篇规范与 `anvil-new-article` 完全一致——本技能只解决「批量」的产能与一致性。**先读规范再动手**（与 anvil-new-article 相同）：

1. `docs/content-format.md`（frontmatter 字段表 + 正文规则）
2. `src/content.config.ts`（Zod schema——构建时硬校验）
3. `src/config/navigation.ts`（category 必须是这里的 key）
4. `docs/handbook/zh/batch-pages.md`（方法论来源：批量≠灌水）

## 工作流

### Step 1 — 意图归类（照抄 anvil-new-article 的分类表）

用户给的关键词清单（每行一个搜索词），先逐行判断搜索意图：

| 关键词特征 | category 建议 | 页面形态 |
|---|---|---|
| 兑换码 / codes / redeem / 奖励码 | `codes` | `codes:` frontmatter 数组 + Active/Expired 自动分区 + FAQPage JSON-LD |
| Boss 名 / 打法 / 属性 / how to beat | `bosses` | `boss:` 结构化数据卡 + 按阶段 H2 |
| 教程 / 路线 / 怎么 / how to | `guides` | 问题式 H2 + 每节首段 40-60 词直答 |
| 排名 / 对比 / best / tier | `guides`（或 tier-list 分类若存在） | 表格为主 |

清单里意图不明的词**列出来问用户**，不要猜。

### Step 2 — 生成清单文件 `new-posts.csv`

- 列：`locale,category,slug,title,description`（description 可后补，脚本会写 TODO 占位）。
- slug 规则：小写、连字符、只留游戏名允许的字符（`bulk-new-posts` 会自动规范化并报告改动）。
- title 含游戏名 + 关键词，≤80 字符。
- 先跑 `pnpm bulk-new-posts --dry-run` 看计划（已存在的文件会被跳过，绝不覆盖），确认后去掉 `--dry-run` 真实写入——全部是 `draft: true` 草稿，不会进 build。

### Step 3 — 按统一提示词模板批量填充正文

**不要每篇临时想结构。** 每类意图用同一份固定结构，逐篇填素材：

- 通用骨架（所有意图）：
  1. 首个 H2 = 该关键词的问题式改写（"How do I …?"）
  2. 每个 H2 后第一段 40-60 词直答（Quick Answer / AI 摘要候选）
  3. 数据进 Markdown 表格，步骤用有序列表
  4. 至少 1 条内链指向**真实存在**的相关文章（`grep` 或 `pnpm build` 后 `pnpm check-links` 验证），无合适页面就不加
  5. frontmatter 硬规则同 anvil-new-article：description 40-165 字符、summary 40-60 词直答、tags 复用已有词汇表、不写 H1
  6. 非默认语言（如 ja）正文里的站内链接必须带语言前缀（`/ja/bosses/x/`）——裸 `/bosses/x/` 会静默跳到英文页
- codes 页额外：`codes:` 数组逐条登记（code/reward/status/expiryDate/source），正文只写怎么兑换
- bosses 页额外：`boss:` 数据卡（hp/weakness/resistant/location）+ 按阶段 H2
- **同批反重复**：同一批文章之间，开头句式、小节命名、表格列头不允许模板化复用——每篇从关键词本身的问法出发组织语言

### Step 4 — 全批验收（必须执行）

```bash
pnpm check-content     # H1/alt/跳级/尾斜杠 lint（页面内链必须以 / 结尾）
pnpm build             # Zod schema + 全站构建
```

任何一篇失败就修复后重跑，两个命令全绿才算完成。然后把「仍是 draft、素材不足待补」的篇目列成清单告诉用户。

> **可选**（anvilwiki-ops ≥0.1）:批量完成后 `npx anvilwiki-ops submit --title "batch: <N> pages"` 走校验→分支→PR。

## 坑位提醒（必读，违反即废稿）

1. **批量 ≠ 灌水**：每篇必须独立地回答一个真实搜索问题。清单里没有素材支撑的词，宁可不做，或 `draft: true` + 标注「待补充」。
2. **禁止编造**：兑换码、Boss 数值、掉落率——没有用户提供的数据源就写不出真值，一律向用户要。一条假码毁掉整站信任。
3. **内链只指真实页面**：批量生成的内链最容易指向不存在的路径，`pnpm check-links`（build 后）是硬门禁。
4. **同批不复制句式**：批量最大的 SEO 风险是「同一模板换名词」被判定 doorway pages——用 Step 3 的反重复规则。
5. **draft 转正逐篇决定**：批量建出来的全是 draft，由用户逐篇确认素材真实后翻正，不要整批一把梭。

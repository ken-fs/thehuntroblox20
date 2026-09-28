# 同步上游更新(Staying Up to Date)

> fork 之后如何持续吸收 AnvilWiki 上游的新功能,而不丢失你自己的游戏配置和内容。

## 核心原则:三层分离让 merge 可行

AnvilWiki 的代码/配置/内容三层分离(见 README)正是为这个场景设计的:

| 层 | 目录 | fork 后你会改吗 | merge 冲突概率 |
| --- | --- | --- | --- |
| Code | `src/pages` `src/components` `src/lib` `src/i18n` | 几乎不碰 | 低 |
| Config | `src/config` `src/locales` `src/styles/globals.css` `wrangler.toml` `astro.config.ts` | 一定会改 | **高(预期内)** —— 注意 `wrangler.toml` 存在时是 Pages env 的唯一真相源（dashboard 被忽略），见 [deployment.md](./deployment.md) |
| Content | `src/content` `src/locales/<loc>.json` 的 home 数据 | 一定会替换 | 高(预期内) |

上游新功能(组件、页面、脚本)几乎全部落在 Code 层,所以 merge 通常很干净。

## 同步步骤

```bash
# 1. 添加上游 remote(一次性)
git remote add upstream https://github.com/PNGTRID/AnvilWiki.git

# 2. 拉取并合并
git fetch upstream
git merge upstream/main

# 3. 冲突时:Config/Content 层的冲突永远保留你自己的值
#    (你的游戏名、主题色、文案、文章),只把上游 Code 层的改动收进来。

# 4. 验证三件套
pnpm check-config   # 三处一致性(分类 key / 语言列表)
pnpm build          # schema 校验 + 构建
pnpm check-links    # 内链对账(build 后)
```

## 版本策略(SemVer)

- **MAJOR**(如 v2.0):重大里程碑。若含 breaking change,CHANGELOG 会附迁移说明,按说明操作;**v2.0.0 对模板仓库零 breaking**——常规 merge 即可,无迁移步骤(唯一契约变化在 `anvilwiki-ops` npm 包 0.x→1.0.0:MCP 工具加了可选 `site` 参数,不传则行为与 0.x 一致)。
- **MINOR**(如 v1.5 → v1.6):新功能,默认关闭或向后兼容(env 门控),merge 后开箱行为不变。
- **PATCH**:bug 修复,直接 merge 即可。

**兼容性承诺**:
- frontmatter 字段只增不改名,旧文章永远能构建;
- 所有可选功能(广告/评论/赞助/分析/affiliate 建议位)都是 env/config 门控 + 默认关闭,新版本不会让它们自动开启;
- `src/locales/<locale>.json` 缺 key 时运行时回退英文,merge 上游新增的 UI key 不会报错(可用 `pnpm check-i18n` 查看缺哪些)。

## 升级到 v2.0(2026-08)

v2.0 是「里程碑 major」:四件新能力(PR 门控内容管道 / anvilwiki-ops 1.0 多站 / `pnpm gen-covers` 封面生成 / AffiliateSuggestion 建议位)全部是**加法**,三层分离不动:

```bash
git fetch upstream && git merge upstream/main   # 与往常完全一样
pnpm install                                     # 新增 devDeps:satori/@resvg/resvg-js/subset-font/yaml
pnpm check-config && pnpm build && pnpm check-links
```

两个可选动作:
- 想用内容管道:Settings → Actions → 勾 "Allow GitHub Actions to create and approve pull requests",见 [content-pipeline.md](./content-pipeline.md);
- 封面标准从 800×450 升到 **1200×675**(Google Discover 大图预览要求 ≥1200px 宽 + 全站已声明 `max-image-preview:large`)——存量封面不用改,新建封面可用 `pnpm gen-covers` 自动生成。

## 每次同步后的检查清单

```bash
pnpm check-config   # 配置三处一致
pnpm check-i18n     # 上游新增 UI key → 你需要翻译的清单
pnpm typecheck && pnpm test && pnpm build
pnpm check-links    # dist/ 内链全检
```

## 不想同步怎么办

完全没问题。这是一个静态模板,不是运行时依赖 —— 你的 fork 冻结在某个版本也能永远跑下去。建议至少合并 PATCH(安全/bug 修复),用 `git cherry-pick` 挑选也行。

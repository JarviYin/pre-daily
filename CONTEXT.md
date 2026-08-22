# 会话上下文交接（Session Handoff）

> 新 session 开场先读本文件。最后更新：2026-08-22。仓库：pre-daily（main 分支 HEAD `a74f86e`）。

## 一句话定位

**Prediction Daily（预测市场中文早报）**：每天北京时间 8:00 发布，把 Polymarket 上"今天真正变化"的世界事件市场改写成中文信号解读。数据真实、绝不编造（产品红线）。技术栈：Next.js 16 App Router（RSC+ISR）· Tailwind v4 · Postgres + Drizzle · DeepSeek（OpenAI 兼容）· Vercel（含 Cron）。

- 生产：https://www.pre-daily.com ｜ GitHub：github.com/JarviYin/pre-daily ｜ Vercel 项目：`pre-daily`（已 link，`.vercel/project.json` 在仓库）
- 生产 DB：**Railway Postgres**（不是 Neon）。本地 `.env` 已从 Vercel production 拉回（`vercel env pull .env --environment=production --yes`），含 DATABASE_URL / LLM_API_KEY / CRON_SECRET / TELEGRAM_* 等。
- ⚠️ 生产库是 **push 工作流**：`__drizzle_migrations` 表不存在，`drizzle-kit migrate` 不能直接用（会从 0000 重放导致建表冲突）。改 schema 后：本地 `pnpm drizzle-kit generate` 生成 SQL，再**手动在目标库执行** SQL（表/列都用 IF NOT EXISTS 幂等写法）。

## 最近一个 session 做了什么（2026-08-22，四个上线）

### 1. SEO 主题映射精度修复（commit `db25bb5`）
- 根因：us-elections 关键词无国别限定 + geopolitics 优先级靠后 + 实体词缺失（Russian/French Election 落美国选举页、Hormuz/Iranian rials 落宏观页）。
- 修复：geopolitics 种子前置 + 实体词扩充（hormuz/rial/sanction/opec 等）；`scripts/remap-topics.ts` 全历史重映射（8 主题页从 4 → 8 个有内容）。

### 2. 新闻版正式化（commit `c636ae8`）
- `daily_issues.news` jsonb 列（迁移 `0010`，本地+生产均已执行）；`lib/news.ts` 生成（slug 硬校验回链，<3 条视为失败）；refresh/watchdog cron 主刊落库后 best-effort 生成；失败仅告警不影响主刊。
- `/news` 首页 + `/news/[date]` 历史（ISR 300s）；NewsView 共享组件；preview 原型页改存档视图。
- **双条推送**：主刊信号版后追加新闻版推送（用户已确认格式）。`scripts/gen-news.ts` 可回填（08-21 已回填，/news 上线即有内容）。
- sitemap 收录 /news；QA Gate 15 校验回链；upsertIssue 不写 news 列（重跑主刊不丢新闻）。

### 3. AI 垂直内容（commit `a74f86e`）
- 独立 `ai` 类目（CATEGORIES + categories.ts AI 规则置于 tech 前 + CategoryChip 配色）。
- gamma.ts 抄 finance quota 模式：`tag_slug=ai` 补充拉取(50) + AI_MIN=2 配额（与 finance 配额一起泛化）+ 常青 watchlist 4 市场按 slug 拉取（best-effort，全走既有门槛）。
- QA Gate 7e；`scripts/smoke-edition.ts` 冒烟脚本（不调 LLM 不写库，实测 AI=3/finance=3 配额生效）。

### 4. 断更根因排查（2026-08-22，无新 commit，结论如下）
- **实际断更日期是 08-15/17/19/20 四天**（16/18 正常发布），非此前以为的 17~20 连续四天。
- 时间线强相关：08-14 16:32 CST 部署论点线重构（407ba7e，管线新增 narrative/recap/宏观注入等大量 LLM 工作）后，**第一次 cron 运行（08-15）即开始间歇失败**。成功日全程仅 ~2 分钟（generatedAt 08:02），排除 Hobby 60s 限制（团队是 Pro，maxDuration=300 生效）。
- 运行时日志已过保留期（Pro ~1 天），无法取得直接证据；疑似新管线偶发 LLM/依赖超时或报错，整刊原子性（失败不落库）+ 告警无人可见放大了影响。
- 已加固：看门狗 cron（08-20 上线，21/22 均正常）；`lib/alert.ts` 告警回退到主推送频道（ALERT_CHAT_ID 未配置时不再静默）。
- 若再现：第一时间 `curl -H "Authorization: Bearer $CRON_SECRET" https://www.pre-daily.com/api/cron/refresh` 复跑 + 看 Vercel Observability 日志（保留期短，要快）。

## 上一轮 session（2026-08-21 前的三个上线，详见 git log）

论点线重构（`407ba7e`）· 新闻版原型（`67bc889`）· 每日 SEO 循环（`23eb26b`+`a267d90`+`ad37b16`）。

## 当前线上状态

- 今日刊（2026-08-22）已发布；`/daily`、`/news`、`/topic`、`/preview/news` 全部 200。
- 世界杯管线已过 SUNSET（2026-07-20），`wcActive()` 返回 false，相关代码休眠。

## 已知问题 / 待办候选（按价值排序）

1. **配置 SEO 测量与告警凭据**（用户自助，全部缺失中）：GSC 服务账号（`GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`/`GSC_SITE_URL`）、Baidu token（`BAIDU_PUSH_*`）、`TELEGRAM_ALERT_CHAT_ID`（给 @predaily_bot 发条消息后从 getUpdates 拿 chat_id；已加主频道回退，配置后告警分流）。配置后 SEO 循环"测量+反馈"环节激活。
2. **旧刊 ai 类目回填**：08-22 前的历史刊 AI 市场仍标 tech（仅影响主题页映射的美观，关键词命中已兜住大部分）；可在下次 remap 时顺手处理。
3. **AI watchlist 维护**：4 个常青市场 slug 到期（2026-12/2027-01）前需要换血；ai-timeline 主题页会自然受益于新类目。
4. **新闻版历史回填**（可选）：`pnpm tsx scripts/gen-news.ts YYYY-MM-DD` 可逐日回填更早刊期。

## 环境与命令备忘

```bash
# 安装依赖（注意：本机 registry 曾配 npmmirror 且不可达，用官方源）
pnpm install --registry=https://registry.npmjs.org --fetch-timeout=120000

# 类型/规范/构建
pnpm exec tsc --noEmit && pnpm lint && pnpm build

# 本地跑一期（需 .env：LLM key + DB；会真调 LLM、真写库）
pnpm tsx scripts/refresh.ts [YYYY-MM-DD]   # 不带参数=今天（Asia/Shanghai）
pnpm tsx scripts/qa.ts [YYYY-MM-DD]        # 发布质量门禁

# schema 变更：生成迁移 → 手动在目标库执行 SQL
pnpm drizzle-kit generate

# 新闻版：手动生成/回填某日（生产库需带 TubaLabs .env 的 DATABASE_URL 运行）
pnpm tsx scripts/gen-news.ts [YYYY-MM-DD]
# 选刊冒烟（不调 LLM 不写库）：验证类目配额/watchlist/策展
pnpm tsx scripts/smoke-edition.ts [topN]

# 部署 = git push origin main（Vercel 自动构建）；查状态/日志：
npx vercel ls pre-daily
npx vercel inspect <deployment-url> --logs
# （本机 vercel CLI 已装在 /Users/jarvi/.workbuddy/binaries/node/workspace/node_modules/vercel/dist/vc.js，直接 node 执行可绕 npx 安装超时）

# 手动触发线上 cron（SECRET 从 .env 读）
curl -H "Authorization: Bearer $CRON_SECRET" https://www.pre-daily.com/api/cron/seo
```

## 关键文件地图

| 文件 | 职责 |
|---|---|
| lib/pipeline.ts | 主刊端到端编排（含"绝不发假数据"硬规则 + recap 组装） |
| lib/gamma.ts | Polymarket 抓取/解析/策展/三层选刊（hero+heat+anchor，热度分，finance/AI 双配额 + AI watchlist） |
| lib/news.ts · lib/alert.ts | 新闻版生成（回链校验）· 失败告警（回退主频道） |
| lib/llm.ts | 逐市场分析 + 主编总结(narrative) + 复盘(recapDay) |
| lib/macro.ts | 宏观快照(10源) + 日历 + 上下文注入 |
| lib/seo-topics.ts / seo-llm.ts / seo-channels.ts / db/seo-queries.ts | SEO 循环四件套 |
| app/api/cron/{refresh,seo,watchdog,wc-push}/route.ts | 四个定时任务（refresh/watchdog 均含新闻版 best-effort） |
| app/topic/* · app/news/* · app/preview/news/* | SEO 主题页 · 新闻版正式路由 · 新闻版原型存档 |
| components/EditionView.tsx · NarrativeBlock · RecapBlock · Expandable · NewsView | 论点线页面 · 新闻版视图 |
| drizzle/0008 · 0009 · 0010 | narrative/recap 列 · SEO 两表 · news 列 |
| scripts/qa.ts | 发布前质量门禁（15+ 项） |
| scripts/gen-news.ts · smoke-edition.ts · remap-topics.ts | 新闻版回填 · 选刊冒烟 · 主题重映射 |

## 开发规约（重要）

- **AGENTS.md 规则**：这是 Next.js 16（有破坏性变化），写代码前先读 `node_modules/next/dist/docs/` 相关指南（route handler、params 是 `Promise`、route segment config 等）。
- **诚实性红线**：LLM 只允许基于传入数据写作；任何数据缺失必须明说/降级，绝不编造；发布失败保留上一刊 + Telegram 告警。
- **优雅降级**：所有外部依赖（数据源、推送、测量渠道）失败都不应阻塞主流程。
- 数据库列变更：新列一律可空/default（兼容旧行），渲染层按 null 回退。

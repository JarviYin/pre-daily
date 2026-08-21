# 会话上下文交接（Session Handoff）

> 新 session 开场先读本文件。最后更新：2026-08-21。仓库：pre-daily（main 分支 HEAD `ad37b16`）。

## 一句话定位

**Prediction Daily（预测市场中文早报）**：每天北京时间 8:00 发布，把 Polymarket 上"今天真正变化"的世界事件市场改写成中文信号解读。数据真实、绝不编造（产品红线）。技术栈：Next.js 16 App Router（RSC+ISR）· Tailwind v4 · Postgres + Drizzle · DeepSeek（OpenAI 兼容）· Vercel（含 Cron）。

- 生产：https://www.pre-daily.com ｜ GitHub：github.com/JarviYin/pre-daily ｜ Vercel 项目：`pre-daily`（已 link，`.vercel/project.json` 在仓库）
- 生产 DB：**Railway Postgres**（不是 Neon）。本地 `.env` 已从 Vercel production 拉回（`vercel env pull .env --environment=production --yes`），含 DATABASE_URL / LLM_API_KEY / CRON_SECRET / TELEGRAM_* 等。
- ⚠️ 生产库是 **push 工作流**：`__drizzle_migrations` 表不存在，`drizzle-kit migrate` 不能直接用（会从 0000 重放导致建表冲突）。改 schema 后：本地 `pnpm drizzle-kit generate` 生成 SQL，再**手动在目标库执行** SQL（表/列都用 IF NOT EXISTS 幂等写法）。

## 最近一个 session 做了什么（三次上线）

### 1. 论点线重构（commit `407ba7e`）
产品痛点"内容散、insight 不足"的修复：
- **单市场分析注入宏观上下文**：`macroBriefForAnalysis()`（lib/macro.ts）把行情 chips + 未来 5 天日历喂给每个市场分析师（lib/llm.ts `analyzeMarket(m, macroCtx)`）。
- **论点线 narrative**：`summarizeDay` 输出结构化 `thesis + pillars(2-4论据块) + counterView + watch`，落库 `daily_issues.narrative`（jsonb）。页面 `NarrativeBlock` 取代 summary 卡（旧刊自动回退）。
- **昨日判断复盘 recap**：`recapDay()`（lib/llm.ts）+ `buildRecap()`（lib/pipeline.ts）对比昨刊与今日同 slug 市场，只判 hit/miss/pending（诚实纪律：数据不足一律 pending）。落库 `daily_issues.recap`。
- 页面 `EditionView` 重构为论点线布局（复盘→论点→Hero→热度榜折叠→视角→催化剂→附录），热度榜默认展开 3 条（`Expandable` 客户端组件）。
- QA（scripts/qa.ts）新增 Gate 13/14。迁移 `0008`（narrative/recap 列）。

### 2. 新闻版产品原型（commit `67bc889`）
PM 方向验证："把 Polymarket 重大新闻总结出来"。
- 预览页 `/preview/news`（noindex）+ 数据文件 `lib/previewNewsData.ts`（真实一刊数据 + LLM 改写，数字已人工校正）+ 生成脚本 `scripts/gen-preview-news.ts` + 推送脚本 `scripts/push-preview-news.ts`（已推到 @predaily，message 147）。
- 用户对新闻版满意（"就这样"）。**正式化尚未做**（下一步候选：接入每日 cron、`/news` 正式路由、主推送格式切换或双条推送）。

### 3. 每日 SEO 循环（commit `23eb26b` + `a267d90` + `ad37b16`）
目标：通过 SEO 搜索带来流量曝光。每天自动跑一轮"采集→建页→分发→测量→日报→反馈"：
- **主题聚合页** `/topic/*`（8 个种子主题见 `lib/seo-topics.ts`：美联储利率/日本央行/科技IPO/AI时间线/美国选举/地缘/加密/宏观数据）。市场→主题是**确定性关键词+分类兜底映射**；文案每日由 LLM 批量刷新（`lib/seo-llm.ts`），失败回退确定性文案（绝不留空）。
- 表：`seo_topics`、`seo_reports`（迁移 `0009`，已在生产建表）。查询：`lib/db/seo-queries.ts`。
- 分发/测量：`lib/seo-channels.ts` —— IndexNow（用站点已有 key `90294919…`，验证文件在 public/）、Baidu 主动推送（env-gated）、GSC service-account JWT 拉昨日曝光/点击/top 查询（env-gated）。
- Cron 时间表（vercel.json，全部 Bearer `CRON_SECRET` 鉴权）：
  | UTC | 北京 | 路径 | 职责 |
  |---|---|---|---|
  | 00:00 | 8:00 | /api/cron/refresh | 主刊生成+发布+Telegram推送 |
  | 00:30 | 8:30 | /api/cron/seo | SEO 循环 |
  | 00:45 | 8:45 | /api/cron/watchdog | 看门狗：今日刊缺失则补发 |
  | 12:00 | 20:00 | /api/cron/wc-push | 世界杯数据刷新（已过 SUNSET，no-op） |
- sitemap.ts / public/llms.txt 已收录 topic 页。首轮实测：4 个主题页上线、IndexNow 提交成功、GSC/Baidu/alert chat 未配置（优雅降级）。

## 当前线上状态

- 今日刊（2026-08-21）已发布（看门狗上线前手动补发过一次；此前 08-17~20 断更，根因未完全定位——与 08-14 一次部署 Error 窗口有关，看门狗即为兜底）。
- `/topic`、`/topic/[slug]`、`/preview/news` 均在线 200。
- 世界杯管线已过 SUNSET（2026-07-20），`wcActive()` 返回 false，相关代码休眠。

## 已知问题 / 待办候选（按价值排序）

1. **配置 SEO 测量与告警**（用户可自助）：GSC 服务账号（`GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`/`GSC_SITE_URL`）、Baidu token（`BAIDU_PUSH_*`）、`TELEGRAM_ALERT_CHAT_ID`（cron 失败告警现在只进日志，没人看到）。配置后循环的"测量+反馈"环节激活。
2. **主题映射精度**：NVIDIA 市值市场因 Gamma tag 归入 macro 而落到 `macro-economy` 页（metaTitle 与页面主题有偏差）。种子词表/顺序可迭代；GSC 数据来了以后用"机会反馈"（`seo_reports.opportunities`）发现错配。
3. **新闻版正式化**：用户已确认方向。方案：生成逻辑并入 refresh cron（复用当日市场数据，一次 LLM 调用 ~$0.002）→ `/news` + `/news/[date]` + 主页入口/推送格式决策。
4. **AI 垂直内容**：Polymarket AI 市场丰富（AGI 时间线/模型里程碑/AI IPO/竞赛归属），但现产品几乎不覆盖（当日政治+宏观占 70%）。已给方案：独立 `ai` 类目 + 保底配额（抄 finance quota 模式）+ AI watchlist。
5. **断更根因**：08-17~20 cron 未产出，建议下次断更时用 `vercel logs` 查 cron 触发记录（本 session 日志流超时未查到）。

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

# 新闻版原型：重新生成内容 / 推送 Telegram
pnpm tsx scripts/gen-preview-news.ts
pnpm tsx scripts/push-preview-news.ts

# 部署 = git push origin main（Vercel 自动构建）；查状态/日志：
npx vercel ls pre-daily
npx vercel inspect <deployment-url> --logs

# 手动触发线上 cron（SECRET 从 .env 读）
curl -H "Authorization: Bearer $CRON_SECRET" https://www.pre-daily.com/api/cron/seo
```

## 关键文件地图

| 文件 | 职责 |
|---|---|
| lib/pipeline.ts | 主刊端到端编排（含"绝不发假数据"硬规则 + recap 组装） |
| lib/gamma.ts | Polymarket 抓取/解析/策展/三层选刊（hero+heat+anchor，热度分） |
| lib/llm.ts | 逐市场分析 + 主编总结(narrative) + 复盘(recapDay) |
| lib/macro.ts | 宏观快照(10源) + 日历 + 上下文注入 |
| lib/seo-topics.ts / seo-llm.ts / seo-channels.ts / db/seo-queries.ts | SEO 循环四件套 |
| app/api/cron/{refresh,seo,watchdog,wc-push}/route.ts | 四个定时任务 |
| app/topic/* · app/preview/news/* | SEO 主题页 · 新闻版原型 |
| components/EditionView.tsx · NarrativeBlock · RecapBlock · Expandable | 论点线页面 |
| drizzle/0008 · 0009 | narrative/recap 列 · SEO 两表 |
| scripts/qa.ts | 发布前质量门禁（12+ 项） |

## 开发规约（重要）

- **AGENTS.md 规则**：这是 Next.js 16（有破坏性变化），写代码前先读 `node_modules/next/dist/docs/` 相关指南（route handler、params 是 `Promise`、route segment config 等）。
- **诚实性红线**：LLM 只允许基于传入数据写作；任何数据缺失必须明说/降级，绝不编造；发布失败保留上一刊 + Telegram 告警。
- **优雅降级**：所有外部依赖（数据源、推送、测量渠道）失败都不应阻塞主流程。
- 数据库列变更：新列一律可空/default（兼容旧行），渲染层按 null 回退。

# Prediction Daily · 预测市场中文早报

> 每天 8:00，用 3 分钟读懂全球真金白银在押注什么。

基于 **Polymarket 实时数据** 的预测市场中文信号解读：当前概率、24h 变动、流动性可信度，以及由 LLM 基于真实数据生成的中文解读。**不搬运新闻、不套话、不编造**——做不到的承诺一律不写。

这是 v2，对 v1（静态 mock 数据 + 逐字相同的模板"分析"）的彻底重写。

## 技术栈

- **Next.js 16** App Router（RSC + ISR），TypeScript
- **Tailwind v4**，深色 markets 终端视觉
- **Postgres** + **Drizzle ORM**（每日刊快照 + 归档）
- **Polymarket Gamma API**（实时市场，免费无鉴权）
- **DeepSeek**（逐市场中文解读，OpenAI 兼容；可换 Kimi/GLM/Claude）
- **Vercel Cron**（每天 08:00 CST 定时刷新）+ `next/og` 动态分享卡

## 数据管道

```
Gamma API ──► 解析(negRisk 聚合/归一化/过滤过期与已结算) ──► 分类策展(分类配额)
   ──► 逐市场真实 LLM 中文解读 ──► 跨市场"今日信号"摘要 ──► Postgres 幂等 upsert
   ──► revalidate 推送刷新 ──► SSR 页面
```

失败硬规则：抓取失败或市场数不足 **不发布**、保留上一刊、Telegram 告警，**绝不编造或发布假数据**。

## 本地开发

```bash
pnpm install
cp .env.example .env        # 填入 LLM_API_KEY / DATABASE_URL
pnpm drizzle-kit migrate    # 建表
pnpm tsx scripts/refresh.ts # 抓真实数据 + 生成今日刊（需 LLM key + DB）
pnpm dev                    # http://localhost:3000
```

## 关键文件

| 路径 | 职责 |
|---|---|
| `lib/gamma.ts` | Polymarket 抓取 + 解析 + 策展 |
| `lib/llm.ts` | DeepSeek 逐市场解读 + 每日摘要 + 成本记录 |
| `lib/pipeline.ts` | 端到端编排（含"绝不发假数据"策略） |
| `lib/db/` | Drizzle schema + 查询 |
| `app/api/cron/refresh/route.ts` | 每日定时刷新（CRON_SECRET 保护） |
| `app/daily/[date]/` | 每日刊永久 URL + 动态 OG 卡 |

## 环境变量

见 `.env.example`。核心：`DATABASE_URL`、`LLM_API_KEY`、`CRON_SECRET`、`NEXT_PUBLIC_SITE_URL`。

> 解读由 AI 基于 Polymarket 公开数据生成，不构成投资建议。本站与 Polymarket 无隶属关系。

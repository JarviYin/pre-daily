import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLatestIssue } from "@/lib/db/queries";
import {
  listAllSeoTopicSlugs,
  upsertSeoTopic,
  getSeoReport,
  upsertSeoReport,
} from "@/lib/db/seo-queries";
import {
  TOPIC_SEEDS,
  seedFor,
  mapMarketToTopic,
  fallbackCopy,
  type TopicMarketBrief,
} from "@/lib/seo-topics";
import { generateTopicCopyBatch } from "@/lib/seo-llm";
import { notifyIndexNow, baiduPush, fetchGscYesterday } from "@/lib/seo-channels";
import { todayShanghai } from "@/lib/date";
import type { SeoTopic } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ─────────────────────────────────────────────────────────────
// 每日 SEO 循环（vercel.json: 00:30 UTC = 北京 8:30，主刊 8:00 发布之后）。
//
// 循环 = 采集 → 建页 → 分发 → 测量 → 日报 → 反馈：
//  ① 采集   最新刊 markets 按关键词/分类映射到主题
//  ② 生成   LLM 批量刷新主题页 SEO 文案（失败 ⇒ 确定性回退，绝不留空）
//  ③ 建页   upsert seo_topics（marketSlugs 跨刊期累积 = 主题页的长期价值）
//  ④ 分发   IndexNow 通知 + Baidu 主动推送（env-gated，未配置优雅跳过）
//  ⑤ 测量   GSC 昨日曝光/点击/top 查询（未配置 ⇒ 降级无测量）
//  ⑥ 日报   Telegram 运营日报（对比昨日，列出候选新主题机会）
//  ⑦ 反馈   报告入库 seo_reports；下一轮读取昨日行做环比
// ─────────────────────────────────────────────────────────────

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** 前一天（Asia/Shanghai 日历日，无夏令时），格式 YYYY-MM-DD。 */
function prevShanghaiDate(date: string): string | null {
  const d = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function sendSeoReport(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // 运营日报发私有告警 chat（若配置）；不打扰公开频道的订阅者。
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) {
    console.log("[seo] report (no alert chat configured):\n" + text);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
    });
    return res.ok;
  } catch (err) {
    console.error("[seo] report push failed:", err);
    return false;
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = todayShanghai();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com").replace(/\/$/, "");
  try {
    // ① 采集：最新刊 → 主题映射。
    // 用「最新已发布刊」而非强制今日刊：主刊偶尔缺刊时，SEO 循环应跟随
    // 最新内容继续运行（lastUpdated 记录的是刊期，不是循环运行日）。
    const issue = await getLatestIssue();
    if (!issue) {
      return NextResponse.json(
        { skipped: true, reason: "no published edition at all" },
        { status: 200 }
      );
    }
    const byTopic = new Map<string, TopicMarketBrief[]>();
    for (const m of issue.markets) {
      const slug = mapMarketToTopic(m.title, m.category);
      if (!slug) continue;
      const list = byTopic.get(slug) ?? [];
      list.push({
        title: m.title,
        leadOption: m.outcomes[0]?.option ?? "—",
        leadProb: m.outcomes[0]?.probability ?? 0,
        move24h: m.move24h ?? m.leadingChange,
        date: issue.date,
      });
      byTopic.set(slug, list);
    }

    // ② 合并历史：marketSlugs 跨刊期累积（主题页的长期价值 = 历史聚合）。
    const existing = new Map((await listAllSeoTopicSlugs()).map((t) => [t.slug, t]));
    let newTopics = 0;
    const assembled: {
      seedSlug: string;
      briefs: TopicMarketBrief[];
      existingSlugs: string[];
      firstSeen: string;
    }[] = [];
    for (const [slug, briefs] of byTopic) {
      const prev = existing.get(slug);
      if (!prev) newTopics++;
      const prevSlugs = prev?.marketSlugs ?? [];
      // briefs 没有 slug——从 issue.markets 反查（title 匹配）。
      const slugsForBriefs = briefs
        .map((b) => issue.markets.find((m) => m.title === b.title)?.slug)
        .filter((s): s is string => Boolean(s));
      assembled.push({
        seedSlug: slug,
        briefs,
        existingSlugs: [...prevSlugs, ...slugsForBriefs].filter(
          (s, i, a) => a.indexOf(s) === i
        ),
        firstSeen: prev?.firstSeen ?? date,
      });
    }

    // ③ 生成：LLM 批量刷新（失败 ⇒ 全部确定性回退）。
    let copy = new Map<string, { metaTitle: string; metaDescription: string; h1: string; intro: string }>();
    try {
      copy = await generateTopicCopyBatch(
        assembled.map((a) => ({
          slug: a.seedSlug,
          zhTitle: seedFor(a.seedSlug)?.zhTitle ?? a.seedSlug,
          markets: a.briefs,
        }))
      );
    } catch (err) {
      console.warn("[seo] LLM refresh failed, falling back to deterministic copy:", err);
    }

    const now = new Date().toISOString();
    for (const a of assembled) {
      const seed = seedFor(a.seedSlug);
      if (!seed) continue;
      const c = copy.get(a.seedSlug) ?? fallbackCopy(seed, a.briefs, date);
      const topic: SeoTopic = {
        slug: a.seedSlug,
        zhTitle: seed.zhTitle,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        h1: c.h1,
        intro: c.intro,
        keywords: seed.keywords,
        marketSlugs: a.existingSlugs,
        firstSeen: a.firstSeen,
        lastUpdated: issue.date,
        generatedAt: now,
      };
      await upsertSeoTopic(topic);
      revalidatePath(`/topic/${a.seedSlug}`);
    }
    revalidatePath("/topic");

    // ④ 分发：所有主题页 URL 送 IndexNow + Baidu。
    const allTopics = await listAllSeoTopicSlugs();
    const urls = allTopics.map((t) => `${siteUrl}/topic/${t.slug}`);
    const indexNow = await notifyIndexNow(urls);
    const baidu = await baiduPush(urls);
    const urlsPinged = indexNow.ok ? urls : [];

    // ⑤ 测量：GSC 昨日数据（未配置 ⇒ null，循环降级为无测量）。
    const gsc = await fetchGscYesterday();

    // ⑥ 反馈：未覆盖的高曝光查询 = 候选新主题（loop 的自我改进输入）。
    const allKeywords = new Set(TOPIC_SEEDS.flatMap((s) => s.keywords));
    const opportunities =
      gsc?.topQueries
        .filter((q) => q.impressions >= 5)
        .filter((q) => {
          const tokens = q.query.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean);
          return !tokens.some((t) => allKeywords.has(t));
        })
        .map((q) => `${q.query}（曝光 ${q.impressions}）`)
        .slice(0, 5) ?? [];

    // ⑦ 日报：与昨日对比。
    const prevDate = prevShanghaiDate(date);
    const prev = prevDate ? await getSeoReport(prevDate) : null;
    const gscLine =
      gsc != null
        ? `${gsc.impressions} 曝光 / ${gsc.clicks} 点击`
        : "未配置（设置 GSC 服务账号后自动开启）";
    const deltaLine =
      prev && prev.impressions != null && gsc != null
        ? `（环比昨日 ${gsc.impressions >= prev.impressions ? "+" : ""}${gsc.impressions - prev.impressions} 曝光）`
        : "";
    const reportLines = [
      `🔍 SEO 日报 · ${date}`,
      `主题页：刷新 ${assembled.length} 个（新建 ${newTopics}）`,
      `索引通知：${urls.length} 个 URL — IndexNow ${indexNow.ok ? "✓" : `✗ ${indexNow.reason}`}；Baidu ${baidu.ok ? `✓ ${baidu.detail}` : `✗ ${baidu.reason}`}`,
      `搜索表现（GSC 昨日）：${gscLine}${deltaLine}`,
    ];
    if (gsc?.topQueries.length) {
      reportLines.push(
        "Top 查询：" +
          gsc.topQueries
            .map((q) => `${q.query}(${q.impressions}/${q.clicks})`)
            .join("、")
      );
    }
    if (opportunities.length) {
      reportLines.push("机会（未覆盖高曝光查询，候选新主题）：" + opportunities.join("；"));
    }
    reportLines.push("— 循环：每天 8:30 自动运行 · 测量→反馈→再采集");
    const reportText = reportLines.join("\n");
    const pushed = await sendSeoReport(reportText);

    // ⑧ 入库（下一轮读取）。
    await upsertSeoReport({
      date,
      topicsRefreshed: assembled.length,
      newTopics,
      urlsPinged,
      impressions: gsc?.impressions ?? null,
      clicks: gsc?.clicks ?? null,
      topQueries: gsc?.topQueries ?? null,
      opportunities,
      reportText,
      createdAt: now,
    });

    return NextResponse.json({
      ok: true,
      date,
      topicsRefreshed: assembled.length,
      newTopics,
      urls,
      indexNow,
      baidu,
      gsc: gsc ? { impressions: gsc.impressions, clicks: gsc.clicks } : null,
      opportunities,
      reportPushed: pushed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[seo] loop FAILED ${date}:`, err);
    return NextResponse.json({ ok: false, date, error: msg }, { status: 500 });
  }
}

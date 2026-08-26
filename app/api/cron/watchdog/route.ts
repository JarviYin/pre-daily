import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { generateIssue } from "@/lib/pipeline";
import { upsertIssue, getIssue, setIssueNews } from "@/lib/db/queries";
import { todayShanghai } from "@/lib/date";
import { sendNewsPush } from "@/lib/telegram";
import { sendAlert } from "@/lib/alert";
import { generateNewsBriefing } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─────────────────────────────────────────────────────────────
// 看门狗（vercel.json: 00:45 UTC = 北京 8:45，主刊 cron 之后 45 分钟）。
//
// 为什么需要：主刊 cron 偶尔不触发/失败时（如部署切换窗口），当天刊会缺失，
// 首页停留旧刊、SEO 循环也随之停摆。看门狗检查今日刊是否存在：
//   • 存在 ⇒ 无事发生（幂等，零成本）
//   • 缺失 ⇒ 立即补跑完整生成管线 + upsert + 推送 + 告警
// 与主 cron 同权限（CRON_SECRET），但内部复用同一管线，绝不绕过诚实性规则：
// 生成失败照样不发布、保留上一刊、发送告警。
// ─────────────────────────────────────────────────────────────

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = todayShanghai();
  try {
    const existing = await getIssue(date);
    if (existing) {
      return NextResponse.json({ ok: true, date, recovered: false, reason: "edition already published" });
    }

    console.log(`[watchdog] today's edition missing for ${date} — recovering...`);
    const issue = await generateIssue(date);
    await upsertIssue(issue);
    revalidatePath("/");
    revalidatePath(`/daily/${date}`);
    revalidatePath("/archive");

    // 补发推送：只推新闻版（与主 cron 一致，不再推信号版）。
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";
    let newsPushed = false;
    try {
      const news = await generateNewsBriefing(issue);
      await setIssueNews(issue.date, news);
      revalidatePath("/news");
      revalidatePath(`/news/${issue.date}`);
      const newsPush = await sendNewsPush(news, siteUrl);
      newsPushed = newsPush.sent;
    } catch (err) {
      console.error(`[watchdog] news briefing FAILED ${date} (edition unaffected):`, err);
    }

    await sendAlert(
      `[pre-daily] 看门狗补发今日刊 ${date}：${issue.markets.length} 个市场，` +
        `新闻版 ${newsPushed ? "已推送" : "未推送"}。主 cron 疑似未运行或失败。`
    );

    console.log(`[watchdog] recovered ${date}: ${issue.markets.length} markets, cost≈$${issue.costUsd.toFixed(4)}`);
    return NextResponse.json({
      ok: true,
      date,
      recovered: true,
      markets: issue.markets.length,
      costUsd: Number(issue.costUsd.toFixed(4)),
      newsPushed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[watchdog] recovery FAILED ${date}:`, err);
    await sendAlert(`[pre-daily] 看门狗补发失败 ${date}：${msg}（已保留上一刊）`);
    return NextResponse.json({ ok: false, date, recovered: false, error: msg }, { status: 500 });
  }
}

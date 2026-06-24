import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { generateIssue } from "@/lib/pipeline";
import { upsertIssue, upsertWcBriefing } from "@/lib/db/queries";
import { todayShanghai } from "@/lib/date";
import { sendAlert } from "@/lib/alert";
import { sendDailyPush } from "@/lib/telegram";
import { buildWcBriefing, wcActive } from "@/lib/wc-pipeline";
import type { WcBriefing } from "@/lib/wc-llm";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // LLM batch can take a while

// Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}` automatically.
// Bearer header ONLY — no query-string fallback (query params leak into access
// logs, referers, CDN caches). Manual ops triggering uses the same header:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/refresh
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
    console.log(`[cron] refresh start ${date}`);
    const issue = await generateIssue(date);
    await upsertIssue(issue); // idempotent upsert by date
    console.log(
      `[cron] published ${date}: ${issue.markets.length} markets, $${issue.costUsd.toFixed(4)}, model=${issue.modelId}`
    );

    // Push-refresh the affected routes immediately (ISR also covers staleness).
    revalidatePath("/");
    revalidatePath(`/daily/${date}`);
    revalidatePath("/archive");

    // World Cup special — best-effort companion; a failure here must NEVER
    // affect the main edition. Stops generating after the tournament (SUNSET).
    let wc: WcBriefing | null = null;
    if (wcActive(date)) {
      try {
        wc = await buildWcBriefing(date);
        await upsertWcBriefing(wc);
        revalidatePath("/worldcup");
        revalidatePath(`/worldcup/${date}`);
        console.log(`[cron] WC briefing ${date}: ${wc.angleKey} "${wc.headline}" $${wc.costUsd.toFixed(4)}`);
      } catch (err) {
        console.error(`[cron] WC briefing FAILED ${date} (main edition unaffected):`, err);
      }
    }

    // Best-effort daily broadcast (never blocks/fails the publish).
    // `?nopush=1` regenerates/publishes WITHOUT broadcasting — used for manual
    // mid-day re-runs so the public channel doesn't get a duplicate post. This
    // is a non-secret operational flag; auth still requires the Bearer header.
    const nopush = new URL(req.url).searchParams.get("nopush") === "1";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";
    let pushSent = false;
    if (nopush) {
      console.log("[cron] telegram push: skipped (nopush flag)");
    } else {
      const push = await sendDailyPush(
        issue,
        siteUrl,
        wc
          ? {
              headline: wc.headline,
              url: `${siteUrl}/worldcup`,
              finished: wc.schedule?.finished ?? [],
              upcoming: wc.schedule?.upcoming ?? [],
              focus: wc.focusMatch?.fixture ?? null,
            }
          : undefined
      );
      pushSent = push.sent;
      console.log(`[cron] telegram push: ${push.sent ? "sent" : `skipped (${push.reason})`}`);
    }

    return NextResponse.json({
      published: true,
      date,
      markets: issue.markets.length,
      model: issue.modelId,
      summaryModel: issue.summaryModelId,
      costUsd: Number(issue.costUsd.toFixed(4)),
      generatedAt: issue.generatedAt,
      pushed: pushSent,
      worldCup: wc ? { angle: wc.angleKey, headline: wc.headline } : null,
    });
  } catch (err) {
    // HARD RULE: never fabricate or publish a broken edition. We simply did
    // not upsert, so yesterday's edition stays live. Alert + surface failure.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] refresh FAILED ${date}:`, err);
    await sendAlert(`[pre-daily] 每日刷新失败 ${date}：${msg}（已保留上一刊，未发布假数据）`);
    return NextResponse.json({ published: false, date, error: msg }, { status: 500 });
  }
}

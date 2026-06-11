import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getWcBriefing, getLatestWcBriefing, upsertWcBriefing } from "@/lib/db/queries";
import { todayShanghai } from "@/lib/date";
import { refreshWcData, wcActive } from "@/lib/wc-pipeline";
import { sendWcMatchdayPush } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Evening World Cup cron (vercel.json: 12:00 UTC = 20:00 北京时间), the second
// of the two Hobby-plan cron slots. Two jobs, NO LLM call:
//   1. refresh the day's briefing DATA layers (schedule / 1X2 odds / groups)
//      so the site shows evening-fresh numbers, then revalidate;
//   2. broadcast tonight's matchday guide to the Telegram channel — skipped
//      automatically when no fixture is in the window (non-matchday) and
//      after the tournament SUNSET.
// Same auth as /api/cron/refresh; `?nopush=1` refreshes data without pushing.
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
  if (!wcActive(date)) {
    return NextResponse.json({ skipped: true, reason: "tournament over" });
  }

  try {
    const briefing = (await getWcBriefing(date)) ?? (await getLatestWcBriefing());
    if (!briefing) {
      return NextResponse.json({ skipped: true, reason: "no briefing yet" });
    }

    // Refresh data layers with evening odds (no LLM; narrative stays).
    const updated = await refreshWcData(briefing);
    await upsertWcBriefing(updated);
    revalidatePath("/");
    revalidatePath("/worldcup");
    revalidatePath(`/worldcup/${updated.date}`);
    const sched = updated.schedule!;
    console.log(
      `[wc-push] data refreshed ${updated.date}: ${sched.upcoming.length} upcoming, ${sched.live.length} live, ${sched.finished.length} finished`
    );

    const nopush = new URL(req.url).searchParams.get("nopush") === "1";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";
    let pushSent = false;
    let pushReason: string | undefined;
    if (nopush) {
      pushReason = "nopush flag";
    } else {
      const push = await sendWcMatchdayPush({
        date,
        schedule: sched,
        focus: updated.focusMatch,
        siteUrl,
      });
      pushSent = push.sent;
      pushReason = push.reason;
    }
    console.log(`[wc-push] telegram: ${pushSent ? "sent" : `skipped (${pushReason})`}`);

    return NextResponse.json({
      refreshed: true,
      date: updated.date,
      upcoming: sched.upcoming.length,
      live: sched.live.length,
      finished: sched.finished.length,
      pushed: pushSent,
      pushReason: pushSent ? undefined : pushReason,
    });
  } catch (err) {
    // Evening job is an enhancement — fail quietly (log, 500) without alert
    // spam; the morning edition is the canonical publish.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[wc-push] FAILED ${date}:`, err);
    return NextResponse.json({ refreshed: false, date, error: msg }, { status: 500 });
  }
}

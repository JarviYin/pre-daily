import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getWcBriefing, getLatestWcBriefing, upsertWcBriefing } from "@/lib/db/queries";
import { todayShanghai } from "@/lib/date";
import { refreshWcData, wcActive } from "@/lib/wc-pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Evening World Cup cron (vercel.json: 12:00 UTC = 20:00 北京时间). Data-only,
// NO Telegram push: World Cup is now folded into the single morning edition
// broadcast (/api/cron/refresh) — this job just refreshes the day's briefing
// DATA layers (schedule / 1X2 odds / groups) so the SITE shows evening-fresh
// numbers, then revalidates. No-ops after the tournament SUNSET.
// Same auth as /api/cron/refresh.
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

    return NextResponse.json({
      refreshed: true,
      date: updated.date,
      upcoming: sched.upcoming.length,
      live: sched.live.length,
      finished: sched.finished.length,
    });
  } catch (err) {
    // Evening job is an enhancement — fail quietly (log, 500) without alert
    // spam; the morning edition is the canonical publish.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[wc-push] FAILED ${date}:`, err);
    return NextResponse.json({ refreshed: false, date, error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getWcSchedule, getFocusProps } from "@/lib/wc-schedule";
import { getWinnerBoard } from "@/lib/worldcup";
import { getRemindedSlugs, markReminded } from "@/lib/db/queries";
import { todayShanghai } from "@/lib/date";
import { wcActive } from "@/lib/wc-pipeline";
import { generateWcReminderAnalyses, type WcReminderInput } from "@/lib/wc-llm";
import { sendWcReminderPush } from "@/lib/telegram";
import { sameTeam } from "@/lib/wc-names";
import { estimateCost } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Per-match pre-kickoff reminder, triggered EXTERNALLY every ~30 min (GitHub
// Actions — Vercel Hobby's two daily cron slots are already taken by the
// morning edition and the evening guide). Each call:
//   1. finds fixtures kicking off within the next 2.5h (lower bound 20 min so
//      a delayed trigger still reminds late rather than never);
//   2. drops the ones already reminded (wc_push_log — exactly-once even when
//      the trigger drifts or overlaps);
//   3. writes one short LLM read per match (single batched call; on LLM
//      failure the reminder still goes out with odds only);
//   4. sends ONE combined message per window (group-stage simultaneous
//      kickoffs would otherwise flood the channel), then marks the log.
// Auth: same CRON_SECRET Bearer. `?nopush=1` = dry-run (reports due fixtures,
// no LLM, no send, no log). No-ops after the tournament SUNSET.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const MIN_LEAD_MIN = 20;
const MAX_LEAD_MIN = 150;

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = todayShanghai();
  if (!wcActive(date)) {
    return NextResponse.json({ skipped: true, reason: "tournament over" });
  }

  try {
    const now = Date.now();
    const schedule = await getWcSchedule();
    const inWindow = schedule.upcoming.filter((f) => {
      if (!f.kickoff) return false;
      const mins = (Date.parse(f.kickoff) - now) / 60_000;
      return mins > MIN_LEAD_MIN && mins <= MAX_LEAD_MIN;
    });
    if (!inWindow.length) {
      return NextResponse.json({ due: 0, pushed: false, reason: "no fixture in window" });
    }

    const reminded = await getRemindedSlugs(inWindow.map((f) => f.slug));
    const due = inWindow.filter((f) => !reminded.has(f.slug));
    if (!due.length) {
      return NextResponse.json({ due: 0, pushed: false, reason: "already reminded" });
    }

    const nopush = new URL(req.url).searchParams.get("nopush") === "1";
    if (nopush) {
      return NextResponse.json({
        dryRun: true,
        due: due.length,
        fixtures: due.map((f) => ({ slug: f.slug, kickoff: f.kickoff })),
      });
    }

    // Enrich each due fixture: extra props + the two teams' championship odds.
    const board = await getWinnerBoard().catch(() => null);
    const champ = (name: string) =>
      board?.teams.find((t) => sameTeam(t.team, name))?.prob ?? null;
    const inputs: WcReminderInput[] = await Promise.all(
      due.map(async (fixture) => ({
        fixture,
        props: await getFocusProps(fixture.slug),
        champA: champ(fixture.teamA),
        champB: champ(fixture.teamB),
      }))
    );

    // Analyses are nice-to-have; the reminder must go out even if the LLM is
    // down, so failures degrade to odds-only items.
    let bySlug = new Map<string, string>();
    let costUsd = 0;
    try {
      const gen = await generateWcReminderAnalyses(inputs);
      bySlug = gen.bySlug;
      costUsd = estimateCost(gen.usage);
    } catch (err) {
      console.error("[wc-remind] LLM analyses failed (sending odds-only):", err);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";
    const push = await sendWcReminderPush({
      items: due.map((fixture) => ({ fixture, analysis: bySlug.get(fixture.slug) ?? null })),
      siteUrl,
    });
    if (push.sent) {
      await markReminded(due.map((f) => f.slug));
    }
    console.log(
      `[wc-remind] ${date}: due=${due.map((f) => f.slug).join(",")} pushed=${push.sent}${push.reason ? ` (${push.reason})` : ""} $${costUsd.toFixed(4)}`
    );

    return NextResponse.json({
      due: due.length,
      pushed: push.sent,
      reason: push.sent ? undefined : push.reason,
      costUsd: Number(costUsd.toFixed(4)),
      fixtures: due.map((f) => f.slug),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[wc-remind] FAILED ${date}:`, err);
    return NextResponse.json({ pushed: false, error: msg }, { status: 500 });
  }
}

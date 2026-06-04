import { eq, desc } from "drizzle-orm";
import { getDb } from "./index";
import { dailyIssues, issueItems, wcBriefings } from "./schema";
import type { DailyIssue, DailyMarket } from "../types";
import type { WcBriefing } from "../wc-llm";

/** Idempotent publish: upsert the edition + replace its items atomically. */
export async function upsertIssue(issue: DailyIssue): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .insert(dailyIssues)
      .values({
        date: issue.date,
        summary: issue.summary,
        modelId: issue.modelId,
        summaryModelId: issue.summaryModelId,
        generatedAt: new Date(issue.generatedAt),
        costUsd: issue.costUsd,
      })
      .onConflictDoUpdate({
        target: dailyIssues.date,
        set: {
          summary: issue.summary,
          modelId: issue.modelId,
          summaryModelId: issue.summaryModelId,
          generatedAt: new Date(issue.generatedAt),
          costUsd: issue.costUsd,
        },
      });

    // Replace items for this date (idempotent re-runs).
    await tx.delete(issueItems).where(eq(issueItems.issueDate, issue.date));
    if (issue.markets.length > 0) {
      await tx.insert(issueItems).values(
        issue.markets.map((m) => ({
          issueDate: issue.date,
          rank: m.rank,
          marketId: m.marketId,
          slug: m.slug,
          sourceUrl: m.sourceUrl,
          title: m.title,
          category: m.category,
          volume: m.volume,
          volume24hr: m.volume24hr,
          volume1wk: m.volume1wk,
          liquidity: m.liquidity,
          endDate: m.endDate,
          leadingChange: m.leadingChange,
          move24h: m.move24h,
          headlineOption: m.headlineOption,
          surge: m.surge,
          isNew: m.isNew,
          role: m.role,
          heatScore: m.heatScore,
          badges: m.badges,
          outcomes: m.outcomes,
          analysis: m.analysis,
        }))
      );
    }
  });
}

function rowsToIssue(
  head: typeof dailyIssues.$inferSelect,
  items: (typeof issueItems.$inferSelect)[]
): DailyIssue {
  const markets: DailyMarket[] = items
    .sort((a, b) => a.rank - b.rank)
    .map((it) => ({
      rank: it.rank,
      marketId: it.marketId,
      slug: it.slug,
      sourceUrl: it.sourceUrl,
      title: it.title,
      category: it.category,
      volume: it.volume,
      volume24hr: it.volume24hr,
      volume1wk: it.volume1wk,
      liquidity: it.liquidity,
      endDate: it.endDate,
      leadingChange: it.leadingChange,
      move24h: it.move24h,
      headlineOption: it.headlineOption,
      surge: it.surge,
      isNew: it.isNew,
      role: it.role,
      heatScore: it.heatScore,
      badges: it.badges ?? [],
      outcomes: it.outcomes,
      analysis: it.analysis ?? null,
    }));
  return {
    date: head.date,
    summary: head.summary,
    modelId: head.modelId,
    summaryModelId: head.summaryModelId,
    generatedAt: head.generatedAt.toISOString(),
    costUsd: head.costUsd,
    markets,
  };
}

export async function getIssue(date: string): Promise<DailyIssue | null> {
  const db = getDb();
  const head = await db
    .select()
    .from(dailyIssues)
    .where(eq(dailyIssues.date, date))
    .limit(1);
  if (head.length === 0) return null;
  const items = await db
    .select()
    .from(issueItems)
    .where(eq(issueItems.issueDate, date));
  return rowsToIssue(head[0], items);
}

export async function getLatestIssueDate(): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ date: dailyIssues.date })
    .from(dailyIssues)
    .orderBy(desc(dailyIssues.date))
    .limit(1);
  return rows[0]?.date ?? null;
}

export async function getLatestIssue(): Promise<DailyIssue | null> {
  const date = await getLatestIssueDate();
  return date ? getIssue(date) : null;
}

/** All published edition dates, newest first (for archive + sitemap + SSG). */
export async function listIssueDates(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ date: dailyIssues.date })
    .from(dailyIssues)
    .orderBy(desc(dailyIssues.date));
  return rows.map((r) => r.date);
}

/** Edition heads (date + summary) for the archive index, newest first. */
export async function listIssueHeads(): Promise<
  { date: string; summary: string }[]
> {
  const db = getDb();
  return db
    .select({ date: dailyIssues.date, summary: dailyIssues.summary })
    .from(dailyIssues)
    .orderBy(desc(dailyIssues.date));
}

// ── World Cup special ──────────────────────────────────────────────────────

function rowToWc(r: typeof wcBriefings.$inferSelect): WcBriefing {
  return {
    date: r.date,
    phase: r.phase,
    angleKey: r.angleKey,
    title: r.title,
    headline: r.headline,
    lede: r.lede,
    teamFocus: r.teamFocus,
    oddsSnapshot: r.oddsSnapshot,
    lookAhead: r.lookAhead,
    modelId: r.modelId,
    generatedAt: r.generatedAt.toISOString(),
    costUsd: r.costUsd,
  };
}

/** Idempotent upsert of one day's World Cup briefing. */
export async function upsertWcBriefing(b: WcBriefing): Promise<void> {
  const db = getDb();
  const values = {
    date: b.date,
    phase: b.phase,
    angleKey: b.angleKey,
    title: b.title,
    headline: b.headline,
    lede: b.lede,
    teamFocus: b.teamFocus,
    oddsSnapshot: b.oddsSnapshot,
    lookAhead: b.lookAhead,
    modelId: b.modelId,
    generatedAt: new Date(b.generatedAt),
    costUsd: b.costUsd,
  };
  await db
    .insert(wcBriefings)
    .values(values)
    .onConflictDoUpdate({ target: wcBriefings.date, set: values });
}

export async function getWcBriefing(date: string): Promise<WcBriefing | null> {
  const db = getDb();
  const rows = await db.select().from(wcBriefings).where(eq(wcBriefings.date, date)).limit(1);
  return rows[0] ? rowToWc(rows[0]) : null;
}

export async function getLatestWcBriefing(): Promise<WcBriefing | null> {
  const db = getDb();
  const rows = await db.select().from(wcBriefings).orderBy(desc(wcBriefings.date)).limit(1);
  return rows[0] ? rowToWc(rows[0]) : null;
}

/** Past briefing heads (date + title + headline) for the archive, newest first. */
export async function listWcBriefingHeads(): Promise<
  { date: string; title: string; headline: string }[]
> {
  const db = getDb();
  return db
    .select({ date: wcBriefings.date, title: wcBriefings.title, headline: wcBriefings.headline })
    .from(wcBriefings)
    .orderBy(desc(wcBriefings.date));
}

export async function listWcBriefingDates(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ date: wcBriefings.date })
    .from(wcBriefings)
    .orderBy(desc(wcBriefings.date));
  return rows.map((r) => r.date);
}

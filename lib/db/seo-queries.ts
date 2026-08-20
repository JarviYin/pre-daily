// SEO 循环的数据层：seo_topics / seo_reports 两表的读写 + 主题相关市场查询。
// 独立于 lib/db/queries.ts（日报主刊查询），互不干扰。
import { eq, desc, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { seoTopics, seoReports, issueItems } from "./schema";
import type { SeoTopic, SeoReport, Category } from "../types";

// ── 主题页 ──────────────────────────────────────────────────────

function rowToTopic(r: typeof seoTopics.$inferSelect): SeoTopic {
  return {
    slug: r.slug,
    zhTitle: r.zhTitle,
    metaTitle: r.metaTitle,
    metaDescription: r.metaDescription,
    h1: r.h1,
    intro: r.intro,
    keywords: r.keywords ?? [],
    marketSlugs: r.marketSlugs ?? [],
    firstSeen: r.firstSeen,
    lastUpdated: r.lastUpdated,
    generatedAt: r.generatedAt.toISOString(),
  };
}

/** Idempotent upsert of one SEO topic page. */
export async function upsertSeoTopic(t: SeoTopic): Promise<void> {
  const db = getDb();
  const values = {
    slug: t.slug,
    zhTitle: t.zhTitle,
    metaTitle: t.metaTitle,
    metaDescription: t.metaDescription,
    h1: t.h1,
    intro: t.intro,
    keywords: t.keywords,
    marketSlugs: t.marketSlugs,
    firstSeen: t.firstSeen,
    lastUpdated: t.lastUpdated,
    generatedAt: new Date(t.generatedAt),
  };
  await db
    .insert(seoTopics)
    .values(values)
    .onConflictDoUpdate({ target: seoTopics.slug, set: values });
}

export async function getSeoTopic(slug: string): Promise<SeoTopic | null> {
  const db = getDb();
  const rows = await db.select().from(seoTopics).where(eq(seoTopics.slug, slug)).limit(1);
  return rows[0] ? rowToTopic(rows[0]) : null;
}

export async function listAllSeoTopicSlugs(): Promise<SeoTopic[]> {
  const db = getDb();
  const rows = await db.select().from(seoTopics).orderBy(desc(seoTopics.firstSeen));
  return rows.map(rowToTopic);
}

/** 主题页需要的历史相关市场行：该主题累积 slug 中每个市场的最新一次入刊记录。 */
export type TopicMarketRow = {
  slug: string;
  title: string;
  issueDate: string; // 最新入刊刊期
  sourceUrl: string;
  category: Category;
  leadProb: number | null; // 最新刊中的领先概率
  move24h: number | null;
};

export async function getTopicMarketRows(slugs: string[]): Promise<TopicMarketRow[]> {
  if (slugs.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({
      slug: issueItems.slug,
      title: issueItems.title,
      issueDate: issueItems.issueDate,
      sourceUrl: issueItems.sourceUrl,
      category: issueItems.category,
      outcomes: issueItems.outcomes,
      move24h: issueItems.move24h,
    })
    .from(issueItems)
    .where(inArray(issueItems.slug, slugs));
  // One entry per slug: the LATEST issue where it appeared (dates are YYYY-MM-DD,
  // lexicographic order = chronological order).
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = latest.get(r.slug);
    if (!cur || r.issueDate > cur.issueDate) latest.set(r.slug, r);
  }
  const out: TopicMarketRow[] = [];
  for (const r of latest.values()) {
    const lead = (r.outcomes as { probability: number }[])[0];
    out.push({
      slug: r.slug,
      title: r.title,
      issueDate: r.issueDate,
      sourceUrl: r.sourceUrl,
      category: r.category,
      leadProb: lead?.probability ?? null,
      move24h: r.move24h,
    });
  }
  out.sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
  return out;
}

// ── 循环报告 ────────────────────────────────────────────────────

export async function upsertSeoReport(r: SeoReport): Promise<void> {
  const db = getDb();
  const values = {
    date: r.date,
    topicsRefreshed: r.topicsRefreshed,
    newTopics: r.newTopics,
    urlsPinged: r.urlsPinged,
    impressions: r.impressions,
    clicks: r.clicks,
    topQueries: r.topQueries,
    opportunities: r.opportunities,
    reportText: r.reportText,
    createdAt: new Date(r.createdAt),
  };
  await db
    .insert(seoReports)
    .values(values)
    .onConflictDoUpdate({ target: seoReports.date, set: values });
}

export async function getSeoReport(date: string): Promise<SeoReport | null> {
  const db = getDb();
  const rows = await db.select().from(seoReports).where(eq(seoReports.date, date)).limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    date: r.date,
    topicsRefreshed: r.topicsRefreshed,
    newTopics: r.newTopics,
    urlsPinged: r.urlsPinged ?? [],
    impressions: r.impressions,
    clicks: r.clicks,
    topQueries: r.topQueries ?? null,
    opportunities: r.opportunities ?? [],
    reportText: r.reportText,
    createdAt: r.createdAt.toISOString(),
  };
}

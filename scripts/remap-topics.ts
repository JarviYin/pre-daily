// One-off: rebuild seo_topics.marketSlugs from the full issue_items history
// using the CURRENT topic mapping (lib/seo-topics.ts). Fixes markets that
// were bucketed into the wrong topic page before mapping improvements
// (e.g. foreign elections landing on the US-elections page).
//
// Usage: pnpm tsx scripts/remap-topics.ts [--dry]
// Deterministic + idempotent: only rewrites marketSlugs / firstSeen /
// lastUpdated; existing LLM copy is preserved. New topics (first time
// getting members) get deterministic fallbackCopy — the daily SEO cron
// (8:30) refreshes all copy with LLM afterwards.
import { config } from "dotenv";
config();

import { getDb } from "../lib/db";
import { issueItems } from "../lib/db/schema";
import { TOPIC_SEEDS, mapMarketToTopic, fallbackCopy, type TopicMarketBrief } from "../lib/seo-topics";
import { upsertSeoTopic, listAllSeoTopicSlugs } from "../lib/db/seo-queries";

type Row = {
  slug: string;
  title: string;
  category: string;
  issueDate: string;
  outcomes: unknown;
  move24h: number | null;
};

async function main() {
  const dry = process.argv.includes("--dry");
  const db = getDb();

  const rows = (await db
    .select({
      slug: issueItems.slug,
      title: issueItems.title,
      category: issueItems.category,
      issueDate: issueItems.issueDate,
      outcomes: issueItems.outcomes,
      move24h: issueItems.move24h,
    })
    .from(issueItems)) as Row[];

  // topic -> slug -> { firstSeen, lastSeen, latest: Row }
  const byTopic = new Map<
    string,
    Map<string, { firstSeen: string; lastSeen: string; latest: Row }>
  >();
  let unmapped = 0;
  for (const r of rows) {
    const topic = mapMarketToTopic(r.title, r.category as never);
    if (!topic) {
      unmapped++;
      continue;
    }
    const m = byTopic.get(topic) ?? new Map();
    const cur = m.get(r.slug);
    if (!cur) {
      m.set(r.slug, { firstSeen: r.issueDate, lastSeen: r.issueDate, latest: r });
    } else {
      if (r.issueDate < cur.firstSeen) cur.firstSeen = r.issueDate;
      if (r.issueDate > cur.lastSeen) {
        cur.lastSeen = r.issueDate;
        cur.latest = r;
      }
    }
    byTopic.set(topic, m);
  }

  const existing = new Map((await listAllSeoTopicSlugs()).map((t) => [t.slug, t]));
  const today = new Date().toISOString().slice(0, 10);
  console.log(
    `History: ${rows.length} market rows, ${unmapped} unmapped, ` +
      `${byTopic.size} topics with members (existing topics: ${existing.size}).`
  );

  for (const seed of TOPIC_SEEDS) {
    const members = byTopic.get(seed.slug);
    const prev = existing.get(seed.slug);
    const marketSlugs = [...(members?.keys() ?? [])].sort();
    if (dry) {
      console.log(
        `[dry] ${seed.slug}: ${marketSlugs.length} markets (was ${prev?.marketSlugs.length ?? 0})`
      );
      continue;
    }
    // No members and no existing row → no empty pages.
    if (!prev && marketSlugs.length === 0) continue;

    const dates = [...(members?.values() ?? [])];
    const lastUpdated = dates.length
      ? dates.reduce((a, b) => (b.lastSeen > a ? b.lastSeen : a), dates[0].lastSeen)
      : (prev?.lastUpdated ?? today);
    const firstSeen = prev?.firstSeen ?? dates[0]?.firstSeen ?? today;

    // Preserve existing copy; brand-new topics get deterministic fallbackCopy
    // (never an empty page — LLM refresh happens on the next 8:30 cron).
    let copy = { metaTitle: "", metaDescription: "", h1: "", intro: "" };
    if (prev) {
      copy = {
        metaTitle: prev.metaTitle,
        metaDescription: prev.metaDescription,
        h1: prev.h1,
        intro: prev.intro,
      };
    } else {
      const briefs: TopicMarketBrief[] = dates
        .sort((a, b) => (a.latest.issueDate < b.latest.issueDate ? 1 : -1))
        .slice(0, 10)
        .map((d) => {
          const lead = (d.latest.outcomes as { option?: string; probability?: number }[])[0];
          return {
            title: d.latest.title,
            leadOption: lead?.option ?? "—",
            leadProb: lead?.probability ?? 0,
            move24h: d.latest.move24h ?? null,
            date: d.latest.issueDate,
          };
        });
      copy = fallbackCopy(seed, briefs, lastUpdated);
    }

    await upsertSeoTopic({
      slug: seed.slug,
      zhTitle: seed.zhTitle,
      metaTitle: copy.metaTitle,
      metaDescription: copy.metaDescription,
      h1: copy.h1,
      intro: copy.intro,
      keywords: seed.keywords,
      marketSlugs,
      firstSeen,
      lastUpdated,
      generatedAt: prev?.generatedAt ?? new Date().toISOString(),
    });
    console.log(
      `${seed.slug}: ${marketSlugs.length} markets (was ${prev?.marketSlugs.length ?? 0}), lastUpdated=${lastUpdated}, copy=${prev ? "kept" : "fallback"}`
    );
  }
  if (!dry) console.log("✓ remap done — copy refreshes on next SEO cron (8:30).");
  process.exit(0);
}

main().catch((err) => {
  console.error("remap-topics failed:", err);
  process.exit(1);
});

import {
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
  serial,
  index,
} from "drizzle-orm/pg-core";
import type {
  MarketAnalysis,
  Outcome,
  Category,
  EditionRole,
  Badge,
} from "../types";

// One published daily edition.
export const dailyIssues = pgTable("daily_issues", {
  date: text("date").primaryKey(), // YYYY-MM-DD (Asia/Shanghai)
  summary: text("summary").notNull(),
  modelId: text("model_id").notNull(), // model used for per-market analysis
  summaryModelId: text("summary_model_id").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  costUsd: doublePrecision("cost_usd").notNull().default(0),
});

// One ranked market within an edition.
export const issueItems = pgTable(
  "issue_items",
  {
    id: serial("id").primaryKey(),
    issueDate: text("issue_date")
      .notNull()
      .references(() => dailyIssues.date, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    marketId: text("market_id").notNull(),
    slug: text("slug").notNull(),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    category: text("category").$type<Category>().notNull(),
    volume: doublePrecision("volume").notNull().default(0),
    volume24hr: doublePrecision("volume_24hr").notNull().default(0),
    volume1wk: doublePrecision("volume_1wk").notNull().default(0),
    liquidity: doublePrecision("liquidity").notNull().default(0),
    endDate: text("end_date"),
    leadingChange: doublePrecision("leading_change"),
    // v2.1 heat/edition fields (nullable/defaulted ⇒ safe for pre-existing rows).
    move24h: doublePrecision("move_24h"),
    headlineOption: text("headline_option"),
    surge: doublePrecision("surge").notNull().default(1),
    isNew: boolean("is_new").notNull().default(false),
    role: text("role").$type<EditionRole>().notNull().default("heat"),
    heatScore: doublePrecision("heat_score").notNull().default(0),
    badges: jsonb("badges").$type<Badge[]>().notNull().default([]),
    outcomes: jsonb("outcomes").$type<Outcome[]>().notNull(),
    analysis: jsonb("analysis").$type<MarketAnalysis | null>(),
  },
  (t) => [index("issue_items_date_rank_idx").on(t.issueDate, t.rank)]
);

export type DailyIssueRow = typeof dailyIssues.$inferSelect;
export type IssueItemRow = typeof issueItems.$inferSelect;

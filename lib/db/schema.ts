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
  DailyBriefing,
} from "../types";
import type { WcTeam } from "../worldcup";
import type { WcTeamFocus, WcFocusMatchBrief } from "../wc-llm";
import type { WcScheduleSnapshot, WcGroupStanding } from "../wc-schedule";

// One published daily edition.
export const dailyIssues = pgTable("daily_issues", {
  date: text("date").primaryKey(), // YYYY-MM-DD (Asia/Shanghai)
  summary: text("summary").notNull(),
  // Investment read (资金信号 + 资产联动); nullable ⇒ pre-existing rows fine.
  briefing: jsonb("briefing").$type<DailyBriefing | null>(),
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

// One daily World Cup special briefing (the "expand daily" dossier entry).
export const wcBriefings = pgTable("wc_briefings", {
  date: text("date").primaryKey(), // YYYY-MM-DD (Asia/Shanghai)
  phase: text("phase").notNull(), // pre | group | knockout | final | after
  angleKey: text("angle_key").notNull(),
  title: text("title").notNull(), // the day's angle headline seed
  headline: text("headline").notNull(), // LLM punchy hook
  lede: text("lede").notNull(), // deep narrative
  teamFocus: jsonb("team_focus").$type<WcTeamFocus[]>().notNull(),
  oddsSnapshot: jsonb("odds_snapshot").$type<WcTeam[]>().notNull(), // top teams for display
  // Match layer (added for the matchday upgrade; nullable ⇒ old rows fine).
  schedule: jsonb("schedule").$type<WcScheduleSnapshot | null>(),
  groupStandings: jsonb("group_standings").$type<WcGroupStanding[] | null>(),
  focusMatch: jsonb("focus_match").$type<WcFocusMatchBrief | null>(),
  lookAhead: text("look_ahead").notNull(),
  modelId: text("model_id").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  costUsd: doublePrecision("cost_usd").notNull().default(0),
});

export type DailyIssueRow = typeof dailyIssues.$inferSelect;
export type IssueItemRow = typeof issueItems.$inferSelect;
export type WcBriefingRow = typeof wcBriefings.$inferSelect;

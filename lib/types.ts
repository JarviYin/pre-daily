// Domain model for Prediction Daily. All probabilities are 0..1.

export const CATEGORIES = [
  "macro",
  "crypto",
  "sports",
  "geopolitics",
  "politics",
  "tech",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Outcome = {
  option: string; // e.g. "25 bps decrease" or a candidate name
  probability: number; // 0..1
};

// What the LLM returns per market — grounded, honest, no fabricated facts.
export type MarketAnalysis = {
  insight: string; // 一句解读：市场此刻在 price-in 什么
  signal: string; // 信号含义：对什么资产/事件偏多/偏空
  trade?: string; // 交易视角：当前定价偏贵/偏便宜/合理，顺势/逆向/观望 + 风险回报（新增，历史行可能缺）
  risk: string; // 可信度 / 风险提示（流动性、解析标准、临近截止等）
};

// Why a market earned its slot in TODAY's edition. Drives the visual badges
// and explains the "what changed today" framing instead of raw volume rank.
export const BADGES = ["异动", "放量", "新晋", "临近揭晓", "持续高热"] as const;
export type Badge = (typeof BADGES)[number];

// An edition is composed in three layers, not a flat volume list:
//  • hero   — the single biggest 24h probability swing (the day's headline)
//  • heat   — markets ranked by a composite "today's heat" score
//  • anchor — 1-2 evergreen high-volume markets kept for context
export type EditionRole = "hero" | "heat" | "anchor";

// One ranked market within a daily edition (maps to issue_items row).
export type DailyMarket = {
  rank: number;
  marketId: string; // Gamma event id
  slug: string;
  sourceUrl: string; // https://polymarket.com/event/{slug}
  title: string;
  category: Category;
  volume: number; // total USD volume
  volume24hr: number; // USD volume in last 24h
  volume1wk: number; // USD volume in last 7d (surge baseline)
  liquidity: number; // USD liquidity (credibility signal)
  endDate: string | null; // ISO; resolution deadline
  // 24h change of the LEADING outcome's probability, in absolute points (e.g. +0.04).
  leadingChange: number | null;
  // The HEADLINE 24h move: the outcome that moved most, signed (e.g. +0.18).
  // This is what ranks "today's movers"; leadingChange tracks only the top line.
  move24h: number | null;
  headlineOption: string | null; // which outcome moved most (for the hero card)
  // 24h volume relative to the market's own 7d daily average (≥1 = accelerating).
  surge: number;
  isNew: boolean; // created within the last few days OR Gamma's `new` flag
  role: EditionRole;
  heatScore: number; // composite ranking score (higher = hotter today)
  badges: Badge[]; // why it's on today's board (derived, persisted for fidelity)
  outcomes: Outcome[]; // full distribution, sorted desc, sums to ~1
  analysis: MarketAnalysis | null;
};

// Cross-market investment read that expands the daily edition beyond the
// movers line. Optional/nullable ⇒ pre-existing editions render without it.
export type DailyBriefing = {
  moneyFlow: string; // 资金信号：高确信异动 vs 薄量噪声 vs 分歧/背离
  assetLink: string; // 资产联动：今日预测市场动向 → 对外部资产(利率/美元/加密/股指/大宗)的含义
};

// One published daily edition (maps to daily_issues row + its items).
export type DailyIssue = {
  date: string; // YYYY-MM-DD (publication date, Asia/Shanghai)
  summary: string; // 今日异动主线（真实跨市场综合）
  briefing: DailyBriefing | null; // 投资视角扩展（资金信号 + 资产联动），可空
  modelId: string; // model actually used for per-market analysis
  summaryModelId: string; // model used for the cross-market summary
  generatedAt: string; // ISO timestamp of successful generation
  costUsd: number; // total LLM cost for this edition
  markets: DailyMarket[];
};

// One time-sensitive resolution surfaced by the catalyst calendar. Derived
// deterministically from an edition's markets — never persisted, never LLM.
export type CatalystEntry = {
  title: string;
  category: Category;
  sourceUrl: string;
  endDate: string; // ISO; resolution deadline
  daysLeft: number; // whole days from today (Asia/Shanghai) to resolution
  leadOption: string; // current leading outcome
  leadProb: number; // its probability (0..1)
  move24h: number | null; // headline 24h move, for "动向" context
};

export type LiquidityTier = "high" | "medium" | "low";

export function liquidityTier(liquidity: number): LiquidityTier {
  if (liquidity >= 5_000_000) return "high";
  if (liquidity >= 500_000) return "medium";
  return "low";
}

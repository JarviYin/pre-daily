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
  risk: string; // 可信度 / 风险提示（流动性、解析标准、临近截止等）
};

// One ranked market within a daily edition (maps to issue_items row).
export type DailyMarket = {
  rank: number;
  marketId: string; // Gamma event id
  slug: string;
  sourceUrl: string; // https://polymarket.com/event/{slug}
  title: string;
  category: Category;
  volume: number; // total USD volume
  volume24hr: number; // USD volume in last 24h (ranking signal)
  liquidity: number; // USD liquidity (credibility signal)
  endDate: string | null; // ISO; resolution deadline
  // 24h change of the LEADING outcome's probability, in absolute points (e.g. +0.04).
  leadingChange: number | null;
  outcomes: Outcome[]; // full distribution, sorted desc, sums to ~1
  analysis: MarketAnalysis | null;
};

// One published daily edition (maps to daily_issues row + its items).
export type DailyIssue = {
  date: string; // YYYY-MM-DD (publication date, Asia/Shanghai)
  summary: string; // 今日 3 个最值得注意的信号（真实跨市场综合）
  modelId: string; // model actually used for per-market analysis
  summaryModelId: string; // model used for the cross-market summary
  generatedAt: string; // ISO timestamp of successful generation
  costUsd: number; // total LLM cost for this edition
  markets: DailyMarket[];
};

export type LiquidityTier = "high" | "medium" | "low";

export function liquidityTier(liquidity: number): LiquidityTier {
  if (liquidity >= 5_000_000) return "high";
  if (liquidity >= 500_000) return "medium";
  return "low";
}

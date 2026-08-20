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
  // 24h delta of THIS outcome in the same normalized space as `probability`.
  // Optional/nullable ⇒ pre-existing rows (and the folded "其他" line) lack it.
  change?: number | null;
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

// ── 宏观视角 (macro depth section) ──────────────────────────────────────────
// `chips` and `calendar` are DETERMINISTIC (fetched from official/public data
// sources, pre-formatted for display); the three text fields are LLM-written
// and each degrades to "" independently. The whole section is nullable so a
// data outage can never block publishing.

// One pre-formatted external-market indicator, e.g. {美债10Y, 4.48%}.
export type MacroChip = {
  label: string; // e.g. "美债10Y" / "BTC" / "VIX"
  value: string; // pre-formatted, e.g. "4.48%" / "$60,050"
  delta?: string; // pre-formatted change, e.g. "+2.3%" / "+31bp"
  tone?: "up" | "down" | "flat"; // colours the delta
};

// One upcoming macro event (next ~7 days), with market expectations when known.
export type MacroCalendarItem = {
  date: string; // ISO datetime (ForexFactory, has time) or YYYY-MM-DD (Fed)
  label: string; // zh label, e.g. "非农新增就业"; falls back to source title
  impact: "high" | "medium";
  forecast?: string; // market expectation, e.g. "114K"
  previous?: string; // prior print, e.g. "172K"
  source: "forexfactory" | "fed";
};

export type DailyMacro = {
  chips: MacroChip[]; // external market snapshot (deterministic)
  calendar: MacroCalendarItem[]; // week-ahead macro calendar (deterministic)
  view: string; // 宏观定价：宏观类市场赔率 × 真实行情的交叉解读
  divergence: string; // 分歧信号：预测市场 vs 传统市场/共识的最大反差
  watch: string; // 一周前瞻：日历上的催化与「若…则…」观察点
};

// ── 论点线（narrative）────────────────────────────────────────────
// 一刊从"10 个独立分析"升级为"一个论点 + 论据 + 反方 + 明日观察"。
// 全部为 LLM 生成；thesis 为核心（空 ⇒ 整段为 null，渲染回退 summary 卡）；
// 其余字段可独立降级为空/空数组，渲染层隐藏对应块。
export type DailyPillar = {
  claim: string; // 论据主张（一句话）
  evidence: string; // 支撑证据：必须引用具体市场 + 数字（QA 校验含数字）
  soWhat: string; // 所以呢：对读者的含义
};

export type DailyNarrative = {
  thesis: string; // 今日论点（一句话，可作整刊标题）
  pillars: DailyPillar[]; // 2-4 个论据块
  counterView: string; // 反方/分歧：什么信号会推翻今日判断
  watch: string; // 明日观察：看什么数据/事件/赔率验证或证伪
};

// ── 昨日判断复盘（recap）──────────────────────────────────────────
// 昨天说 X，今天市场给了什么答案。best-effort：无昨日刊或复盘失败 ⇒ null。
export type RecapVerdict = "hit" | "miss" | "pending"; // 兑现 / 证伪 / 未定

export type DailyRecap = {
  prevDate: string; // 被复盘的昨日刊日期
  verdict: RecapVerdict;
  summary: string; // 一句结论
  detail: string; // 依据（点名市场与数字）
};

// One published daily edition (maps to daily_issues row + its items).
export type DailyIssue = {
  date: string; // YYYY-MM-DD (publication date, Asia/Shanghai)
  summary: string; // 今日异动主线（真实跨市场综合）
  briefing: DailyBriefing | null; // 投资视角扩展（资金信号 + 资产联动），可空
  macro: DailyMacro | null; // 宏观视角（外部行情+日历+LLM解读），可空
  narrative: DailyNarrative | null; // 论点线（thesis+论据+反方+明日观察），可空 ⇒ 回退 summary 卡
  recap: DailyRecap | null; // 昨日判断复盘，可空
  modelId: string; // model actually used for per-market analysis
  summaryModelId: string; // model used for the cross-market summary
  generatedAt: string; // ISO timestamp of successful generation
  costUsd: number; // total LLM cost for this edition
  markets: DailyMarket[];
};

// ── SEO 循环（每日自动）───────────────────────────────────────────
// 主题页 = 面向搜索长尾词的聚合落地页（如「美联储降息概率预测」）。
// 每日循环：最新刊市场 → 映射主题 → LLM 刷新文案 → 聚合历史相关市场 →
// 索引通知 → 测量 → 日报 → 反馈下一轮。

export type SeoTopic = {
  slug: string; // 固定主题键，如 "federal-reserve"
  zhTitle: string; // 主题中文名，如「美联储利率路径预测」
  metaTitle: string; // <title>（每日刷新，含今日数据）
  metaDescription: string; // meta description
  h1: string; // 页面 H1
  intro: string; // 导语（含今日最新概率与历史追踪量）
  keywords: string[]; // 匹配关键词（小写 token）
  marketSlugs: string[]; // 历史累积的相关市场 slug（去重）
  firstSeen: string; // YYYY-MM-DD 首次生成
  lastUpdated: string; // YYYY-MM-DD 最后刷新刊期
  generatedAt: string; // ISO 最后生成时间
};

export type SeoQueryStat = { query: string; impressions: number; clicks: number };

// 每日 SEO 循环报告（测量 + 反馈），date 为主键。
export type SeoReport = {
  date: string; // YYYY-MM-DD (Asia/Shanghai)
  topicsRefreshed: number; // 今日刷新主题数
  newTopics: number; // 今日新建档主题数
  urlsPinged: string[]; // 今日索引通知的 URL
  impressions: number | null; // GSC 昨日曝光（未配置 ⇒ null）
  clicks: number | null; // GSC 昨日点击
  topQueries: SeoQueryStat[] | null; // GSC 昨日 top 查询
  opportunities: string[]; // 未覆盖高曝光查询（loop 反馈：候选新主题）
  reportText: string; // Telegram 日报全文
  createdAt: string; // ISO
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

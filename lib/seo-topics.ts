// SEO 循环的核心内容模型：主题种子表 + 市场→主题映射 + 确定性回退文案。
//
// 主题页为什么有价值：站内日更内容按「日期」组织，但搜索流量按「主题/实体」
// 组织（如「美联储降息概率」「OpenAI IPO 概率」）。主题页把分散在 73+ 刊期里
// 的同一主题市场聚合成一张持续更新的落地页，精准承接长尾词。
//
// 映射是确定性的（关键词 token 匹配 + 分类兜底），文案由 LLM 每日刷新，
// LLM 失败时用 fallbackCopy 生成（含真实数字，绝不留空页）。

import type { Category } from "./types";
import { formatPct, formatMove } from "./format";

export type TopicSeed = {
  slug: string; // 固定 URL 键（SEO 稳定，永不改）
  zhTitle: string; // 主题中文名（搜索词）
  keywords: string[]; // 小写 token，命中即归入本主题
  categoryFallback: Category | null; // 无关键词命中时按分类兜底；null = 不兜底
};

// 顺序即优先级：更具体/更热的主题在前（如 IPO 在 AI 之前，避免「OpenAI IPO」
// 被 AI 时间线抢先）。宽泛主题（macro-economy）殿后。
export const TOPIC_SEEDS: TopicSeed[] = [
  {
    slug: "federal-reserve",
    zhTitle: "美联储利率路径预测",
    keywords: [
      "fed", "fomc", "rate", "rates", "interest", "inflation", "cpi",
      "powell", "treasury", "tariff", "tariffs",
    ],
    categoryFallback: "macro",
  },
  {
    slug: "bank-of-japan",
    zhTitle: "日本央行加息预测",
    keywords: ["boj", "japan", "japanese"],
    categoryFallback: "macro",
  },
  {
    slug: "tech-ipo",
    zhTitle: "科技公司IPO预测",
    keywords: ["ipo", "spacex", "databricks", "listing", "list"],
    categoryFallback: "tech",
  },
  {
    slug: "ai-timeline",
    zhTitle: "AI大事预测时间线",
    keywords: [
      "ai", "openai", "anthropic", "agi", "gpt", "claude", "chatgpt",
      "llm", "nvidia", "deepseek", "gemini", "grok", "chatbot", "model",
      "models", "robot", "robotics", "artificial",
    ],
    // 2026-08 起市场走独立 `ai` 类目（旧刊仍存 tech，由关键词命中兜住）。
    categoryFallback: "ai",
  },
  {
    // 排在 us-elections 之前：外国选举（俄/法/以等）先命中国别词再落"election"
    // 这类宽泛词，避免「Russian Parliamentary Election」被美国选举页抢走。
    slug: "geopolitics",
    zhTitle: "地缘政治预测",
    keywords: [
      "war", "ceasefire", "ukraine", "russia", "russian", "israel",
      "israeli", "gaza", "iran", "iranian", "taiwan", "venezuela",
      "military", "nuclear", "nato", "invasion", "troops", "peace",
      "hostages", "talks", "french", "france", "german", "germany",
      "korea", "china", "chinese", "beijing", "kremlin", "parliament",
      "parliamentary", "hormuz", "strait", "rial", "rials", "sanction",
      "sanctions", "houthi", "yemen", "oil", "crude", "opec",
    ],
    categoryFallback: "geopolitics",
  },
  {
    slug: "us-elections",
    zhTitle: "美国选举与政治预测",
    keywords: [
      "election", "elections", "president", "presidential", "senate",
      "congress", "governor", "mayor", "nominee", "primary", "vote",
      "trump", "democrat", "democratic", "republican", "gop", "poll",
      "impeachment",
    ],
    categoryFallback: "politics",
  },
  {
    slug: "crypto",
    zhTitle: "加密市场预测",
    keywords: [
      "crypto", "bitcoin", "btc", "ethereum", "eth", "solana", "sol",
      "memecoin", "stablecoin", "defi", "blockchain", "etf",
    ],
    categoryFallback: "crypto",
  },
  {
    slug: "macro-economy",
    zhTitle: "宏观经济数据预测",
    keywords: [
      "gdp", "jobs", "unemployment", "retail", "payroll", "ism", "pmi",
      "recession", "economy", "economic", "non-farm", "nonfarm",
    ],
    categoryFallback: "macro",
  },
];

const SEED_BY_SLUG = new Map(TOPIC_SEEDS.map((s) => [s.slug, s]));

export function seedFor(slug: string): TopicSeed | undefined {
  return SEED_BY_SLUG.get(slug);
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * 市场 → 主题 slug（确定性）。优先关键词命中（按种子表顺序），
 * 其次分类兜底。返回 null 表示该市场不适合建主题页（如 sports/other）。
 */
export function mapMarketToTopic(
  title: string,
  category: Category
): string | null {
  const tokens = new Set(tokenize(title));
  for (const seed of TOPIC_SEEDS) {
    if (seed.keywords.some((k) => tokens.has(k))) return seed.slug;
  }
  // 无关键词命中 → 按分类兜底（最后兜底到宽泛主题或 null）。
  switch (category) {
    case "macro":
      return "macro-economy";
    case "politics":
      return "us-elections";
    case "geopolitics":
      return "geopolitics";
    case "crypto":
      return "crypto";
    case "tech":
      return "ai-timeline";
    default:
      return null; // sports / other 不建主题页
  }
}

/** 主题页相关市场的简述（用于 LLM 输入与回退文案）。 */
export type TopicMarketBrief = {
  title: string;
  leadOption: string;
  leadProb: number; // 0..1
  move24h: number | null;
  date: string; // 刊期 YYYY-MM-DD
};

export type TopicCopy = {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
};

/**
 * 确定性回退文案：LLM 失败时的保底。全部用真实数据拼装——SEO 页面可以朴素，
 * 但绝不能为空或编造。
 */
export function fallbackCopy(
  seed: TopicSeed,
  markets: TopicMarketBrief[],
  date: string
): TopicCopy {
  const latest = markets[0];
  const latestLine = latest
    ? `最新（${latest.date}）：「${latest.title}」领先项 ${latest.leadOption} ${formatPct(latest.leadProb)}${latest.move24h != null ? `（24h ${formatMove(latest.move24h).text}）` : ""}。`
    : "";
  return {
    metaTitle: `${seed.zhTitle}｜预测市场概率实时跟踪 - Prediction Daily`,
    metaDescription: `Prediction Daily 每日追踪${seed.zhTitle}相关的 Polymarket 预测市场：最新概率、24小时变动与历史记录，每日 8:00 更新。`,
    h1: `${seed.zhTitle}（预测市场概率跟踪）`,
    intro:
      `${latestLine}本页汇总 Prediction Daily 历史刊期追踪过的${seed.zhTitle}相关预测市场，` +
      `按最新刊期排序，全部概率来自 Polymarket 公开市场数据，截至 ${date} 每日更新。`,
  };
}

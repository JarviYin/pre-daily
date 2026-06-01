import type { Category } from "./types";

// Display metadata for each category (zh label + signal accent usage).
export const CATEGORY_META: Record<
  Category,
  { label: string; en: string }
> = {
  macro: { label: "宏观", en: "Macro" },
  crypto: { label: "加密", en: "Crypto" },
  sports: { label: "体育", en: "Sports" },
  geopolitics: { label: "地缘", en: "Geopolitics" },
  politics: { label: "政治", en: "Politics" },
  tech: { label: "科技", en: "Tech" },
  other: { label: "其他", en: "Other" },
};

// Keyword → category. Keywords are matched as WHOLE TOKENS (not substrings)
// against tokens from the Gamma tag slugs/labels AND the title. This avoids
// false hits like "ai" inside "current-affairs". Priority order: first
// category with any matching token wins, so more specific topics come first.
const RULES: { category: Category; keywords: string[] }[] = [
  {
    category: "crypto",
    keywords: [
      "crypto", "bitcoin", "btc", "ethereum", "eth", "solana", "sol",
      "memecoin", "stablecoin", "defi", "microstrategy", "coinbase",
      "blockchain", "etf",
    ],
  },
  {
    category: "macro",
    keywords: [
      "fed", "fomc", "rate", "rates", "interest", "inflation", "cpi",
      "recession", "gdp", "economy", "economic", "jobs", "treasury",
      "powell", "tariff", "tariffs",
    ],
  },
  {
    category: "geopolitics",
    keywords: [
      "war", "ceasefire", "ukraine", "russia", "israel", "gaza", "iran",
      "taiwan", "venezuela", "maduro", "military", "nuclear", "nato",
      "invasion", "troops", "peace", "hostages",
    ],
  },
  {
    category: "tech",
    keywords: [
      "ai", "openai", "nvidia", "apple", "tesla", "google", "microsoft",
      "tech", "chatgpt", "gpt", "llm", "anthropic", "spacex",
    ],
  },
  {
    category: "sports",
    keywords: [
      "sports", "soccer", "football", "nfl", "nba", "f1", "formula",
      "cup", "league", "ufc", "tennis", "cricket", "mlb", "nhl", "premier",
      "champions", "garros", "atp", "wta", "golf", "boxing", "olympics",
      "playoffs", "champion",
    ],
  },
  {
    category: "politics",
    keywords: [
      "election", "elections", "president", "presidential", "senate",
      "congress", "governor", "mayor", "nominee", "primary", "parliament",
      "vote", "politics", "trump", "democrat", "democratic", "republican",
      "gop", "poll", "shutdown", "impeachment",
    ],
  },
];

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Derive a category from Gamma event tags + title using whole-token matching.
 * `tags` are the raw tag slugs/labels; `title` is the event title.
 */
export function deriveCategory(tags: string[], title: string): Category {
  const tokens = new Set([...tags, title].flatMap(tokenize));
  for (const rule of RULES) {
    if (rule.keywords.some((k) => tokens.has(k))) return rule.category;
  }
  return "other";
}

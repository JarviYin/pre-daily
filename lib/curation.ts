// ─────────────────────────────────────────────────────────────
// Curation: keep WORLD-EVENT markets, drop MECHANICAL CHURN.
//
// Why this exists: ranking by volume (or even by raw 24h price move) is
// dominated by markets whose "movement" is the EVENT happening, not the
// WORLD changing its mind:
//  • sports / esports games — a match mechanically swings 50→85% as it is
//    played; that is a score, not news.
//  • recurring price ladders — "Bitcoin above X on June 2", "Crude hit Y by
//    EOD" auto-resolve daily; they churn volume without carrying a narrative.
//  • vanity-count markets — "Elon # tweets this week", "MrBeast video views".
//
// A daily SIGNAL digest wants markets where the implied probability of a real
// world question (politics, geopolitics, macro, crypto narratives, tech/AI,
// culture) shifted. So we exclude the churn by Gamma tags, with a light
// title-pattern backstop, and LOG every exclusion (auditable, never silent).
// ─────────────────────────────────────────────────────────────

// Tag tokens that mark a sports / esports market. Whole-token matched against
// tokenized tag slugs+labels, so "games" won't hit "video games" prose etc.
// Includes season-long futures (World Cup Winner, NBA Champion) — per product
// decision "world events only", those are out too.
const SPORTS_TAGS = new Set([
  "sports", "esports", "games", "game",
  "mlb", "nba", "nfl", "nhl", "ncaa", "wnba",
  "soccer", "football", "basketball", "baseball", "hockey",
  "tennis", "atp", "wta", "golf", "pga", "ufc", "mma", "boxing",
  "cricket", "rugby", "f1", "formula", "nascar", "motogp",
  "cup", "league", "champions", "playoffs", "champion", "finals",
  "premier", "laliga", "bundesliga", "serie", "epl",
  "garros", "wimbledon", "olympics", "olympic",
  // esports
  "lol", "dota", "valorant", "csgo", "cs2", "iem", "esl",
]);

// Multiword tags / phrases that reliably mark mechanical churn. Matched as
// case-insensitive substrings against the full tag string.
const CHURN_PHRASES = [
  "recurring",
  "crypto prices",
  "hit price",
  "tweet markets",
  "counter strike",
  "league of legends",
  "multi strikes",
];

// Tags that are purely operational/decoration on Polymarket and carry no topic
// signal — ignored so they never accidentally classify a market.
const NOISE_TAGS = new Set([
  "hide from new", "earn 4%", "rewards", "main election", "macro election 2",
]);

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export type CurationVerdict = { keep: boolean; reason: string };

/**
 * Decide whether an event is a world-event market worth a daily slot.
 * `tags` are raw tag slugs/labels; `title` is the event title.
 */
export function curate(tags: string[], title: string): CurationVerdict {
  const tagStr = tags.join(" ").toLowerCase();
  const tagTokens = new Set(tags.flatMap(tokenize));

  // 1) Sports / esports by whole-token tag match.
  for (const t of tagTokens) {
    if (SPORTS_TAGS.has(t)) return { keep: false, reason: `sports/esports tag:${t}` };
  }

  // 2) Recurring price-ladder / vanity-count by phrase match.
  for (const p of CHURN_PHRASES) {
    if (tagStr.includes(p)) return { keep: false, reason: `mechanical tag:${p}` };
  }

  // 3) Title-pattern backstop for price ladders that slipped past tags. Kept
  //    DELIBERATELY NARROW — Polymarket ladders use a "___" blank or an explicit
  //    price ("Bitcoin above ___ on June 2?", "What price will X hit…", "hit
  //    $150k by…"). We must NOT match real markets like "Will Iran hit Israel by
  //    end of June?" (no number after "hit") or "Seoul Mayoral…" ("may" inside
  //    "mayoral"). The generic month/`.*` rule was removed for that reason.
  const tt = title.toLowerCase();
  const ladder =
    /\b(?:above|below|hit)\s+_+/.test(tt) || // "above ___", "hit__"
    /\bwhat price will\b/.test(tt) ||
    /\bhit\s+\$?\d[\d.,]*\s*k?\b.*\bby\b/.test(tt); // "hit $150k by …"
  if (ladder) return { keep: false, reason: "title:price-ladder" };

  // Noise tags are simply ignored (not a reason to drop); kept for clarity.
  void NOISE_TAGS;

  return { keep: true, reason: "world-event" };
}

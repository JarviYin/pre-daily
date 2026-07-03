import { deriveCategory } from "./categories";
import { curate } from "./curation";
import type { Badge, Category, EditionRole, Outcome } from "./types";

// ─────────────────────────────────────────────────────────────
// Polymarket Gamma API ingestion + edition selection.
//
// The edition is NOT "top N by volume" (that surfaces the same evergreen mega
// markets every day). It is "today's MOVERS": markets ranked by a composite
// HEAT score over 24h price movement, volume acceleration, newness and
// resolution-imminence — gated by liquidity, with mechanical churn
// (sports/esports/price-ladders) removed in lib/curation.ts.
//
// Endpoint shape verified live: /events?active=true&closed=false
//   &order=volume24hr&ascending=false&limit=N → Event[]
// Gotchas (all handled below):
//  • market.outcomes / market.outcomePrices are JSON-ENCODED STRINGS.
//  • Multi-outcome events (negRisk) have one sub-market per candidate; the
//    candidate's probability is that sub-market's "Yes" price (groupItemTitle).
//  • endDate can be in the past even when closed=false → must filter.
// ─────────────────────────────────────────────────────────────

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const FETCH_LIMIT = 150; // over-fetch by 24h volume, then curate + heat-rank down
// Supplemental pull so macro/finance candidates exist even on低成交 days when
// they would miss the top-150-by-24h-volume pool. Slug verified live 2026-07.
const FINANCE_TAG = "economy";
const FINANCE_FETCH_LIMIT = 50;
// Editorial guarantee: the digest always carries some macro/finance coverage
// (product decision 2026-07); quota slots are filled by heat among these cats.
const FINANCE_MIN = 2;
const MAX_OUTCOMES = 6; // top outcomes shown; remainder folded into "其他"
const MAX_PER_CATEGORY = 3; // editorial: stop one topic monopolising the board
const SETTLED_THRESHOLD = 0.985; // leading prob ≥ this ⇒ basically decided
const LIQ_FLOOR = 25_000; // credibility gate: ignore thin/manipulable pools
const NEW_DAYS = 4; // created within this many days ⇒ "新晋"
const HERO_MIN_MOVE = 0.03; // a hero needs at least a 3pt 24h swing
const ANCHOR_COUNT = 2; // evergreen high-volume markets kept for context
const MOVE_FULL = 0.15; // a 15pt 24h swing scores full marks on the move term
const SURGE_CAP = 8; // cap volume-acceleration so new markets don't saturate

// Badge thresholds (kept here so QA can re-derive them identically).
const BADGE_MOVE = 0.05; // 异动: |24h move| ≥ 5pt
const BADGE_SURGE = 2; // 放量: 24h volume ≥ 2× own 7d daily average
const SOON_DAYS = 10; // 临近揭晓 window
const UNCERTAIN_LO = 0.15; // still a contest if leader is within [15%, 85%]
const UNCERTAIN_HI = 0.85;

type RawTag = { label?: string; slug?: string };
type RawMarket = {
  question?: string;
  groupItemTitle?: string;
  outcomes?: unknown;
  outcomePrices?: unknown;
  oneDayPriceChange?: number;
  volume?: string | number;
  active?: boolean;
  closed?: boolean;
};
type RawEvent = {
  id?: string | number;
  title?: string;
  slug?: string;
  negRisk?: boolean;
  enableNegRisk?: boolean;
  new?: boolean;
  createdAt?: string;
  volume?: string | number;
  volume24hr?: string | number;
  volume1wk?: string | number;
  volume1mo?: string | number;
  liquidity?: string | number;
  endDate?: string;
  closed?: boolean;
  tags?: RawTag[];
  markets?: RawMarket[];
};

export type RawCuratedMarket = {
  marketId: string;
  slug: string;
  sourceUrl: string;
  title: string;
  category: Category;
  volume: number;
  volume24hr: number;
  volume1wk: number;
  liquidity: number;
  endDate: string | null;
  leadingChange: number | null; // 24h move of the LEADING outcome
  move24h: number | null; // 24h move of the HEADLINE (most-moved) outcome, signed
  headlineOption: string | null; // label of the most-moved outcome
  surge: number; // 24h volume / own 7d daily avg (≥1 = accelerating)
  isNew: boolean;
  heatScore: number; // filled by selectEdition
  role: EditionRole; // filled by selectEdition
  badges: Badge[]; // filled by selectEdition
  outcomes: Outcome[];
};

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** Parse a value that may be a JSON-encoded string OR already an array. */
function parseJsonArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function fetchWithRetry(url: string, tries = 3): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`Gamma HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Gamma fetch failed");
}

async function fetchTopEvents(limit: number, tagSlug?: string): Promise<RawEvent[]> {
  const url =
    `${GAMMA_BASE}/events?active=true&closed=false` +
    `&order=volume24hr&ascending=false&limit=${limit}` +
    (tagSlug ? `&tag_slug=${tagSlug}` : "");
  const data = await fetchWithRetry(url);
  return Array.isArray(data) ? (data as RawEvent[]) : [];
}

/**
 * Build the normalised, sorted outcome distribution for one event.
 * Returns null when the event is NOT a clean probability partition we can
 * honestly display (e.g. a non-negRisk bundle of independent markets that would
 * sum to >100%), or when it is effectively settled.
 *
 * `move24h` is the signed 24h change of the HEADLINE outcome (the one that
 * moved most), used to rank "today's movers"; `leadingChange` tracks only the
 * top line. `headlineOption` is the label of that most-moved outcome.
 */
function buildOutcomes(ev: RawEvent): {
  outcomes: Outcome[];
  leadingChange: number | null;
  move24h: number | null;
  headlineOption: string | null;
} | null {
  const markets = (ev.markets ?? []).filter(
    (m) => m.active !== false && m.closed !== true
  );
  if (markets.length === 0) return null;

  const isPartition = ev.negRisk === true || ev.enableNegRisk === true;

  // Each entry's `change` is the 24h delta of THAT outcome in absolute points.
  let raw: { option: string; probability: number; change: number | null }[] = [];

  if (isPartition) {
    for (const m of markets) {
      const names = parseJsonArray(m.outcomes).map(String);
      const prices = parseJsonArray(m.outcomePrices).map(toNum);
      if (!names.length || !prices.length || names.length !== prices.length) {
        console.warn(
          `[gamma] event ${ev.id} sub-market malformed outcomes (names=${names.length}, prices=${prices.length})`
        );
        continue;
      }
      const yesIdx = names.findIndex((n) => n.toLowerCase() === "yes");
      if (yesIdx < 0) {
        console.warn(
          `[gamma] event ${ev.id} negRisk sub-market missing "Yes": ${m.groupItemTitle || m.question}`
        );
        continue;
      }
      const label = (m.groupItemTitle || m.question || "—").trim();
      raw.push({
        option: label,
        probability: prices[yesIdx] ?? 0,
        change: typeof m.oneDayPriceChange === "number" ? m.oneDayPriceChange : null,
      });
    }
  } else if (markets.length === 1) {
    const m = markets[0];
    const names = parseJsonArray(m.outcomes).map(String);
    const prices = parseJsonArray(m.outcomePrices).map(toNum);
    if (!names.length || !prices.length || names.length !== prices.length) {
      console.warn(
        `[gamma] event ${ev.id} binary market malformed outcomes (names=${names.length}, prices=${prices.length})`
      );
      return null;
    }
    const odc = typeof m.oneDayPriceChange === "number" ? m.oneDayPriceChange : null;
    names.forEach((name, i) => {
      const isYes = name.toLowerCase() === "yes";
      raw.push({
        option: name,
        probability: prices[i] ?? 0,
        change: odc === null ? null : isYes ? odc : -odc,
      });
    });
  } else {
    // Non-negRisk multi-market bundle (date ladders, prop bundles): not a
    // partition; showing as one would mislead (>100%). Skip — correctness first.
    return null;
  }

  raw = raw.filter((o) => o.probability > 0);
  if (raw.length === 0) return null;

  // Normalise probabilities to sum to 1, AND scale each outcome's 24h change
  // into the SAME normalized space — so a reconstructed before/after
  // (after − change) stays internally consistent with the shown probability.
  const total = raw.reduce((s, o) => s + o.probability, 0);
  if (total <= 0) return null;
  for (const o of raw) {
    o.probability /= total;
    if (o.change != null) o.change /= total;
  }

  // HEADLINE move = the outcome with the largest absolute 24h change. Computed
  // in build order (pre-sort) so a binary's Yes/No tie resolves to Yes.
  let headline: { option: string; change: number } | null = null;
  for (const o of raw) {
    if (o.change == null) continue;
    if (!headline || Math.abs(o.change) > Math.abs(headline.change)) {
      headline = { option: o.option, change: o.change };
    }
  }

  raw.sort((a, b) => b.probability - a.probability);

  // Drop effectively-settled markets — a 99.9% line carries no signal.
  if (raw[0].probability >= SETTLED_THRESHOLD) return null;

  const leadingChange = raw[0].change ?? null;
  const move24h =
    headline && Math.abs(headline.change) >= 0.005 ? headline.change : null;
  const headlineOption = move24h != null ? headline!.option : null;

  // Carry each outcome's own 24h delta — the LLM reads the DIRECTION of money
  // (who gained at whose expense), not just the headline scalar.
  let outcomes: Outcome[] = raw.map((o) => ({
    option: o.option,
    probability: o.probability,
    change: o.change,
  }));

  if (outcomes.length > MAX_OUTCOMES) {
    const head = outcomes.slice(0, MAX_OUTCOMES);
    const tail = outcomes.slice(MAX_OUTCOMES);
    // Never fold away the HEADLINE outcome — the hero's before/after must refer
    // to a row that is actually shown. Swap it in for the weakest head row.
    if (headlineOption && !head.some((o) => o.option === headlineOption)) {
      const hi = tail.findIndex((o) => o.option === headlineOption);
      if (hi >= 0) {
        const [h] = tail.splice(hi, 1);
        const demoted = head.pop();
        if (demoted) tail.push(demoted);
        head.push(h);
        head.sort((a, b) => b.probability - a.probability);
      }
    }
    const tailSum = tail.reduce((s, o) => s + o.probability, 0);
    if (tailSum > 0) head.push({ option: "其他", probability: tailSum });
    outcomes = head;
  }

  return { outcomes, leadingChange, move24h, headlineOption };
}

function eventToMarket(ev: RawEvent, now: number): RawCuratedMarket | null {
  if (!ev.slug || ev.closed) return null;

  // Drop already-resolved / past-deadline events.
  if (ev.endDate) {
    const end = Date.parse(ev.endDate);
    if (Number.isFinite(end) && end < now) return null;
  }

  const tagStrings = (ev.tags ?? [])
    .flatMap((t) => [t.slug, t.label])
    .filter((x): x is string => typeof x === "string");

  // Curation: drop mechanical churn (sports/esports/price-ladders).
  const verdict = curate(tagStrings, ev.title ?? "");
  if (!verdict.keep) {
    console.warn(`[curate] drop "${(ev.title ?? "").slice(0, 50)}" — ${verdict.reason}`);
    return null;
  }

  const built = buildOutcomes(ev);
  if (!built) return null;
  const { outcomes, leadingChange, move24h, headlineOption } = built;

  const volume24hr = toNum(ev.volume24hr);
  const volume1wk = toNum(ev.volume1wk);
  const volume1mo = toNum(ev.volume1mo);
  // Surge = today's volume vs the market's OWN recent daily average (not an
  // absolute figure — that is what de-biases evergreen mega-markets).
  const wkAvg = volume1wk > 0 ? volume1wk / 7 : volume1mo > 0 ? volume1mo / 30 : 0;
  const surge = wkAvg > 0 ? Math.min(volume24hr / wkAvg, SURGE_CAP) : 1;

  const ageDays = ev.createdAt
    ? (now - Date.parse(ev.createdAt)) / 86_400_000
    : Infinity;
  const isNew = ev.new === true || (Number.isFinite(ageDays) && ageDays <= NEW_DAYS);

  return {
    marketId: String(ev.id ?? ev.slug),
    slug: ev.slug,
    sourceUrl: `https://polymarket.com/event/${ev.slug}`,
    title: (ev.title ?? "").trim(),
    category: deriveCategory(tagStrings, ev.title ?? ""),
    volume: toNum(ev.volume),
    volume24hr,
    volume1wk,
    liquidity: toNum(ev.liquidity),
    endDate: ev.endDate ?? null,
    leadingChange,
    move24h,
    headlineOption,
    surge,
    isNew,
    heatScore: 0, // filled by selectEdition
    role: "heat", // filled by selectEdition
    badges: [], // filled by selectEdition
    outcomes,
  };
}

/** Composite "today's heat" score. Higher = more worth a reader's attention. */
function heatScore(m: RawCuratedMarket, now: number): number {
  const moveTerm = Math.min(Math.abs(m.move24h ?? 0) / MOVE_FULL, 1);
  const surgeTerm = Math.min(Math.log2(Math.max(m.surge, 1)) / 3, 1); // 8x ⇒ 1
  const newTerm = m.isNew ? 1 : 0;
  const soonTerm = isResolvingSoon(m, now) ? 1 : 0;
  const liqTerm = Math.min(Math.log10(Math.max(m.liquidity, 1)) / 7, 1);
  return 1.0 * moveTerm + 0.5 * surgeTerm + 0.4 * newTerm + 0.4 * soonTerm + 0.15 * liqTerm;
}

/**
 * A coarse topic key so near-duplicate markets that differ only by a date
 * horizon collapse to one ("…returns to normal by July 31?" vs "…by end of
 * June?"). Cut the title at date-qualifier prepositions, then keep the leading
 * significant words.
 */
function topicKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\?+$/, "")
    // Cut ONLY at a date-horizon "by …" (the qualifier that creates near-dup
    // markets, e.g. "…by July 31" vs "…by end of June"). Requiring a date-like
    // token after "by" avoids merging "passed by Senate" with "passed by House".
    .split(
      /\s+by\s+(?=(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|end of|q[1-4]|\d))/
    )[0]
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");
}

function isResolvingSoon(m: RawCuratedMarket, now: number): boolean {
  if (!m.endDate) return false;
  const days = (Date.parse(m.endDate) - now) / 86_400_000;
  if (!(days > 0 && days <= SOON_DAYS)) return false;
  const lead = m.outcomes[0]?.probability ?? 0;
  return lead >= UNCERTAIN_LO && lead <= UNCERTAIN_HI;
}

function badgesFor(m: RawCuratedMarket, now: number): Badge[] {
  if (m.role === "anchor") return ["持续高热"];
  const out: Badge[] = [];
  if (m.move24h != null && Math.abs(m.move24h) >= BADGE_MOVE) out.push("异动");
  if (m.surge >= BADGE_SURGE) out.push("放量");
  if (m.isNew) out.push("新晋");
  if (isResolvingSoon(m, now)) out.push("临近揭晓");
  return out;
}

/**
 * Compose the edition in three layers from curated, liquidity-gated markets:
 *   hero   — the single biggest 24h mover (the day's headline)
 *   heat   — markets by composite heat score (category-capped)
 *   anchor — up to ANCHOR_COUNT evergreen high-volume markets for context
 * Returns markets in DISPLAY order (hero first, anchors last).
 */
function selectEdition(markets: RawCuratedMarket[], topN: number): RawCuratedMarket[] {
  const now = Date.now();
  const eligible = markets.filter((m) => m.liquidity >= LIQ_FLOOR);
  const dropped = markets.length - eligible.length;
  if (dropped > 0) console.warn(`[select] ${dropped} markets below $${LIQ_FLOOR} liquidity gate`);
  if (eligible.length === 0) return [];

  for (const m of eligible) m.heatScore = heatScore(m, now);

  const chosen: RawCuratedMarket[] = [];
  const used = new Set<string>();
  const usedTopics = new Set<string>();
  const catCount: Partial<Record<Category, number>> = {};
  const take = (m: RawCuratedMarket, role: EditionRole) => {
    m.role = role;
    chosen.push(m);
    used.add(m.marketId);
    usedTopics.add(topicKey(m.title));
    catCount[m.category] = (catCount[m.category] ?? 0) + 1;
  };
  const isDuplicate = (m: RawCuratedMarket) =>
    used.has(m.marketId) || usedTopics.has(topicKey(m.title));

  // 1) Hero — biggest absolute 24h move (with a meaningful floor). Quiet day:
  //    fall back to the single highest heat score.
  const movers = eligible
    .filter((m) => m.move24h != null && Math.abs(m.move24h) >= HERO_MIN_MOVE)
    .sort((a, b) => Math.abs(b.move24h!) - Math.abs(a.move24h!));
  const hero =
    movers[0] ?? [...eligible].sort((a, b) => b.heatScore - a.heatScore)[0];
  if (hero) take(hero, "hero");

  // 1b) Finance quota — the digest must always carry macro/finance coverage,
  //     even when politics/geopolitics dominates the movers. Best candidates
  //     by heat among those categories claim their slots before the open pool.
  const FINANCE_CATS: ReadonlySet<Category> = new Set(["macro", "crypto"]);
  const financePool = eligible
    .filter((m) => FINANCE_CATS.has(m.category))
    .sort((a, b) => b.heatScore - a.heatScore);
  let financeCount = chosen.filter((m) => FINANCE_CATS.has(m.category)).length;
  for (const m of financePool) {
    if (financeCount >= FINANCE_MIN) break;
    if (isDuplicate(m)) continue;
    take(m, "heat");
    financeCount++;
  }

  // 2) Anchors — evergreen context: top by TOTAL volume, not already chosen.
  const anchorPool = eligible
    .filter((m) => !isDuplicate(m))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, ANCHOR_COUNT);
  const anchorIds = new Set(anchorPool.map((m) => m.marketId));

  // 3) Heat list fills the middle, category-capped + topic-deduped, leaving
  //    room for anchors. Reserved anchors are skipped here so they can't be
  //    consumed by the heat loop (which would shrink the anchor section).
  const heatTarget = Math.max(topN - anchorPool.length, 0);
  const ranked = [...eligible].sort((a, b) => b.heatScore - a.heatScore);
  for (const m of ranked) {
    if (chosen.length >= heatTarget) break;
    if (isDuplicate(m) || anchorIds.has(m.marketId)) continue;
    if ((catCount[m.category] ?? 0) >= MAX_PER_CATEGORY) continue;
    take(m, "heat");
  }

  // 4) Append anchors (skip any pulled into the heat list / duplicate topics).
  for (const m of anchorPool) {
    if (chosen.length >= topN) break;
    if (isDuplicate(m)) continue;
    take(m, "anchor");
  }

  // 5) Top up to topN from remaining heat order if still short (relax cat cap,
  //    keep topic dedup).
  if (chosen.length < topN) {
    for (const m of ranked) {
      if (chosen.length >= topN) break;
      if (isDuplicate(m)) continue;
      take(m, "heat");
    }
  }

  for (const m of chosen) m.badges = badgesFor(m, now);
  // Display invariant (and QA gate): the heat list reads in descending heat
  // order. Quota picks and top-ups enter out of order — re-sort the heat slice
  // while keeping hero first and anchors last.
  const ordered = [
    ...chosen.filter((m) => m.role === "hero"),
    ...chosen.filter((m) => m.role === "heat").sort((a, b) => b.heatScore - a.heatScore),
    ...chosen.filter((m) => m.role === "anchor"),
  ];
  return ordered.slice(0, topN);
}

/** End-to-end: fetch (main + finance tag) → parse → curate → heat-rank → compose. */
export async function getEditionMarkets(topN: number): Promise<RawCuratedMarket[]> {
  const now = Date.now();
  // The finance pull is best-effort: its failure must not kill the edition.
  const [events, financeEvents] = await Promise.all([
    fetchTopEvents(FETCH_LIMIT),
    fetchTopEvents(FINANCE_FETCH_LIMIT, FINANCE_TAG).catch((err) => {
      console.warn("[gamma] finance tag fetch failed (continuing without):", err);
      return [] as RawEvent[];
    }),
  ]);
  const seen = new Set(events.map((e) => String(e.id ?? e.slug)));
  const merged = [
    ...events,
    ...financeEvents.filter((e) => !seen.has(String(e.id ?? e.slug))),
  ];
  const parsed = merged
    .map((e) => eventToMarket(e, now))
    .filter((m): m is RawCuratedMarket => m !== null && m.title.length > 0);
  return selectEdition(parsed, topN);
}

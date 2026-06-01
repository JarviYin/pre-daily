import { deriveCategory } from "./categories";
import type { Category, Outcome } from "./types";

// ─────────────────────────────────────────────────────────────
// Polymarket Gamma API ingestion.
// Endpoint shape verified live: /events?active=true&closed=false
//   &order=volume24hr&ascending=false&limit=N → Event[]
// Key gotchas (all handled below):
//  • market.outcomes / market.outcomePrices are JSON-ENCODED STRINGS.
//  • Multi-outcome events (negRisk) have many sub-markets; each is a
//    "Will <candidate> win?" Yes/No market. The candidate's probability
//    is that sub-market's "Yes" price; the name is groupItemTitle.
//  • endDate can be in the past even when closed=false → must filter.
// ─────────────────────────────────────────────────────────────

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const FETCH_LIMIT = 60; // over-fetch, then curate down to TOP_N
const MAX_OUTCOMES = 6; // top outcomes shown; remainder folded into "其他"
const DEFAULT_MAX_PER_CATEGORY = 3; // editorial: avoid one topic monopolising
const SETTLED_THRESHOLD = 0.985; // leading prob ≥ this ⇒ basically decided, no signal

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
  volume?: string | number;
  volume24hr?: string | number;
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
  liquidity: number;
  endDate: string | null;
  leadingChange: number | null;
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

async function fetchTopEvents(limit: number): Promise<RawEvent[]> {
  const url =
    `${GAMMA_BASE}/events?active=true&closed=false` +
    `&order=volume24hr&ascending=false&limit=${limit}`;
  const data = await fetchWithRetry(url);
  return Array.isArray(data) ? (data as RawEvent[]) : [];
}

/**
 * Build the normalised, sorted outcome distribution for one event.
 * Returns null when the event is NOT a clean probability partition we can
 * honestly display (e.g. a non-negRisk bundle of independent "by date" or
 * prop markets that would sum to >100%), or when it is effectively settled.
 */
function buildOutcomes(
  ev: RawEvent
): { outcomes: Outcome[]; leadingChange: number | null } | null {
  const markets = (ev.markets ?? []).filter(
    (m) => m.active !== false && m.closed !== true
  );
  if (markets.length === 0) return null;

  const isPartition = ev.negRisk === true || ev.enableNegRisk === true;

  // Each entry's `change` is the 24h delta of THAT outcome in absolute points.
  let raw: { option: string; probability: number; change: number | null }[] = [];

  if (isPartition) {
    // Mutually-exclusive multi-outcome (negRisk): one sub-market per candidate,
    // probability = that sub-market's "Yes" price.
    for (const m of markets) {
      const names = parseJsonArray(m.outcomes).map(String);
      const prices = parseJsonArray(m.outcomePrices).map(toNum);
      if (!names.length || !prices.length || names.length !== prices.length) {
        console.warn(
          `[gamma] event ${ev.id} sub-market malformed outcomes (names=${names.length}, prices=${prices.length})`
        );
        continue; // skip this candidate rather than guess
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
    // Single binary market: show its real Yes / No outcomes.
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
    // Non-negRisk event with multiple INDEPENDENT markets (date ladders, prop
    // bundles). These are not a partition; displaying them as one would be
    // misleading (>100%). Skip — correctness over coverage.
    return null;
  }

  raw = raw
    .filter((o) => o.probability > 0)
    .sort((a, b) => b.probability - a.probability);
  if (raw.length === 0) return null;

  // Normalise so the distribution sums to exactly 1 (negRisk Yes-prices drift
  // a point or two from microstructure; this is what Polymarket shows too).
  const total = raw.reduce((s, o) => s + o.probability, 0);
  if (total <= 0) return null;
  for (const o of raw) o.probability /= total;

  // Drop effectively-settled markets — a 99.9% line carries no signal.
  if (raw[0].probability >= SETTLED_THRESHOLD) return null;

  const leadingChange = raw[0].change ?? null;

  let outcomes: Outcome[] = raw.map((o) => ({
    option: o.option,
    probability: o.probability,
  }));

  // Fold the long tail into "其他" so the shown bars still sum to ~100%.
  if (outcomes.length > MAX_OUTCOMES) {
    const head = outcomes.slice(0, MAX_OUTCOMES);
    const tailSum = outcomes
      .slice(MAX_OUTCOMES)
      .reduce((s, o) => s + o.probability, 0);
    if (tailSum > 0) head.push({ option: "其他", probability: tailSum });
    outcomes = head;
  }

  return { outcomes, leadingChange };
}

function eventToMarket(ev: RawEvent, now: number): RawCuratedMarket | null {
  if (!ev.slug || ev.closed) return null;

  // Drop already-resolved / past-deadline events.
  if (ev.endDate) {
    const end = Date.parse(ev.endDate);
    if (Number.isFinite(end) && end < now) return null;
  }

  const built = buildOutcomes(ev);
  if (!built) return null;
  const { outcomes, leadingChange } = built;

  const tagStrings = (ev.tags ?? [])
    .flatMap((t) => [t.slug, t.label])
    .filter((x): x is string => typeof x === "string");

  return {
    marketId: String(ev.id ?? ev.slug),
    slug: ev.slug,
    sourceUrl: `https://polymarket.com/event/${ev.slug}`,
    title: (ev.title ?? "").trim(),
    category: deriveCategory(tagStrings, ev.title ?? ""),
    volume: toNum(ev.volume),
    volume24hr: toNum(ev.volume24hr),
    liquidity: toNum(ev.liquidity),
    endDate: ev.endDate ?? null,
    leadingChange,
    outcomes,
  };
}

/**
 * Pick TOP_N markets by 24h volume, but cap how many can come from any one
 * category (default 3) so a single topic (e.g. sports) can't monopolise the
 * edition. Leftover slots are filled by remaining volume order.
 */
function curate(
  markets: RawCuratedMarket[],
  topN: number,
  maxPerCategory = DEFAULT_MAX_PER_CATEGORY
): RawCuratedMarket[] {
  const sorted = [...markets].sort((a, b) => b.volume24hr - a.volume24hr);
  const counts: Partial<Record<Category, number>> = {};
  const picked: RawCuratedMarket[] = [];
  const overflow: RawCuratedMarket[] = [];

  for (const m of sorted) {
    if (picked.length >= topN) break;
    const c = counts[m.category] ?? 0;
    if (c < maxPerCategory) {
      counts[m.category] = c + 1;
      picked.push(m);
    } else {
      overflow.push(m);
    }
  }
  // If quotas left us short, top up from overflow (still volume-ordered).
  for (const m of overflow) {
    if (picked.length >= topN) break;
    picked.push(m);
  }
  return picked.slice(0, topN);
}

/** End-to-end: fetch → parse → filter → curate. Throws on fetch failure. */
export async function getCuratedMarkets(
  topN: number,
  maxPerCategory = DEFAULT_MAX_PER_CATEGORY
): Promise<RawCuratedMarket[]> {
  const now = Date.now();
  const events = await fetchTopEvents(FETCH_LIMIT);
  const parsed = events
    .map((e) => eventToMarket(e, now))
    .filter((m): m is RawCuratedMarket => m !== null && m.title.length > 0);
  return curate(parsed, topN, maxPerCategory);
}

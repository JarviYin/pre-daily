// World Cup data from Polymarket Gamma. The 2026 FIFA World Cup Winner market
// is a single negRisk event — one sub-market per national team, where the
// team's championship probability is its "Yes" price. We also best-effort pull
// the day's match markets (only meaningful once the tournament is underway).
//
// This is the DATA layer only — the deep narrative is written by lib/wc-llm.ts.

const GAMMA = "https://gamma-api.polymarket.com";
export const WC_WINNER_SLUG = "world-cup-winner";
export const WC_END = "2026-07-20"; // Winner market endDate / tournament close

export type WcTeam = {
  team: string;
  prob: number; // championship implied probability 0..1
  move24h: number | null; // 24h change in probability (points), signed
  volume: number; // total USD volume on that team's market
};

export type WcMatch = {
  title: string;
  slug: string;
  endDate: string | null;
  leader: string; // leading outcome label
  leaderProb: number;
};

export type WcSnapshot = {
  asOf: string; // ISO timestamp of fetch
  totalVolume: number;
  volume24hr: number;
  commentCount: number;
  teams: WcTeam[]; // sorted desc by probability
  topMovers: WcTeam[]; // sorted desc by |move24h| (meaningful moves only)
  matches: WcMatch[]; // today's / upcoming match markets (best-effort, may be empty)
};

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}
function parseJsonArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function fetchJson(url: string, tries = 3): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 20_000);
      const res = await fetch(url, {
        signal: c.signal,
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

type RawMarket = {
  question?: string;
  groupItemTitle?: string;
  outcomes?: unknown;
  outcomePrices?: unknown;
  oneDayPriceChange?: number;
  volume?: string | number;
  volumeNum?: number;
  active?: boolean;
  closed?: boolean;
  slug?: string;
  endDate?: string;
};
type RawEvent = {
  title?: string;
  volume?: string | number;
  volume24hr?: string | number;
  commentCount?: number;
  markets?: RawMarket[];
};

function teamYesProb(m: RawMarket): { prob: number; ok: boolean } {
  const names = parseJsonArray(m.outcomes).map(String);
  const prices = parseJsonArray(m.outcomePrices).map(toNum);
  const yi = names.findIndex((n) => n.toLowerCase() === "yes");
  if (yi < 0 || prices.length !== names.length) return { prob: 0, ok: false };
  return { prob: prices[yi] ?? 0, ok: true };
}

/** Fetch + parse the World Cup Winner market into a team snapshot. */
export async function getWorldCup(): Promise<WcSnapshot> {
  const data = await fetchJson(`${GAMMA}/events?slug=${WC_WINNER_SLUG}`);
  const ev = (Array.isArray(data) ? data[0] : data) as RawEvent | undefined;
  if (!ev) throw new Error("World Cup Winner event not found");

  const teams: WcTeam[] = [];
  for (const m of ev.markets ?? []) {
    if (m.active === false || m.closed === true) continue;
    const { prob, ok } = teamYesProb(m);
    if (!ok || prob <= 0) continue;
    const team = (m.groupItemTitle || m.question || "").trim();
    if (!team) continue;
    teams.push({
      team,
      prob,
      move24h: typeof m.oneDayPriceChange === "number" ? m.oneDayPriceChange : null,
      volume: m.volumeNum ?? toNum(m.volume),
    });
  }
  teams.sort((a, b) => b.prob - a.prob);

  const topMovers = teams
    .filter((t) => t.move24h != null && Math.abs(t.move24h) >= 0.005)
    .sort((a, b) => Math.abs(b.move24h!) - Math.abs(a.move24h!))
    .slice(0, 6);

  let matches: WcMatch[] = [];
  try {
    matches = await getTodayMatches();
  } catch {
    /* best-effort */
  }

  return {
    asOf: new Date().toISOString(),
    totalVolume: toNum(ev.volume),
    volume24hr: toNum(ev.volume24hr),
    commentCount: ev.commentCount ?? 0,
    teams,
    topMovers,
    matches,
  };
}

/**
 * Best-effort: find today's/imminent World Cup MATCH markets (e.g. "Spain vs
 * Brazil"). Only meaningful once the tournament starts; returns [] otherwise.
 * Soccer match events are tagged Soccer + World Cup and titled "X vs. Y".
 */
export async function getTodayMatches(): Promise<WcMatch[]> {
  const url =
    `${GAMMA}/events?active=true&closed=false&order=volume24hr&ascending=false&limit=100`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  const now = Date.now();
  const out: WcMatch[] = [];
  for (const e of data as (RawEvent & { slug?: string; endDate?: string; tags?: { label?: string }[] })[]) {
    const title = (e.title || "").trim();
    const tags = (e.tags || []).map((t) => (t.label || "").toLowerCase()).join(" ");
    const isWcMatch =
      /\bvs\.?\b/i.test(title) && /world cup|fifa/.test(tags + " " + title.toLowerCase());
    if (!isWcMatch) continue;
    // within the next ~36h
    const end = e.endDate ? Date.parse(e.endDate) : NaN;
    if (Number.isFinite(end) && (end < now - 6 * 3600e3 || end > now + 36 * 3600e3)) continue;
    const m = (e.markets || [])[0];
    let leader = "",
      leaderProb = 0;
    if (m) {
      const names = parseJsonArray(m.outcomes).map(String);
      const prices = parseJsonArray(m.outcomePrices).map(toNum);
      let bi = -1;
      prices.forEach((p, i) => {
        if (p > leaderProb) {
          leaderProb = p;
          bi = i;
        }
      });
      leader = bi >= 0 ? names[bi] ?? "" : "";
    }
    out.push({
      title,
      slug: (e as { slug?: string }).slug ?? "",
      endDate: e.endDate ?? null,
      leader,
      leaderProb,
    });
  }
  return out.slice(0, 8);
}

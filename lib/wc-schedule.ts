// World Cup MATCH-LEVEL data from Polymarket Gamma — the schedule layer.
//
// Every World Cup fixture is its own Gamma event with a predictable slug
// (`fifwc-mex-rsa-2026-06-11`) holding three markets: home win / draw / away
// win ("Yes" price = implied probability). Companion events share the slug
// plus a suffix (`-more-markets`, `-exact-score`, …). The event's `startTime`
// is the real kickoff, so the full tournament schedule — fixtures, kickoff
// times, live odds, and (for closed events) market-settled results — comes
// from Gamma alone, no external football API.
//
// Honesty rule: a RESULT is only ever derived from a RESOLVED market (price
// pinned at ~1). We never guess outcomes from live prices.

import { teamKey } from "./wc-names";

const GAMMA = "https://gamma-api.polymarket.com";
const TAG = "fifa-world-cup";

export type WcFixture = {
  slug: string;
  teamA: string;
  teamB: string;
  kickoff: string | null; // ISO UTC kickoff (event.startTime)
  group: string | null; // "A".."L" when derivable from group markets
  vol24h: number;
  probA: number;
  probDraw: number;
  probB: number;
  live: boolean;
  ended: boolean;
  /** Market-settled outcome (resolved markets only), else null. */
  result: "A" | "draw" | "B" | null;
  /** Settled exact score like "2-1" (best-effort, resolved market only). */
  score: string | null;
};

export type WcGroupStanding = {
  group: string; // "A".."L"
  teams: { team: string; winGroupProb: number; move24h: number | null }[];
};

export type WcFocusProp = { label: string; prob: number };

export type WcScheduleSnapshot = {
  asOf: string; // ISO fetch time
  upcoming: WcFixture[]; // kickoff within the next ~28h, soonest first
  live: WcFixture[];
  finished: WcFixture[]; // ended within the last ~26h, latest first
};

// ── Gamma plumbing ──────────────────────────────────────────────────────────

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
  volumeNum?: number;
  volume?: string | number;
  active?: boolean;
  closed?: boolean;
};
type RawEvent = {
  title?: string;
  slug?: string;
  startTime?: string;
  endDate?: string;
  live?: boolean;
  ended?: boolean;
  closed?: boolean;
  volume24hr?: string | number;
  markets?: RawMarket[];
};

function yesProb(m: RawMarket): number | null {
  const names = parseJsonArray(m.outcomes).map(String);
  const prices = parseJsonArray(m.outcomePrices).map(toNum);
  const yi = names.findIndex((n) => n.toLowerCase() === "yes");
  if (yi < 0 || prices.length !== names.length) return null;
  return prices[yi] ?? null;
}

// Main fixture events: `fifwc-<a>-<b>-YYYY-MM-DD` (companion events carry an
// extra suffix after the date, e.g. `…-more-markets`).
const FIXTURE_SLUG = /^fifwc-.+-\d{4}-\d{2}-\d{2}$/;

async function listTagEvents(params: string, maxPages = 4): Promise<RawEvent[]> {
  const out: RawEvent[] = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await fetchJson(
      `${GAMMA}/events?tag_slug=${TAG}&${params}&limit=100&offset=${page * 100}`
    );
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...(data as RawEvent[]));
    if (data.length < 100) break;
  }
  return out;
}

// ── Fixture parsing ─────────────────────────────────────────────────────────

const VS = /\s+vs\.?\s+/i;

function parseFixture(e: RawEvent): WcFixture | null {
  const slug = e.slug ?? "";
  const title = (e.title ?? "").trim();
  if (!FIXTURE_SLUG.test(slug) || !VS.test(title)) return null;
  const [teamA, teamB] = title.split(VS).map((s) => s.trim());
  if (!teamA || !teamB) return null;

  let probA = 0,
    probDraw = 0,
    probB = 0;
  let result: WcFixture["result"] = null;
  for (const m of e.markets ?? []) {
    const label = (m.groupItemTitle || m.question || "").trim();
    const p = yesProb(m);
    if (p == null) continue;
    const isDraw = /^draw\b/i.test(label);
    const side = isDraw ? "draw" : teamKey(label) === teamKey(teamA) ? "A" : teamKey(label) === teamKey(teamB) ? "B" : null;
    if (side === "A") probA = p;
    else if (side === "B") probB = p;
    else if (side === "draw") probDraw = p;
    else continue;
    // Resolved sub-market (price pinned) on a closed event ⇒ settled result.
    if ((e.closed || e.ended) && p >= 0.95) result = side;
  }

  return {
    slug,
    teamA,
    teamB,
    kickoff: e.startTime ?? null,
    group: null, // attached later from group markets
    vol24h: toNum(e.volume24hr),
    probA,
    probDraw,
    probB,
    live: e.live === true,
    ended: e.ended === true || e.closed === true,
    result,
    score: null, // attached later (resolved exact-score market)
  };
}

/** Settled exact score for a finished fixture (resolved market only). */
async function fetchSettledScore(fixtureSlug: string): Promise<string | null> {
  try {
    const data = await fetchJson(`${GAMMA}/events?slug=${fixtureSlug}-exact-score`);
    const ev = (Array.isArray(data) ? data[0] : null) as RawEvent | null;
    if (!ev) return null;
    for (const m of ev.markets ?? []) {
      const p = yesProb(m);
      if (p != null && p >= 0.95) {
        const label = (m.groupItemTitle || m.question || "").trim();
        const score = label.match(/\d+\s*[-–:]\s*\d+/)?.[0]?.replace(/\s/g, "");
        if (score) return score;
      }
    }
  } catch {
    /* best-effort */
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * The schedule around NOW: recently finished (≤26h), live, and upcoming
 * (≤28h) fixtures with their current 1X2 odds. Windows are sized so the
 * morning edition recaps last night and the evening push previews tonight.
 */
export async function getWcSchedule(): Promise<WcScheduleSnapshot> {
  const now = Date.now();
  const [open, closed] = await Promise.all([
    listTagEvents("active=true&closed=false"),
    listTagEvents("closed=true&order=endDate&ascending=false", 1),
  ]);

  const seen = new Set<string>();
  const fixtures: WcFixture[] = [];
  for (const e of [...open, ...closed]) {
    const f = parseFixture(e);
    if (f && !seen.has(f.slug)) {
      seen.add(f.slug);
      fixtures.push(f);
    }
  }

  const ts = (f: WcFixture) => (f.kickoff ? Date.parse(f.kickoff) : NaN);
  const live = fixtures.filter((f) => f.live && !f.ended);
  const upcoming = fixtures
    .filter((f) => !f.ended && !f.live)
    .filter((f) => {
      const t = ts(f);
      return Number.isFinite(t) && t >= now - 30 * 60e3 && t <= now + 28 * 3600e3;
    })
    .sort((a, b) => ts(a) - ts(b));
  const finished = fixtures
    .filter((f) => f.ended)
    .filter((f) => {
      const t = ts(f);
      // Matches run ~2h; treat kickoff within the last 26h as "last night".
      return Number.isFinite(t) && t >= now - 26 * 3600e3 && t <= now;
    })
    .sort((a, b) => ts(b) - ts(a));

  // Attach settled scores to finished fixtures (few per day; best-effort).
  await Promise.all(
    finished.slice(0, 8).map(async (f) => {
      if (f.result) f.score = await fetchSettledScore(f.slug);
    })
  );

  return { asOf: new Date().toISOString(), upcoming, live, finished };
}

/**
 * Group-stage standings as the market prices them: each "World Cup Group X
 * Winner" negRisk event lists the group's 4 teams (+ "Other") with their
 * win-the-group probability.
 */
export async function getWcGroups(): Promise<WcGroupStanding[]> {
  const events = await listTagEvents("active=true&closed=false", 2);
  const groups: WcGroupStanding[] = [];
  for (const e of events) {
    const m = (e.title ?? "").match(/^World Cup Group ([A-L]) Winner$/i);
    if (!m) continue;
    const teams: WcGroupStanding["teams"] = [];
    for (const mk of e.markets ?? []) {
      const team = (mk.groupItemTitle || "").trim();
      if (!team || /^other$/i.test(team)) continue;
      const p = yesProb(mk);
      if (p == null) continue;
      teams.push({
        team,
        winGroupProb: p,
        move24h: typeof mk.oneDayPriceChange === "number" ? mk.oneDayPriceChange : null,
      });
    }
    teams.sort((a, b) => b.winGroupProb - a.winGroupProb);
    if (teams.length) groups.push({ group: m[1].toUpperCase(), teams });
  }
  groups.sort((a, b) => a.group.localeCompare(b.group));
  return groups;
}

/** Attach group letters to fixtures (group-stage only; best-effort). */
export function attachGroups(fixtures: WcFixture[], groups: WcGroupStanding[]): void {
  const byTeam = new Map<string, string>();
  for (const g of groups) for (const t of g.teams) byTeam.set(teamKey(t.team), g.group);
  for (const f of fixtures) {
    f.group = byTeam.get(teamKey(f.teamA)) ?? byTeam.get(teamKey(f.teamB)) ?? null;
  }
}

// Translate the frequent prop-market names; anything unmatched falls back to
// the (prefix-stripped) English. The "Mexico vs. South Africa: " prefix is
// always dropped — the surrounding card already names the tie.
const PROP_ZH: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/^both teams to score in (?:the )?first half\??$/i, "上半场双方均进球"],
  [/^both teams to score in (?:the )?second half\??$/i, "下半场双方均进球"],
  [/^both teams to score\??$/i, "双方均进球"],
  [/^over (\d+(?:\.\d+)?) goals\??$/i, (m) => `总进球超 ${m[1]}`],
  [/^under (\d+(?:\.\d+)?) goals\??$/i, (m) => `总进球低于 ${m[1]}`],
  [/^will there be a penalty\??$/i, "出现点球"],
  [/^will there be a red card\??$/i, "出现红牌"],
  [/^will there be overtime\??$/i, "进入加时"],
  [/^draw at half ?time\??$/i, "半场战平"],
];

function propLabel(raw: string): string {
  const s = raw.replace(/^.*?\bvs\.?\b[^:]*:\s*/i, "").trim();
  for (const [re, out] of PROP_ZH) {
    const m = s.match(re);
    if (m) return typeof out === "string" ? out : out(m);
  }
  return s;
}

/**
 * Extra angles on the day's focus match from its "- More Markets" companion
 * event: the highest-volume binary props (O/U goals, BTTS, …) with their
 * current "Yes" probability. Frequent prop names are translated to Chinese;
 * the rest keep Polymarket's English (prefix-stripped).
 */
export async function getFocusProps(fixtureSlug: string): Promise<WcFocusProp[]> {
  try {
    const data = await fetchJson(`${GAMMA}/events?slug=${fixtureSlug}-more-markets`);
    const ev = (Array.isArray(data) ? data[0] : null) as RawEvent | null;
    if (!ev) return [];
    const props = (ev.markets ?? [])
      .filter((m) => m.active !== false && m.closed !== true)
      .map((m) => ({
        label: propLabel((m.question || m.groupItemTitle || "").trim()),
        prob: yesProb(m),
        vol: m.volumeNum ?? toNum(m.volume),
      }))
      .filter((p): p is { label: string; prob: number; vol: number } => p.prob != null && !!p.label)
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 5)
      .map(({ label, prob }) => ({ label, prob }));
    return props;
  } catch {
    return [];
  }
}

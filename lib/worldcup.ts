// World Cup data from Polymarket Gamma. The 2026 FIFA World Cup Winner market
// is a single negRisk event — one sub-market per national team, where the
// team's championship probability is its "Yes" price. Match-level data
// (schedule, 1X2 odds, settled results, group standings, focus-match props)
// comes from lib/wc-schedule.ts; this module assembles the full snapshot.
//
// This is the DATA layer only — the deep narrative is written by lib/wc-llm.ts.

import {
  getWcSchedule,
  getWcGroups,
  getFocusProps,
  attachGroups,
  type WcFixture,
  type WcGroupStanding,
  type WcFocusProp,
  type WcScheduleSnapshot,
} from "./wc-schedule";

const GAMMA = "https://gamma-api.polymarket.com";
export const WC_WINNER_SLUG = "world-cup-winner";
export const WC_END = "2026-07-20"; // Winner market endDate / tournament close

export type WcTeam = {
  team: string;
  prob: number; // championship implied probability 0..1
  move24h: number | null; // 24h change in probability (points), signed
  volume: number; // total USD volume on that team's market
};

export type WcFocusMatch = {
  fixture: WcFixture;
  props: WcFocusProp[]; // top extra markets (O/U, BTTS, …) on this fixture
};

export type WcSnapshot = {
  asOf: string; // ISO timestamp of fetch
  totalVolume: number;
  volume24hr: number;
  commentCount: number;
  teams: WcTeam[]; // sorted desc by probability
  topMovers: WcTeam[]; // sorted desc by |move24h| (meaningful moves only)
  schedule: WcScheduleSnapshot; // recent results + live + upcoming fixtures
  groups: WcGroupStanding[]; // group-winner odds per group (group stage)
  focusMatch: WcFocusMatch | null; // today's highest-volume upcoming fixture
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

/** The day's focus match: highest 24h-volume upcoming (or live) fixture. */
function pickFocusFixture(s: WcScheduleSnapshot): WcFixture | null {
  const candidates = [...s.live, ...s.upcoming];
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b.vol24h > a.vol24h ? b : a));
}

/** Fetch + parse the full World Cup snapshot (winner odds + match layer). */
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

  // Match layer — each part best-effort so a partial Gamma hiccup never
  // takes down the whole snapshot (the winner board alone is still a brief).
  let schedule: WcScheduleSnapshot = { asOf: new Date().toISOString(), upcoming: [], live: [], finished: [] };
  let groups: WcGroupStanding[] = [];
  try {
    [schedule, groups] = await Promise.all([getWcSchedule(), getWcGroups()]);
    attachGroups([...schedule.upcoming, ...schedule.live, ...schedule.finished], groups);
  } catch (err) {
    console.warn("[worldcup] match layer unavailable:", err);
  }

  let focusMatch: WcFocusMatch | null = null;
  const focusFixture = pickFocusFixture(schedule);
  if (focusFixture) {
    focusMatch = { fixture: focusFixture, props: await getFocusProps(focusFixture.slug) };
  }

  return {
    asOf: new Date().toISOString(),
    totalVolume: toNum(ev.volume),
    volume24hr: toNum(ev.volume24hr),
    commentCount: ev.commentCount ?? 0,
    teams,
    topMovers,
    schedule,
    groups,
    focusMatch,
  };
}

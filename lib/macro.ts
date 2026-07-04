import type { MacroChip, MacroCalendarItem } from "./types";

// ─────────────────────────────────────────────────────────────
// External macro-market snapshot + week-ahead macro calendar for 宏观视角.
//
// Sources (all verified reachable without a key unless noted):
//  • US Treasury daily par yield curve CSV (official, public domain) — 2Y/10Y
//  • NY Fed markets API (official) — EFFR + fed funds target range
//  • CoinGecko simple/price — BTC/ETH spot + 24h change
//  • CBOE delayed quotes CDN — VIX
//  • gold-api.com — spot gold (small third party; treated as optional)
//  • alternative.me — crypto Fear & Greed index
//  • FRED (optional, FRED_API_KEY) — S&P 500, Nasdaq, broad dollar index
//  • ForexFactory weekly feed — this week's US calendar with forecasts
//  • federalreserve.gov calendar.json (official) — authoritative FOMC dates
//
// Every fetch is best-effort with its own timeout: a source outage nulls that
// slot only. Macro data must NEVER block publishing — callers treat a fully
// empty snapshot as "no macro section today".
// ─────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;

// A browser-ish UA: ForexFactory's export feed rejects the default fetch UA.
const UA = "Mozilla/5.0 (compatible; pre-daily/1.0; +https://www.pre-daily.com)";

export type FredQuote = { value: number; changePct: number | null; asOf: string };

export type MacroSnapshot = {
  treasury: {
    y2: number;
    y10: number;
    spreadBp: number;
    // Day-over-day change per leg (bp) + the deterministic curve read
    // (牛陡/熊陡/…). Derived in CODE, not by the LLM: a slope LEVEL alone
    // under-determines the story and made the editorial flip-flop day to day.
    d2Bp: number | null;
    d10Bp: number | null;
    curveRead: string | null;
    asOf: string;
  } | null;
  fed: { targetLo: number; targetHi: number; effr: number | null; asOf: string } | null;
  btc: { price: number; change24hPct: number } | null;
  eth: { price: number; change24hPct: number } | null;
  vix: { value: number; changePct: number | null } | null;
  gold: { price: number } | null;
  fearGreed: { value: number; label: string; prev: number | null } | null;
  spx: FredQuote | null;
  ndx: FredQuote | null;
  dollar: FredQuote | null;
};

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: accept, "User-Agent": UA },
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

// Error messages must NEVER carry the query string — FRED/CoinGecko keys ride
// there, and these errors get console.warn'd into Vercel logs.
function safeUrl(url: string): string {
  const u = new URL(url);
  return `${u.host}${u.pathname}`;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetchWithTimeout(url, "application/json");
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${safeUrl(url)}`);
  // Some sources (Fed calendar.json) prepend a BOM; some (ForexFactory when
  // rate-limited) return HTML — parse defensively from text.
  const text = (await res.text()).replace(/^﻿/, "");
  return JSON.parse(text);
}

async function getText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, "text/csv,text/plain,*/*");
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${safeUrl(url)}`);
  return res.text();
}

// Calendar labels/values reach the editorial prompt OUTSIDE the untrusted
// <market_data> wrapper (they are presented as trusted facts), so third-party
// strings (ForexFactory titles, forecast values) get the same tag-stripping
// treatment as Polymarket titles do in lib/llm.ts.
function sanitizeCal(s: string): string {
  return s.replace(/[<>]/g, "").trim();
}

// ── individual snapshot fetchers ─────────────────────────────

/**
 * Deterministic curve-shape read from the two legs' daily changes (bp).
 * Standard convention: bull = yields falling, bear = rising; steepener /
 * flattener by the slope change. Sub-2bp wiggles are called out as noise so
 * the editorial never over-reads a quiet day.
 */
function readCurve(d2: number, d10: number): string {
  const dSlope = d10 - d2;
  if (Math.abs(d2) < 2 && Math.abs(d10) < 2) return "单日变动微小，无明确形态";
  // Opposite legs of comparable size = a twist, not a clean regime — naming
  // either leg "dominant" would fabricate causality.
  if (d2 * d10 < 0 && Math.abs(Math.abs(d2) - Math.abs(d10)) <= 1) {
    return "扭转（短端与长端反向拉锯，信号混杂）";
  }
  // The dominant leg is the LARGER absolute mover; the regime label is only
  // used when that leg's direction matches the canonical pattern.
  const shortDominant = Math.abs(d2) >= Math.abs(d10);
  if (dSlope > 1.5) {
    if (shortDominant && d2 < 0) return "牛陡（短端下行主导，降息预期升温）";
    if (!shortDominant && d10 > 0) return "熊陡（长端上行主导，期限溢价/供给因素）";
    return "陡峭化（两端反向拉锯，主导方向不明）";
  }
  if (dSlope < -1.5) {
    if (!shortDominant && d10 < 0) return "牛平（长端下行主导，避险/久期买盘）";
    if (shortDominant && d2 > 0) return "熊平（短端上行主导，紧缩定价）";
    return "平坦化（两端反向拉锯，主导方向不明）";
  }
  if (d2 < 0 && d10 < 0) return "平行下移（整体做多债券）";
  if (d2 > 0 && d10 > 0) return "平行上移（整体抛售债券）";
  return "单日变动微小，无明确形态";
}

/** Latest 2Y/10Y + day-over-day deltas from the Treasury's official CSV. */
async function fetchTreasury(): Promise<MacroSnapshot["treasury"]> {
  const year = new Date().getUTCFullYear();
  // Collect rows across current year (+ previous year early in January) so we
  // always have the two most recent trading days for the delta.
  const rows: { ts: number; y2: number; y10: number; date: string }[] = [];
  for (const y of [year, year - 1]) {
    if (rows.length >= 2) break;
    const url =
      `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/` +
      `${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&_format=csv`;
    const csv = await getText(url).catch(() => "");
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) continue;
    const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    const iDate = header.indexOf("Date");
    const i2 = header.indexOf("2 Yr");
    const i10 = header.indexOf("10 Yr");
    if (iDate < 0 || i2 < 0 || i10 < 0) continue;
    for (const line of lines.slice(1)) {
      const cols = line.split(",").map((c) => c.replace(/"/g, "").trim());
      const ts = Date.parse(cols[iDate]);
      const y2 = parseFloat(cols[i2]);
      const y10 = parseFloat(cols[i10]);
      if (!Number.isFinite(ts) || !Number.isFinite(y2) || !Number.isFinite(y10)) continue;
      rows.push({ ts, y2, y10, date: cols[iDate] });
    }
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.ts - a.ts);
  const [latest, prev] = rows;
  const [m, d, yy] = latest.date.split("/");
  const d2Bp = prev ? Math.round((latest.y2 - prev.y2) * 100) : null;
  const d10Bp = prev ? Math.round((latest.y10 - prev.y10) * 100) : null;
  return {
    y2: latest.y2,
    y10: latest.y10,
    spreadBp: Math.round((latest.y10 - latest.y2) * 100),
    d2Bp,
    d10Bp,
    curveRead: d2Bp != null && d10Bp != null ? readCurve(d2Bp, d10Bp) : null,
    asOf: `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
  };
}

/** EFFR + current fed funds target range from the NY Fed's official API. */
async function fetchFed(): Promise<MacroSnapshot["fed"]> {
  const data = (await getJson("https://markets.newyorkfed.org/api/rates/all/latest.json")) as {
    refRates?: {
      type?: string;
      percentRate?: number;
      targetRateFrom?: number;
      targetRateTo?: number;
      effectiveDate?: string;
    }[];
  };
  const effr = (data.refRates ?? []).find((r) => r.type === "EFFR");
  if (!effr || effr.targetRateFrom == null || effr.targetRateTo == null) return null;
  return {
    targetLo: effr.targetRateFrom,
    targetHi: effr.targetRateTo,
    effr: effr.percentRate ?? null,
    asOf: effr.effectiveDate ?? "",
  };
}

/** BTC/ETH spot + 24h change from CoinGecko (demo key optional). */
async function fetchCrypto(): Promise<{ btc: MacroSnapshot["btc"]; eth: MacroSnapshot["eth"] }> {
  const key = process.env.COINGECKO_API_KEY;
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true" +
    (key ? `&x_cg_demo_api_key=${key}` : "");
  const data = (await getJson(url)) as Record<
    string,
    { usd?: number; usd_24h_change?: number }
  >;
  const pick = (id: string) => {
    const c = data[id];
    return c?.usd != null
      ? { price: c.usd, change24hPct: c.usd_24h_change ?? 0 }
      : null;
  };
  return { btc: pick("bitcoin"), eth: pick("ethereum") };
}

/** VIX from CBOE's official delayed-quotes CDN. */
async function fetchVix(): Promise<MacroSnapshot["vix"]> {
  const data = (await getJson(
    "https://cdn.cboe.com/api/global/delayed_quotes/quotes/_VIX.json"
  )) as { data?: { current_price?: number; price_change_percent?: number } };
  return data.data?.current_price != null
    ? { value: data.data.current_price, changePct: data.data.price_change_percent ?? null }
    : null;
}

/** Spot gold from gold-api.com (small third party — nice-to-have only). */
async function fetchGold(): Promise<MacroSnapshot["gold"]> {
  const data = (await getJson("https://api.gold-api.com/price/XAU")) as { price?: number };
  return data.price != null ? { price: data.price } : null;
}

/** Crypto Fear & Greed index (today + yesterday) from alternative.me. */
async function fetchFearGreed(): Promise<MacroSnapshot["fearGreed"]> {
  const data = (await getJson("https://api.alternative.me/fng/?limit=2")) as {
    data?: { value?: string; value_classification?: string }[];
  };
  const [today, prev] = data.data ?? [];
  if (!today?.value) return null;
  const zh: Record<string, string> = {
    "Extreme Fear": "极度恐惧",
    Fear: "恐惧",
    Neutral: "中性",
    Greed: "贪婪",
    "Extreme Greed": "极度贪婪",
  };
  return {
    value: Number(today.value),
    label: zh[today.value_classification ?? ""] ?? today.value_classification ?? "",
    prev: prev?.value != null ? Number(prev.value) : null,
  };
}

/** Latest value + day-over-day change for one FRED series (needs FRED_API_KEY). */
async function fetchFredSeries(seriesId: string): Promise<FredQuote | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  const data = (await getJson(
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
      `&api_key=${key}&file_type=json&sort_order=desc&limit=8`
  )) as { observations?: { date?: string; value?: string }[] };
  // FRED marks holidays/missing days as "." — take the two most recent numbers.
  const nums = (data.observations ?? [])
    .map((o) => ({ date: o.date ?? "", value: parseFloat(o.value ?? "") }))
    .filter((o) => Number.isFinite(o.value));
  if (nums.length === 0) return null;
  const [latest, prev] = nums;
  return {
    value: latest.value,
    changePct: prev ? ((latest.value - prev.value) / prev.value) * 100 : null,
    asOf: latest.date,
  };
}

/**
 * Fetch the full external snapshot in parallel. Individual failures null the
 * slot; returns null only when EVERY slot failed (treat as "no data today").
 */
export async function getMacroSnapshot(): Promise<MacroSnapshot | null> {
  const [treasury, fed, crypto, vix, gold, fearGreed, spx, ndx, dollar] =
    await Promise.all([
      fetchTreasury().catch((e) => (console.warn("[macro] treasury failed:", e), null)),
      fetchFed().catch((e) => (console.warn("[macro] nyfed failed:", e), null)),
      fetchCrypto().catch((e) => (console.warn("[macro] coingecko failed:", e), null)),
      fetchVix().catch((e) => (console.warn("[macro] cboe failed:", e), null)),
      fetchGold().catch((e) => (console.warn("[macro] gold failed:", e), null)),
      fetchFearGreed().catch((e) => (console.warn("[macro] fng failed:", e), null)),
      fetchFredSeries("SP500").catch((e) => (console.warn("[macro] fred SP500 failed:", e), null)),
      fetchFredSeries("NASDAQCOM").catch((e) => (console.warn("[macro] fred NASDAQCOM failed:", e), null)),
      fetchFredSeries("DTWEXBGS").catch((e) => (console.warn("[macro] fred DTWEXBGS failed:", e), null)),
    ]);
  const snapshot: MacroSnapshot = {
    treasury,
    fed,
    btc: crypto?.btc ?? null,
    eth: crypto?.eth ?? null,
    vix,
    gold,
    fearGreed,
    spx,
    ndx,
    dollar,
  };
  const alive = Object.values(snapshot).filter((v) => v !== null).length;
  console.log(`[macro] snapshot: ${alive}/10 sources ok`);
  return alive > 0 ? snapshot : null;
}

// ── week-ahead calendar ──────────────────────────────────────

// zh labels for recurring ForexFactory event titles (fallback: original title).
const EVENT_ZH: Record<string, string> = {
  "Non-Farm Employment Change": "非农新增就业",
  "Unemployment Rate": "失业率",
  "Average Hourly Earnings m/m": "平均时薪环比",
  "CPI m/m": "CPI环比",
  "CPI y/y": "CPI同比",
  "Core CPI m/m": "核心CPI环比",
  "Core PCE Price Index m/m": "核心PCE物价环比",
  "Advance GDP q/q": "GDP初值(年化环比)",
  "Prelim GDP q/q": "GDP修正值(年化环比)",
  "Final GDP q/q": "GDP终值(年化环比)",
  "ISM Manufacturing PMI": "ISM制造业PMI",
  "ISM Services PMI": "ISM服务业PMI",
  "Federal Funds Rate": "联邦基金利率决议",
  "FOMC Statement": "FOMC声明",
  "FOMC Press Conference": "美联储新闻发布会",
  "FOMC Meeting Minutes": "FOMC会议纪要",
  "Retail Sales m/m": "零售销售环比",
  "Core Retail Sales m/m": "核心零售销售环比",
  "PPI m/m": "PPI环比",
  "Core PPI m/m": "核心PPI环比",
  "Unemployment Claims": "初请失业金",
  "ADP Non-Farm Employment Change": "ADP就业人数",
  "JOLTS Job Openings": "JOLTS职位空缺",
  "CB Consumer Confidence": "谘商会消费者信心",
  "Prelim UoM Consumer Sentiment": "密歇根消费者信心初值",
};

function zhLabel(title: string): string {
  if (EVENT_ZH[title]) return EVENT_ZH[title];
  if (/powell/i.test(title)) return "鲍威尔讲话";
  return title;
}

type FfEvent = {
  title?: string;
  country?: string;
  date?: string; // ISO with timezone offset
  impact?: string;
  forecast?: string;
  previous?: string;
};

/** This week's US High/Medium-impact events (with forecasts) from ForexFactory. */
async function fetchFfCalendar(now: number): Promise<MacroCalendarItem[]> {
  const events = (await getJson(
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
  )) as FfEvent[];
  if (!Array.isArray(events)) return [];
  const horizon = now + 7 * 86_400_000;
  return events
    .filter((e) => e.country === "USD" && (e.impact === "High" || e.impact === "Medium"))
    .filter((e) => {
      const ts = Date.parse(e.date ?? "");
      // Keep events from ~12h ago (today's already-out prints give the LLM
      // "what just happened" context) through the next 7 days.
      return Number.isFinite(ts) && ts >= now - 12 * 3_600_000 && ts <= horizon;
    })
    .map((e) => ({
      date: e.date!,
      label: sanitizeCal(zhLabel((e.title ?? "").trim())),
      impact: (e.impact === "High" ? "high" : "medium") as "high" | "medium",
      forecast: e.forecast ? sanitizeCal(e.forecast) : undefined,
      previous: e.previous ? sanitizeCal(e.previous) : undefined,
      source: "forexfactory" as const,
    }));
}

type FedCalEvent = {
  title?: string;
  type?: string;
  month?: string; // "2026-07"
  days?: string; // "29" (single day; ranges appear as the final day)
};

/** Authoritative FOMC dates (meetings/minutes/pressers) from federalreserve.gov. */
async function fetchFomcCalendar(now: number): Promise<MacroCalendarItem[]> {
  const data = (await getJson("https://www.federalreserve.gov/json/calendar.json")) as {
    events?: FedCalEvent[];
  };
  const horizon = now + 30 * 86_400_000; // FOMC dates matter further out
  // Live feed carries title variants ("FOMC meeting", " FOMC Minutes") — match
  // trimmed + case-insensitive.
  const zh: Record<string, string> = {
    "fomc meeting": "FOMC议息会议",
    "fomc press conference": "美联储新闻发布会",
    "fomc minutes": "FOMC会议纪要",
  };
  const items = (data.events ?? [])
    .filter((e) => e.type === "FOMC" && e.month && e.days)
    .map((e) => {
      const day = parseInt((e.days ?? "").split(/[^0-9]+/).filter(Boolean).pop() ?? "", 10);
      const date = `${e.month}-${String(day).padStart(2, "0")}`;
      const key = (e.title ?? "").trim().toLowerCase();
      return { date, ts: Date.parse(`${date}T18:00:00Z`), label: zh[key] ?? sanitizeCal(e.title ?? "FOMC") };
    })
    .filter(({ ts }) => Number.isFinite(ts) && ts >= now - 12 * 3_600_000 && ts <= horizon);
  // A meeting day also lists its press conference — one entry per day is enough.
  return items
    .filter((i) => !(i.label === "美联储新闻发布会" && items.some((j) => j !== i && j.date === i.date)))
    .map(({ date, label }) => ({ date, label, impact: "high" as const, source: "fed" as const }));
}

// One FOMC decision shows up under several names across both sources.
const FOMC_FAMILY = /FOMC|美联储|联邦基金利率/;

/**
 * Merged week-ahead calendar: ForexFactory (forecasts + exact times) + official
 * FOMC dates, deduped per source-local day (FF entry wins — it carries the
 * time and forecast; the Fed feed covers the >7d horizon FF can't see).
 * Sorted by date, capped at 8.
 */
export async function getMacroCalendar(): Promise<MacroCalendarItem[]> {
  const now = Date.now();
  const [ff, fomc] = await Promise.all([
    fetchFfCalendar(now).catch((e) => (console.warn("[macro] ff calendar failed:", e), [])),
    fetchFomcCalendar(now).catch((e) => (console.warn("[macro] fed calendar failed:", e), [])),
  ]);
  // Compare on the SOURCE-LOCAL date (both feeds are US-anchored): ff "…T14:00:00-04:00"
  // sliced to 07-29 matches the Fed's date-only 07-29.
  const ffFomcDays = new Set(
    ff.filter((i) => FOMC_FAMILY.test(i.label)).map((i) => i.date.slice(0, 10))
  );
  const merged = [
    ...fomc.filter((i) => !ffFomcDays.has(i.date.slice(0, 10))),
    ...ff,
  ];
  return merged
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(0, 8);
}

// ── display + prompt formatting ──────────────────────────────

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function pctDelta(p: number | null | undefined): { delta?: string; tone?: MacroChip["tone"] } {
  if (p == null || !Number.isFinite(p)) return {};
  if (Math.abs(p) < 0.05) return { delta: "持平", tone: "flat" };
  return { delta: `${p > 0 ? "+" : ""}${p.toFixed(1)}%`, tone: p > 0 ? "up" : "down" };
}

/** Deterministic display chips from the snapshot (no LLM involved). */
export function buildMacroChips(s: MacroSnapshot): MacroChip[] {
  const chips: MacroChip[] = [];
  if (s.treasury) {
    chips.push({ label: "美债10Y", value: `${s.treasury.y10.toFixed(2)}%` });
    chips.push({
      label: "2s10s",
      value: `${s.treasury.spreadBp >= 0 ? "+" : ""}${s.treasury.spreadBp}bp`,
      tone: s.treasury.spreadBp >= 0 ? "flat" : "down",
    });
  }
  if (s.fed) {
    chips.push({
      label: "联储目标",
      value: `${s.fed.targetLo.toFixed(2)}–${s.fed.targetHi.toFixed(2)}%`,
    });
  }
  if (s.spx) chips.push({ label: "标普500", value: s.spx.value.toLocaleString("en-US"), ...pctDelta(s.spx.changePct) });
  if (s.ndx) chips.push({ label: "纳指", value: s.ndx.value.toLocaleString("en-US"), ...pctDelta(s.ndx.changePct) });
  if (s.dollar) chips.push({ label: "美元指数", value: s.dollar.value.toFixed(1), ...pctDelta(s.dollar.changePct) });
  if (s.btc) chips.push({ label: "BTC", value: fmtUsd(s.btc.price), ...pctDelta(s.btc.change24hPct) });
  if (s.eth) chips.push({ label: "ETH", value: fmtUsd(s.eth.price), ...pctDelta(s.eth.change24hPct) });
  if (s.vix) {
    // VIX is a fear gauge: rising = risk-off. Invert the tone so the colour
    // reads as market mood, not raw direction.
    const d = pctDelta(s.vix.changePct);
    chips.push({
      label: "VIX",
      value: s.vix.value.toFixed(1),
      ...d,
      ...(d.tone === "up" ? { tone: "down" as const } : d.tone === "down" ? { tone: "up" as const } : {}),
    });
  }
  if (s.gold) chips.push({ label: "黄金", value: fmtUsd(s.gold.price) });
  if (s.fearGreed) {
    chips.push({
      label: "加密恐贪",
      value: `${s.fearGreed.value} ${s.fearGreed.label}`,
      ...(s.fearGreed.prev != null
        ? { delta: `昨 ${s.fearGreed.prev}`, tone: "flat" as const }
        : {}),
    });
  }
  return chips;
}

/** Beijing-time day+time label for calendar lines — matches the UI rendering. */
function shanghaiLabel(iso: string): string {
  if (iso.length <= 10) return iso.slice(5); // date-only (Fed) stays as-is
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}(北京时间)`;
}

export type MacroFacts = {
  text: string;
  hasSnapshot: boolean; // 外部行情快照 present
  hasCalendar: boolean; // 宏观日历 present
};

/**
 * Real-data facts block for the editorial LLM. Everything here is verified
 * fetched data — the prompt explicitly allows citing THESE numbers (and only
 * these) as external market facts. The per-block flags let the prompt demand
 * citations ONLY for blocks that actually exist (missing block ⇒ its output
 * field is forced empty — no invitation to hallucinate).
 */
export function macroFactsForPrompt(
  s: MacroSnapshot | null,
  calendar: MacroCalendarItem[]
): MacroFacts | null {
  const lines: string[] = [];
  if (s?.treasury) {
    const t = s.treasury;
    const delta =
      t.d2Bp != null && t.d10Bp != null
        ? `；日变动 2Y ${t.d2Bp >= 0 ? "+" : ""}${t.d2Bp}bp、10Y ${t.d10Bp >= 0 ? "+" : ""}${t.d10Bp}bp` +
          (t.curveRead ? `；曲线形态：${t.curveRead}` : "")
        : "";
    lines.push(
      `- 美债收益率：2Y ${t.y2.toFixed(2)}%、10Y ${t.y10.toFixed(2)}%、` +
        `2s10s利差 ${t.spreadBp >= 0 ? "+" : ""}${t.spreadBp}bp${delta}（美国财政部官方，截至 ${t.asOf}）`
    );
  }
  if (s?.fed) {
    lines.push(
      `- 联邦基金目标区间 ${s.fed.targetLo.toFixed(2)}%–${s.fed.targetHi.toFixed(2)}%` +
        `${s.fed.effr != null ? `，EFFR ${s.fed.effr.toFixed(2)}%` : ""}（纽约联储，截至 ${s.fed.asOf}）`
    );
  }
  if (s?.spx) lines.push(`- 标普500 ${s.spx.value.toLocaleString("en-US")}（日变动 ${s.spx.changePct?.toFixed(1) ?? "?"}%，FRED，截至 ${s.spx.asOf}）`);
  if (s?.ndx) lines.push(`- 纳指综合 ${s.ndx.value.toLocaleString("en-US")}（日变动 ${s.ndx.changePct?.toFixed(1) ?? "?"}%，FRED，截至 ${s.ndx.asOf}）`);
  if (s?.dollar) lines.push(`- 美元广义指数 ${s.dollar.value.toFixed(1)}（日变动 ${s.dollar.changePct?.toFixed(1) ?? "?"}%，FRED，截至 ${s.dollar.asOf}）`);
  if (s?.btc) lines.push(`- BTC ${fmtUsd(s.btc.price)}（24h ${s.btc.change24hPct >= 0 ? "+" : ""}${s.btc.change24hPct.toFixed(1)}%）`);
  if (s?.eth) lines.push(`- ETH ${fmtUsd(s.eth.price)}（24h ${s.eth.change24hPct >= 0 ? "+" : ""}${s.eth.change24hPct.toFixed(1)}%）`);
  if (s?.vix) lines.push(`- VIX ${s.vix.value.toFixed(1)}${s.vix.changePct != null ? `（日变动 ${s.vix.changePct >= 0 ? "+" : ""}${s.vix.changePct.toFixed(1)}%）` : ""}（CBOE延迟行情）`);
  if (s?.gold) lines.push(`- 现货黄金 ${fmtUsd(s.gold.price)}`);
  if (s?.fearGreed) lines.push(`- 加密恐惧贪婪指数 ${s.fearGreed.value}（${s.fearGreed.label}${s.fearGreed.prev != null ? `，昨日 ${s.fearGreed.prev}` : ""}）`);

  const calLines = calendar.map((c) => {
    const extra = [
      c.forecast ? `预期 ${c.forecast}` : "",
      c.previous ? `前值 ${c.previous}` : "",
    ]
      .filter(Boolean)
      .join("，");
    return `- ${shanghaiLabel(c.date)} ${c.label}（${c.impact === "high" ? "高影响" : "中影响"}${extra ? `，${extra}` : ""}）`;
  });

  if (lines.length === 0 && calLines.length === 0) return null;
  const parts: string[] = [];
  if (lines.length) parts.push(`【外部行情快照 · 真实数据，可直接引用】\n${lines.join("\n")}`);
  if (calLines.length) parts.push(`【未来一周美国宏观日历 · 真实日程】\n${calLines.join("\n")}`);
  return {
    text: parts.join("\n\n"),
    hasSnapshot: lines.length > 0,
    hasCalendar: calLines.length > 0,
  };
}

import { getEditionMarkets } from "./gamma";
import {
  analyzeAll,
  summarizeDay,
  recapDay,
  estimateCost,
  analysisModelId,
  summaryModelId,
  type AnalyzeInput,
  type RecapMarketLine,
} from "./llm";
import {
  getMacroSnapshot,
  getMacroCalendar,
  buildMacroChips,
  macroFactsForPrompt,
  macroBriefForAnalysis,
  type MacroSnapshot,
} from "./macro";
import { getIssue } from "./db/queries";
import type {
  DailyIssue,
  DailyMarket,
  DailyNarrative,
  DailyRecap,
  MacroCalendarItem,
} from "./types";

const TOP_N = Number(process.env.TOP_N_MARKETS ?? 10);
const MIN_MARKETS = 6; // never publish a thin/broken edition

export class PipelineError extends Error {}

/**
 * Build a full daily edition from LIVE data + REAL LLM analysis.
 * Throws (does NOT publish) if data is unavailable or too thin — the caller
 * keeps yesterday's edition rather than fabricating or shipping a broken one.
 */
export async function generateIssue(date: string): Promise<DailyIssue> {
  // 0. External macro context (snapshot + calendar) — kicked off first so it
  //    runs in parallel with market fetch + analyses. Strictly best-effort:
  //    any failure degrades to null/[] and must never block publishing.
  const macroPromise = Promise.all([
    getMacroSnapshot().catch((err): MacroSnapshot | null => {
      console.warn("[pipeline] macro snapshot failed (section degrades):", err);
      return null;
    }),
    getMacroCalendar().catch((err): MacroCalendarItem[] => {
      console.warn("[pipeline] macro calendar failed (section degrades):", err);
      return [];
    }),
  ]);

  // 1. Live, curated, heat-ranked markets (hero → heat → anchors), in order.
  const raw = await getEditionMarkets(TOP_N);
  if (raw.length < MIN_MARKETS) {
    throw new PipelineError(
      `Only ${raw.length} clean world-event markets from Gamma (min ${MIN_MARKETS}); aborting publish.`
    );
  }

  // 1b. Macro data is needed BEFORE the per-market analyses (they get a
  //     compact macro context to anchor "why today"). It has been fetching in
  //     parallel with the market pull, so this await is usually near-instant.
  const [snapshot, calendar] = await macroPromise;
  const macroFacts = macroFactsForPrompt(snapshot, calendar);
  const macroCtx = macroBriefForAnalysis(snapshot, calendar);

  // Both RawCuratedMarket and DailyMarket satisfy this structural shape.
  const toAnalyzeInput = (m: AnalyzeInput): AnalyzeInput => ({
    title: m.title,
    category: m.category,
    volume: m.volume,
    volume24hr: m.volume24hr,
    liquidity: m.liquidity,
    endDate: m.endDate,
    leadingChange: m.leadingChange,
    move24h: m.move24h,
    headlineOption: m.headlineOption,
    surge: m.surge,
    isNew: m.isNew,
    outcomes: m.outcomes,
  });

  // 2. Real per-market analysis (bounded concurrency, with macro context).
  const { analyses, usage: analyzeUsage } = await analyzeAll(
    raw.map(toAnalyzeInput),
    4,
    macroCtx
  );

  // Keep only fully-analysed markets; honesty > coverage. Display order from
  // selectEdition (hero first, anchors last) is preserved.
  const kept: DailyMarket[] = [];
  raw.forEach((m, i) => {
    const analysis = analyses[i];
    if (!analysis) return;
    kept.push({
      rank: 0, // re-ranked below, preserving order
      marketId: m.marketId,
      slug: m.slug,
      sourceUrl: m.sourceUrl,
      title: m.title,
      category: m.category,
      volume: m.volume,
      volume24hr: m.volume24hr,
      volume1wk: m.volume1wk,
      liquidity: m.liquidity,
      endDate: m.endDate,
      leadingChange: m.leadingChange,
      move24h: m.move24h,
      headlineOption: m.headlineOption,
      surge: m.surge,
      isNew: m.isNew,
      role: m.role,
      heatScore: m.heatScore,
      badges: m.badges,
      outcomes: m.outcomes,
      analysis,
    });
  });

  if (kept.length < MIN_MARKETS) {
    throw new PipelineError(
      `Only ${kept.length} markets got valid analysis (min ${MIN_MARKETS}); aborting publish.`
    );
  }

  // Repair role gaps: if the hero's analysis failed and it was dropped, promote
  // the best surviving mover to hero so every edition has exactly one hero.
  if (!kept.some((m) => m.role === "hero")) {
    let bestIdx = 0;
    for (let i = 1; i < kept.length; i++) {
      const score =
        Math.abs(kept[i].move24h ?? 0) || kept[i].heatScore;
      const best =
        Math.abs(kept[bestIdx].move24h ?? 0) || kept[bestIdx].heatScore;
      if (score > best) bestIdx = i;
    }
    const [promoted] = kept.splice(bestIdx, 1);
    promoted.role = "hero";
    kept.unshift(promoted);
  }
  kept.forEach((m, i) => (m.rank = i + 1));

  // 3. Cross-market editorial over the kept set (WITH per-market analyses and
  //    the real external snapshot): 论点线 + 主线 + 资金信号 + 资产联动 + 宏观视角.
  const { result: brief, usage: summaryUsage } = await summarizeDay(
    kept.map((m) => ({ ...toAnalyzeInput(m), analysis: m.analysis })),
    macroFacts
  );

  if (!brief.summary || brief.summary.trim().length === 0) {
    throw new PipelineError("Empty daily summary; aborting publish.");
  }

  const costUsd = estimateCost(analyzeUsage) + estimateCost(summaryUsage);

  // Enhancement fields may degrade to "" (see SummarySchema.catch); store null
  // rather than an all-empty object so readers can cleanly gate on `briefing`.
  const briefing =
    brief.moneyFlow || brief.assetLink
      ? { moneyFlow: brief.moneyFlow, assetLink: brief.assetLink }
      : null;

  // 论点线: thesis 为整刊核心（渲染层以它替代 summary 卡）。thesis/pillars 全空
  // ⇒ null，页面回退到传统 summary 卡布局——升级不破坏旧刊与模型降级。
  const narrative: DailyNarrative | null =
    brief.thesis || brief.pillars.length > 0
      ? {
          thesis: brief.thesis,
          pillars: brief.pillars,
          counterView: brief.counterView,
          watch: brief.watch,
        }
      : null;

  // 4. 昨日判断复盘 — best-effort: 失败/无昨日刊 ⇒ null，绝不阻塞发布。
  const recap = await buildRecap(date, kept);

  // 宏观视角: deterministic chips/calendar + LLM texts; null when EVERYTHING
  // is empty so readers can cleanly gate on `macro` (same contract as briefing).
  // HARD gate (not just prompt guidance): a macro text without its underlying
  // data block is unpublishable — force it empty even if the LLM wrote one.
  const chips = snapshot ? buildMacroChips(snapshot) : [];
  const view = snapshot ? brief.macroView : "";
  const divergence = snapshot ? brief.macroDivergence : "";
  const watch = calendar.length ? brief.macroWatch : "";
  const macro =
    chips.length || calendar.length
      ? { chips, calendar, view, divergence, watch }
      : null;

  return {
    date,
    summary: brief.summary,
    briefing,
    macro,
    narrative,
    recap,
    modelId: analysisModelId(),
    summaryModelId: summaryModelId(),
    generatedAt: new Date().toISOString(),
    costUsd,
    markets: kept,
  };
}

/** 前一天（Asia/Shanghai 日历日，无夏令时），格式 YYYY-MM-DD。 */
function prevShanghaiDate(date: string): string | null {
  const d = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function toRecapLine(m: DailyMarket): RecapMarketLine {
  const lead = m.outcomes[0];
  return {
    title: m.title,
    slug: m.slug,
    leadOption: lead?.option ?? "—",
    leadProb: lead?.probability ?? 0,
    move24h: m.move24h ?? m.leadingChange,
  };
}

/**
 * 昨日判断复盘。只对比同一市场（slug）今日仍在数据中的情况；复盘 LLM 失败、
 * 无昨日刊、或没有足够数据 ⇒ 返回 null（页面隐藏该块）。
 */
async function buildRecap(
  date: string,
  today: DailyMarket[]
): Promise<DailyRecap | null> {
  const prevDate = prevShanghaiDate(date);
  if (!prevDate) return null;

  let prev: DailyIssue | null = null;
  try {
    prev = await getIssue(prevDate);
  } catch (err) {
    console.warn("[pipeline] recap: prev issue unavailable:", err);
    return null;
  }
  if (!prev || prev.date === date) return null;

  try {
    const { result } = await recapDay({
      prevDate: prev.date,
      prevSummary: prev.summary,
      prevThesis: prev.narrative?.thesis ?? "",
      prevMarkets: prev.markets.map(toRecapLine),
      todayMarkets: today.map(toRecapLine),
    });
    return {
      prevDate: prev.date,
      verdict: result.verdict,
      summary: result.summary,
      detail: result.detail,
    };
  } catch (err) {
    console.warn("[pipeline] recap LLM failed (skipping recap):", err);
    return null;
  }
}

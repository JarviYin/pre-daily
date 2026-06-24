import { getEditionMarkets } from "./gamma";
import {
  analyzeAll,
  summarizeDay,
  estimateCost,
  analysisModelId,
  summaryModelId,
  type AnalyzeInput,
} from "./llm";
import type { DailyIssue, DailyMarket } from "./types";

const TOP_N = Number(process.env.TOP_N_MARKETS ?? 10);
const MIN_MARKETS = 6; // never publish a thin/broken edition

export class PipelineError extends Error {}

/**
 * Build a full daily edition from LIVE data + REAL LLM analysis.
 * Throws (does NOT publish) if data is unavailable or too thin — the caller
 * keeps yesterday's edition rather than fabricating or shipping a broken one.
 */
export async function generateIssue(date: string): Promise<DailyIssue> {
  // 1. Live, curated, heat-ranked markets (hero → heat → anchors), in order.
  const raw = await getEditionMarkets(TOP_N);
  if (raw.length < MIN_MARKETS) {
    throw new PipelineError(
      `Only ${raw.length} clean world-event markets from Gamma (min ${MIN_MARKETS}); aborting publish.`
    );
  }

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
    surge: m.surge,
    isNew: m.isNew,
    outcomes: m.outcomes,
  });

  // 2. Real per-market analysis (bounded concurrency).
  const { analyses, usage: analyzeUsage } = await analyzeAll(raw.map(toAnalyzeInput));

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

  // 3. Cross-market editorial over the kept set: 异动主线 + 资金信号 + 资产联动.
  const { result: brief, usage: summaryUsage } = await summarizeDay(kept.map(toAnalyzeInput));

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

  return {
    date,
    summary: brief.summary,
    briefing,
    modelId: analysisModelId(),
    summaryModelId: summaryModelId(),
    generatedAt: new Date().toISOString(),
    costUsd,
    markets: kept,
  };
}

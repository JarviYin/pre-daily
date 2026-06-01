import { getCuratedMarkets } from "./gamma";
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
  // 1. Live, curated, trustworthy markets.
  const raw = await getCuratedMarkets(TOP_N);
  if (raw.length < MIN_MARKETS) {
    throw new PipelineError(
      `Only ${raw.length} clean markets from Gamma (min ${MIN_MARKETS}); aborting publish.`
    );
  }

  const inputs: AnalyzeInput[] = raw.map((m) => ({
    title: m.title,
    category: m.category,
    volume: m.volume,
    volume24hr: m.volume24hr,
    liquidity: m.liquidity,
    endDate: m.endDate,
    leadingChange: m.leadingChange,
    outcomes: m.outcomes,
  }));

  // 2. Real per-market analysis (bounded concurrency).
  const { analyses, usage: analyzeUsage } = await analyzeAll(inputs);

  // Keep only fully-analysed markets; honesty > coverage.
  const kept: DailyMarket[] = [];
  raw.forEach((m, i) => {
    const analysis = analyses[i];
    if (!analysis) return;
    kept.push({
      rank: 0, // re-ranked below
      marketId: m.marketId,
      slug: m.slug,
      sourceUrl: m.sourceUrl,
      title: m.title,
      category: m.category,
      volume: m.volume,
      volume24hr: m.volume24hr,
      liquidity: m.liquidity,
      endDate: m.endDate,
      leadingChange: m.leadingChange,
      outcomes: m.outcomes,
      analysis,
    });
  });

  if (kept.length < MIN_MARKETS) {
    throw new PipelineError(
      `Only ${kept.length} markets got valid analysis (min ${MIN_MARKETS}); aborting publish.`
    );
  }
  kept.forEach((m, i) => (m.rank = i + 1));

  // 3. Cross-market editorial summary over the kept set.
  const { summary, usage: summaryUsage } = await summarizeDay(
    kept.map((m) => ({
      title: m.title,
      category: m.category,
      volume: m.volume,
      volume24hr: m.volume24hr,
      liquidity: m.liquidity,
      endDate: m.endDate,
      leadingChange: m.leadingChange,
      outcomes: m.outcomes,
    }))
  );

  if (!summary || summary.trim().length === 0) {
    throw new PipelineError("Empty daily summary; aborting publish.");
  }

  const costUsd = estimateCost(analyzeUsage) + estimateCost(summaryUsage);

  return {
    date,
    summary,
    modelId: analysisModelId(),
    summaryModelId: summaryModelId(),
    generatedAt: new Date().toISOString(),
    costUsd,
    markets: kept,
  };
}

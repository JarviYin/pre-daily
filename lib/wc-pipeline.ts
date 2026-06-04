import { getWorldCup } from "./worldcup";
import { planAngle, SUNSET } from "./wc-angles";
import { generateWcBriefing, type WcBriefing } from "./wc-llm";
import { estimateCost } from "./llm";

export class WcPipelineError extends Error {}

/** Whether the World Cup special should still publish on the given date. */
export function wcActive(date: string): boolean {
  return date <= SUNSET;
}

/**
 * Build one day's World Cup briefing from LIVE odds + REAL LLM narrative.
 * Throws (does NOT persist) on failure so the caller keeps the prior briefing.
 */
export async function buildWcBriefing(date: string): Promise<WcBriefing> {
  const snap = await getWorldCup();
  if (snap.teams.length < 4) {
    throw new WcPipelineError(`Only ${snap.teams.length} WC teams from Gamma; aborting.`);
  }
  const angle = planAngle(date, snap);
  const { content, teamFocus, usage, modelId } = await generateWcBriefing(date, angle, snap);
  if (!content.lede || !teamFocus.length) {
    throw new WcPipelineError("Empty WC briefing content; aborting.");
  }
  return {
    date,
    phase: angle.phase,
    angleKey: angle.key,
    title: angle.title,
    headline: content.headline,
    lede: content.lede,
    teamFocus,
    oddsSnapshot: snap.teams.slice(0, 10),
    lookAhead: content.lookAhead,
    modelId,
    generatedAt: new Date().toISOString(),
    costUsd: estimateCost(usage),
  };
}

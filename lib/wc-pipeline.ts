import { getWorldCup } from "./worldcup";
import { getWcSchedule, getWcGroups, attachGroups } from "./wc-schedule";
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
    schedule: snap.schedule,
    groups: snap.groups.length ? snap.groups : null,
    focusMatch: snap.focusMatch
      ? { ...snap.focusMatch, analysis: content.matchAnalysis }
      : null,
    lookAhead: content.lookAhead,
    modelId,
    generatedAt: new Date().toISOString(),
    costUsd: estimateCost(usage),
  };
}

/**
 * Refresh ONLY the data layers of an existing briefing (schedule, groups, and
 * the focus fixture's odds) — no LLM call. Used by the evening matchday push
 * so the site + push carry fresh odds without rewriting the day's narrative.
 * Returns the updated briefing; throws if the schedule fetch fails.
 */
export async function refreshWcData(b: WcBriefing): Promise<WcBriefing> {
  const [schedule, groups] = await Promise.all([getWcSchedule(), getWcGroups()]);
  attachGroups([...schedule.upcoming, ...schedule.live, ...schedule.finished], groups);

  let focusMatch = b.focusMatch;
  if (focusMatch) {
    const liveFixture = [...schedule.live, ...schedule.upcoming, ...schedule.finished].find(
      (f) => f.slug === focusMatch!.fixture.slug
    );
    if (liveFixture) focusMatch = { ...focusMatch, fixture: liveFixture };
  }

  return { ...b, schedule, groups: groups.length ? groups : b.groups, focusMatch };
}

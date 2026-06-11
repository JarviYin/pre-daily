import { getLatestWcBriefing } from "./db/queries";
import { todayShanghai } from "./date";
import { SUNSET, phaseFor } from "./wc-angles";
import type { WcCardData } from "@/components/EditionView";
import type { WcHeroData } from "@/components/WorldCupHero";

const PHASE_LABEL: Record<string, string> = {
  pre: "赛前前瞻",
  group: "小组赛",
  knockout: "淘汰赛",
  final: "决赛",
  after: "已收官",
};

/** The pinned World Cup card for dated editions — null once the tournament ends. */
export async function getWcCard(): Promise<WcCardData | null> {
  if (todayShanghai() > SUNSET) return null; // tournament over → unpin
  try {
    const b = await getLatestWcBriefing();
    if (!b) return null;
    const lead = b.oddsSnapshot[0];
    return { headline: b.headline, leaderTeam: lead?.team, leaderProb: lead?.prob };
  } catch {
    return null;
  }
}

/**
 * The full-width homepage TOP section during the tournament: today's fixtures
 * + last night's settled results + championship board, from the latest
 * briefing (its data layer is refreshed again by the evening cron).
 */
export async function getWcHero(): Promise<WcHeroData | null> {
  if (todayShanghai() > SUNSET) return null;
  try {
    const b = await getLatestWcBriefing();
    if (!b) return null;
    const s = b.schedule;
    return {
      headline: b.headline,
      phaseLabel: PHASE_LABEL[phaseFor(todayShanghai())] ?? "赛事进行中",
      top: b.oddsSnapshot.slice(0, 5).map((t) => ({ team: t.team, prob: t.prob })),
      upcoming: s?.upcoming ?? [],
      live: s?.live ?? [],
      finished: s?.finished ?? [],
      focusSlug: b.focusMatch?.fixture.slug ?? null,
    };
  } catch {
    return null;
  }
}

import { getLatestWcBriefing } from "./db/queries";
import { todayShanghai } from "./date";
import { SUNSET } from "./wc-angles";
import type { WcCardData } from "@/components/EditionView";

/** The pinned World Cup card for daily editions — null once the tournament ends. */
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

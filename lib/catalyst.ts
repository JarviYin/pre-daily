// Catalyst calendar — purely DERIVED from an edition's markets, never persisted
// and never LLM-generated. Surfaces the time-sensitive angle for investors:
// which of today's covered markets resolve soonest (a near-term resolution is a
// dated catalyst / a closing window to act on a view).

import type { DailyMarket, CatalystEntry } from "./types";

const DAY_MS = 86_400_000;

/**
 * Markets resolving within `withinDays`, soonest first. `daysLeft` is whole
 * days from now (0 = resolves today). Callers slice for display. Markets with
 * no/expired endDate are excluded (the edition shouldn't carry expired ones,
 * but we guard anyway).
 */
export function catalystCalendar(markets: DailyMarket[], withinDays = 60): CatalystEntry[] {
  const now = Date.now();
  const horizon = now + withinDays * DAY_MS;

  return markets
    .filter((m) => {
      if (!m.endDate) return false;
      const t = Date.parse(m.endDate);
      return Number.isFinite(t) && t >= now && t <= horizon;
    })
    .map((m) => {
      const t = Date.parse(m.endDate!);
      const lead = m.outcomes[0];
      return {
        title: m.title,
        category: m.category,
        sourceUrl: m.sourceUrl,
        endDate: m.endDate!,
        daysLeft: Math.max(0, Math.ceil((t - now) / DAY_MS)),
        leadOption: lead?.option ?? "—",
        leadProb: lead?.probability ?? 0,
        move24h: m.move24h,
      };
    })
    .sort((a, b) => Date.parse(a.endDate) - Date.parse(b.endDate));
}

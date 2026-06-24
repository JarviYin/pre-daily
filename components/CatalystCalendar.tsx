import type { DailyMarket } from "@/lib/types";
import { catalystCalendar } from "@/lib/catalyst";
import { CategoryChip } from "./CategoryChip";
import { formatPct } from "@/lib/format";

// 催化日历 — which of today's covered markets resolve soonest. Purely derived
// from the edition's markets (no LLM, no storage): a near-term resolution is a
// dated catalyst / a closing window for acting on a view.
export function CatalystCalendar({ markets }: { markets: DailyMarket[] }) {
  const entries = catalystCalendar(markets).slice(0, 8);
  if (entries.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
        <span className="inline-block h-3 w-0.5 bg-bull" />
        📅 催化日历 · 临近揭晓
      </h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
        {entries.map((e, i) => {
          const when = e.daysLeft === 0 ? "今日揭晓" : `${e.daysLeft} 天后`;
          return (
            <a
              key={`${e.sourceUrl}-${i}`}
              href={e.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CategoryChip category={e.category} />
                  <span className="tnum text-[12px] text-faint">{when}</span>
                </div>
                <p className="mt-1 truncate text-[14px] text-fg">{e.title}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="tnum text-[15px] font-semibold text-bull">
                  {formatPct(e.leadProb)}
                </div>
                <div className="max-w-[8rem] truncate text-[11px] text-muted">{e.leadOption}</div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

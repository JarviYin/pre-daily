import type { DailyMacro, MacroCalendarItem } from "@/lib/types";
import { formatCnKickoff } from "@/lib/date";

// 宏观视角: external-market snapshot chips + LLM macro read + week-ahead
// calendar. Mirrors InvestmentBrief's degradation habits — every sub-block
// hides itself when empty; the whole section vanishes when nothing survives.

const DELTA_TONE: Record<NonNullable<DailyMacro["chips"][number]["tone"]>, string> = {
  up: "text-bull",
  down: "text-bear",
  flat: "text-muted",
};

function calDate(item: MacroCalendarItem): string {
  // ForexFactory entries carry a full timestamp (shown in Beijing time);
  // official Fed entries are date-only.
  if (item.date.length > 10) return formatCnKickoff(item.date);
  const [, m, d] = item.date.split("-").map(Number);
  return `${m}月${d}日`;
}

export function MacroView({ macro }: { macro: DailyMacro }) {
  const texts = [
    { icon: "🧭", label: "宏观定价", text: macro.view },
    { icon: "⚖️", label: "分歧信号", text: macro.divergence },
    { icon: "🔭", label: "一周前瞻", text: macro.watch },
  ].filter((t) => t.text && t.text.trim().length > 0);
  const chips = macro.chips ?? [];
  const calendar = macro.calendar ?? [];
  if (chips.length === 0 && calendar.length === 0 && texts.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
        <span className="inline-block h-3 w-0.5 bg-bull" />
        宏观视角
      </h2>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c.label}
              className="tnum whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] text-fg"
            >
              <span className="text-muted">{c.label}</span> {c.value}
              {c.delta ? (
                <span className={`ml-1 ${DELTA_TONE[c.tone ?? "flat"]}`}>{c.delta}</span>
              ) : null}
            </span>
          ))}
        </div>
      )}

      {texts.length > 0 && (
        <div className="mt-3 space-y-3">
          {texts.map((t) => (
            <div key={t.label} className="rounded-lg border border-line bg-surface p-4 sm:p-5">
              <p className="text-[13px] font-medium text-bull">
                {t.icon} {t.label}
              </p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-fg">{t.text}</p>
            </div>
          ))}
        </div>
      )}

      {calendar.length > 0 && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
          <p className="text-[13px] font-medium text-bull">📅 未来一周宏观日历</p>
          <ul className="mt-2 space-y-1.5">
            {calendar.map((e, i) => (
              <li key={`${e.date}-${e.label}-${i}`} className="flex items-baseline gap-2 text-[13px]">
                <span className="tnum shrink-0 text-muted">{calDate(e)}</span>
                {/* min-w-0 + break-words: unmapped ForexFactory titles arrive in
                    English at arbitrary length — wrap, never overflow 375px. */}
                <span className="min-w-0 flex-1 break-words text-fg">
                  {e.label}
                  {e.impact === "high" ? <span className="ml-1 text-bear">●</span> : null}
                </span>
                {(e.forecast || e.previous) && (
                  <span className="tnum shrink-0 whitespace-nowrap text-[12px] text-muted">
                    {e.forecast ? `预期 ${e.forecast}` : ""}
                    {e.forecast && e.previous ? " / " : ""}
                    {e.previous ? `前值 ${e.previous}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {chips.length > 0 && (
        <p className="mt-2 text-[12px] leading-relaxed text-faint">
          行情快照来自公开数据源（美国财政部 / 纽约联储 / CBOE / CoinGecko 等），延迟以各源为准。
        </p>
      )}
    </section>
  );
}

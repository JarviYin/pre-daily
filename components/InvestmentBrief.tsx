import type { DailyBriefing } from "@/lib/types";

// The cross-market investment read that expands the edition beyond the movers
// line: 资金信号 (where conviction is) + 资产联动 (what it implies for assets).
export function InvestmentBrief({ briefing }: { briefing: DailyBriefing }) {
  const items = [
    { icon: "💰", label: "资金信号", text: briefing.moneyFlow },
    { icon: "🔗", label: "资产联动", text: briefing.assetLink },
  ].filter((it) => it.text && it.text.trim().length > 0);
  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
        <span className="inline-block h-3 w-0.5 bg-bull" />
        投资视角
      </h2>
      <div className="mt-3 space-y-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-lg border border-line bg-surface p-4 sm:p-5"
          >
            <p className="text-[13px] font-medium text-bull">
              {it.icon} {it.label}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-fg">{it.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-faint">
        以上为基于公开市场数据的信息解读，不构成投资建议。
      </p>
    </section>
  );
}

import type { DailyMarket } from "@/lib/types";
import { liquidityTier } from "@/lib/types";
import { CategoryChip } from "./CategoryChip";
import { BadgeRow } from "./BadgeRow";
import { MoverChip } from "./MoverChip";
import { ProbabilityBar } from "./ProbabilityBar";
import { formatVolume, formatPct } from "@/lib/format";

const LIQ_LABEL: Record<string, string> = { high: "高", medium: "中", low: "低" };

export function MarketCard({
  market,
  rankLabel,
  maxHeat,
}: {
  market: DailyMarket;
  rankLabel: number; // position within its section (1-based)
  maxHeat: number; // for the accent strip width
}) {
  const {
    title,
    category,
    outcomes,
    leadingChange,
    volume,
    volume24hr,
    surge,
    liquidity,
    heatScore,
    badges,
    sourceUrl,
    analysis,
    endDate,
  } = market;
  const leader = outcomes[0];
  const liq = liquidityTier(liquidity);
  // Accent strip encodes today's HEAT (not raw volume) — felt, not read.
  const heft = maxHeat > 0 ? Math.max(heatScore / maxHeat, 0.02) : 0;

  return (
    <article className="relative overflow-hidden rounded-xl border border-line bg-surface">
      {/* Heat strip: width encodes the composite heat score. */}
      <div
        className="absolute left-0 top-0 h-[2px] bg-bull/60"
        style={{ width: `${heft * 100}%` }}
        aria-hidden
      />

      <div className="p-4 sm:p-5">
        {/* Meta row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="tnum w-5 text-right text-sm text-faint">{rankLabel}</span>
            <CategoryChip category={category} />
          </div>
          <div className="tnum flex items-center gap-3 text-[12px] text-faint">
            <span title="累计成交量">成交 {formatVolume(volume)}</span>
            <span title="24小时成交量">24h {formatVolume(volume24hr)}</span>
            {surge >= 2 && (
              <span className="text-bull/80" title="相对自身近7日日均放量倍数">
                放量 {surge.toFixed(1)}x
              </span>
            )}
            <span title="流动性（市场可信度）">流动性 {LIQ_LABEL[liq]}</span>
          </div>
        </div>

        {/* Title (links to the source market) */}
        <h3 className="mt-2.5 text-[15px] font-semibold leading-snug text-fg sm:text-[17px]">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-bull"
          >
            {title}
          </a>
        </h3>

        <BadgeRow badges={badges} className="mt-2" />

        {/* Hero: leading outcome + probability + 24h move */}
        <div className="mt-3 flex items-baseline gap-3">
          <span className="min-w-0 truncate text-sm text-muted">{leader.option}</span>
          <span className="tnum text-2xl font-semibold leading-none text-bull">
            {formatPct(leader.probability)}
          </span>
          <MoverChip change={leadingChange} />
        </div>

        {/* Distribution */}
        <div className="mt-3">
          <ProbabilityBar outcomes={outcomes} />
        </div>

        {/* Real LLM analysis */}
        {analysis && (
          <div className="mt-4 space-y-1.5 border-t border-line pt-3">
            <p className="text-[14px] leading-relaxed text-fg">{analysis.insight}</p>
            <p className="text-[13px] leading-relaxed">
              <span className="font-medium text-bull">信号 </span>
              <span className="text-muted">{analysis.signal}</span>
            </p>
            <p className="text-[12px] leading-relaxed text-faint">
              可信度 · {analysis.risk}
            </p>
          </div>
        )}

        {/* Card footer */}
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-faint">
          <span className="tnum">截止 {endDate ? endDate.slice(0, 10) : "—"}</span>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted transition-colors hover:text-bull"
          >
            在 Polymarket 查看原始市场 →
          </a>
        </div>
      </div>
    </article>
  );
}

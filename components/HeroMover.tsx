import type { DailyMarket } from "@/lib/types";
import { liquidityTier } from "@/lib/types";
import { CategoryChip } from "./CategoryChip";
import { BadgeRow } from "./BadgeRow";
import { ProbabilityBar } from "./ProbabilityBar";
import { formatVolume, formatPct, formatMove } from "@/lib/format";

const LIQ_LABEL: Record<string, string> = { high: "高", medium: "中", low: "低" };

/**
 * The day's headline: the single biggest 24h probability swing. Shows the
 * moved outcome's before→after so the change is the hero, not the level.
 */
export function HeroMover({ market }: { market: DailyMarket }) {
  const {
    title,
    category,
    outcomes,
    move24h,
    headlineOption,
    leadingChange,
    volume24hr,
    surge,
    liquidity,
    sourceUrl,
    analysis,
    endDate,
    badges,
  } = market;

  // The outcome that moved most. buildOutcomes guarantees the headline outcome
  // is never folded into "其他", but if (defensively) it's missing, fall back to
  // the leader AND its own change — never pair the leader with another row's move.
  const movedByHeadline = headlineOption
    ? outcomes.find((o) => o.option === headlineOption)
    : undefined;
  const moved = movedByHeadline ?? outcomes[0];
  const change = movedByHeadline ? move24h : leadingChange;
  const after = moved?.probability ?? 0;
  const before = change == null ? null : Math.min(Math.max(after - change, 0), 1);
  const move = formatMove(change);
  const moveColor =
    move.dir === "up" ? "var(--bull)" : move.dir === "down" ? "var(--bear)" : "var(--faint)";
  const liq = liquidityTier(liquidity);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-bull/30 bg-gradient-to-b from-bull-dim to-surface">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-bull">
            <span aria-hidden>⚡</span> 今日最大异动
          </span>
          <CategoryChip category={category} />
        </div>

        <h2 className="mt-3 text-[19px] font-semibold leading-snug text-fg sm:text-[22px]">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-bull"
          >
            {title}
          </a>
        </h2>

        {/* The move IS the headline: outcome + before → after + delta. */}
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="min-w-0 truncate text-sm text-muted">{moved?.option}</span>
          {before != null && (
            <span className="tnum text-base text-faint">
              {formatPct(before)} <span className="text-faint">→</span>
            </span>
          )}
          <span className="tnum text-4xl font-bold leading-none text-bull">
            {formatPct(after)}
          </span>
          <span
            className="tnum text-sm font-semibold"
            style={{ color: moveColor }}
            title="今日最大异动选项过去 24 小时的概率变动"
          >
            {move.text}
          </span>
        </div>

        <BadgeRow badges={badges} className="mt-3" />

        <div className="mt-4">
          <ProbabilityBar outcomes={outcomes} />
        </div>

        {analysis && (
          <div className="mt-4 space-y-1.5 border-t border-line pt-3">
            <p className="text-[15px] leading-relaxed text-fg">{analysis.insight}</p>
            <p className="text-[13px] leading-relaxed">
              <span className="font-medium text-bull">信号 </span>
              <span className="text-muted">{analysis.signal}</span>
            </p>
            <p className="text-[12px] leading-relaxed text-faint">
              可信度 · {analysis.risk}
            </p>
          </div>
        )}

        <div className="tnum mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-faint">
          <span title="24小时成交量">24h {formatVolume(volume24hr)}</span>
          {surge >= 2 && <span title="相对自身近7日日均放量倍数">放量 {surge.toFixed(1)}x</span>}
          <span title="流动性（市场可信度）">流动性 {LIQ_LABEL[liq]}</span>
          <span title="解析截止">截止 {endDate ? endDate.slice(0, 10) : "—"}</span>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-muted transition-colors hover:text-bull"
          >
            在 Polymarket 查看 →
          </a>
        </div>
      </div>
    </article>
  );
}

import Link from "next/link";
import { formatPct } from "@/lib/format";

const GOLD = "#f5b13d";

// Persistent hot-topic banner pinned in the daily edition — links to the
// World Cup special. Shows today's angle headline + the current favorite.
export function WorldCupCard({
  headline,
  leaderTeam,
  leaderProb,
}: {
  headline: string;
  leaderTeam?: string;
  leaderProb?: number;
}) {
  return (
    <Link
      href="/worldcup"
      className="group block rounded-xl border p-4 transition-colors sm:p-5"
      style={{ borderColor: `${GOLD}55`, background: `${GOLD}12` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide" style={{ color: GOLD }}>
          <span aria-hidden>🏆</span> 世界杯专题 · 每日深度
        </span>
        {leaderTeam && leaderProb != null && (
          <span className="tnum text-[12px] text-faint">
            夺冠热门 {leaderTeam} <span style={{ color: GOLD }}>{formatPct(leaderProb)}</span>
          </span>
        )}
      </div>
      <p className="mt-2 text-[15px] font-semibold leading-snug text-fg sm:text-[16px]">
        {headline}
      </p>
      <span className="mt-2 inline-block text-[13px] transition-colors group-hover:underline" style={{ color: GOLD }}>
        进入世界杯专题 →
      </span>
    </Link>
  );
}

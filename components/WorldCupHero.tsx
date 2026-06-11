import Link from "next/link";
import { formatPct } from "@/lib/format";
import { formatCnKickoff } from "@/lib/date";
import { teamZh } from "@/lib/wc-names";
import type { WcFixture } from "@/lib/wc-schedule";

const GOLD = "#f5b13d";

// Tournament-time homepage TOP section (replaces the small WorldCupCard while
// matches are running): today's fixtures with live 1X2 odds, last night's
// market-settled results, the championship board, and the day's deep-dive
// headline — all linking into /worldcup.
export type WcHeroData = {
  headline: string;
  phaseLabel: string;
  top: { team: string; prob: number }[]; // championship favorites (top 5)
  upcoming: WcFixture[]; // ≤4, soonest first
  live: WcFixture[];
  finished: WcFixture[]; // ≤3, latest first
  focusSlug: string | null; // highlight the day's focus fixture
};

function OddsPair({ f }: { f: WcFixture }) {
  // The DRAW counts toward the lead too — in tight group games it can be the
  // market's favorite outcome, and then it must carry the emphasis.
  const lead = Math.max(f.probA, f.probB, f.probDraw);
  const cls = (p: number) => (p === lead ? "font-semibold text-fg" : "text-muted");
  return (
    <span className="tnum text-[13px]">
      <span className={cls(f.probA)}>
        {teamZh(f.teamA)} {formatPct(f.probA)}
      </span>
      <span className="mx-1.5 text-faint">vs</span>
      <span className={cls(f.probB)}>
        {teamZh(f.teamB)} {formatPct(f.probB)}
      </span>
      <span className={`ml-1.5 text-[12px] ${cls(f.probDraw)}`}>平局 {formatPct(f.probDraw)}</span>
    </span>
  );
}

function ResultLine({ f }: { f: WcFixture }) {
  const who =
    f.result === "draw"
      ? "战平"
      : f.result === "A"
        ? `${teamZh(f.teamA)} 胜`
        : f.result === "B"
          ? `${teamZh(f.teamB)} 胜`
          : "已结束";
  return (
    <li className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-muted">
        {teamZh(f.teamA)} vs {teamZh(f.teamB)}
        {f.group ? <span className="ml-1 text-[11px] text-faint">{f.group}组</span> : null}
      </span>
      <span className="tnum shrink-0 font-medium text-fg">
        {who}
        {f.score ? <span className="ml-1.5" style={{ color: GOLD }}>{f.score}</span> : null}
      </span>
    </li>
  );
}

export function WorldCupHero({ data }: { data: WcHeroData }) {
  const { headline, phaseLabel, top, upcoming, live, finished, focusSlug } = data;
  return (
    <section
      className="mt-6 rounded-xl border p-4 sm:p-5"
      style={{ borderColor: `${GOLD}55`, background: `${GOLD}0d` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide"
          style={{ color: GOLD }}
        >
          <span aria-hidden>🏆</span> 世界杯 2026 · {phaseLabel}
        </span>
        <Link
          href="/worldcup"
          className="-my-2 py-2 text-[12px] transition-colors hover:underline"
          style={{ color: GOLD }}
        >
          进入专题 →
        </Link>
      </div>

      <Link href="/worldcup" className="group block">
        <h2 className="mt-2 text-[17px] font-bold leading-snug text-fg group-hover:underline sm:text-[19px]">
          {headline}
        </h2>
      </Link>

      {(live.length > 0 || upcoming.length > 0) && (
        <div className="mt-4">
          <p className="text-[12px] font-medium tracking-wide text-muted">
            {live.length > 0
              ? upcoming.length > 0
                ? "比赛进行中 · 即将开打"
                : "比赛进行中"
              : "今夜至明晨赛程（北京时间）"}
          </p>
          <ul className="mt-2 space-y-2">
            {live.map((f) => (
              <li
                key={f.slug}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="tnum shrink-0 text-[12px] font-semibold" style={{ color: GOLD }}>
                  ● 进行中
                  {f.slug === focusSlug ? <span className="ml-1.5">焦点</span> : null}
                </span>
                <span className="min-w-0 text-left sm:text-right">
                  <OddsPair f={f} />
                </span>
              </li>
            ))}
            {upcoming.slice(0, 4).map((f) => (
              <li
                key={f.slug}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="tnum shrink-0 text-[12px] text-faint">
                  {f.kickoff ? formatCnKickoff(f.kickoff) : "待定"}
                  {f.slug === focusSlug ? (
                    <span className="ml-1.5 font-semibold" style={{ color: GOLD }}>
                      焦点
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 text-left sm:text-right">
                  <OddsPair f={f} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {finished.length > 0 && (
        <div className="mt-4">
          <p className="text-[12px] font-medium tracking-wide text-muted">昨夜赛果 · 据 Polymarket 结算</p>
          <ul className="mt-2 space-y-1.5">
            {finished.slice(0, 3).map((f) => (
              <ResultLine key={f.slug} f={f} />
            ))}
          </ul>
        </div>
      )}

      {top.length > 0 && (
        <p className="tnum mt-4 border-t pt-3 text-[12px] leading-relaxed text-faint" style={{ borderColor: `${GOLD}26` }}>
          <span className="text-muted">夺冠概率</span>{" "}
          {top.slice(0, 5).map((t, i) => (
            <span key={t.team}>
              {i > 0 ? <span className="mx-1 text-faint">·</span> : null}
              {teamZh(t.team)} <span style={{ color: GOLD }}>{formatPct(t.prob)}</span>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

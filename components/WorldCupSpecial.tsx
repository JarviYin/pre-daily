import Link from "next/link";
import type { WcBriefing } from "@/lib/wc-llm";
import { formatCnDate, formatTimestamp } from "@/lib/date";
import { formatPct, formatMove } from "@/lib/format";

const GOLD = "#f5b13d";

const PHASE_LABEL: Record<string, string> = {
  pre: "赛前前瞻",
  group: "小组赛",
  knockout: "淘汰赛",
  final: "决赛",
  after: "已收官",
};

function MoveTag({ change }: { change: number | null }) {
  const { text, dir } = formatMove(change);
  if (dir === "flat") return null;
  const color = dir === "up" ? "var(--bull)" : "var(--bear)";
  return (
    <span className="tnum text-[12px] font-medium" style={{ color }}>
      {text}
    </span>
  );
}

function OddsBar({ prob }: { prob: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(prob * 100, 1)}%`, background: GOLD }}
      />
    </div>
  );
}

export function WorldCupSpecial({
  b,
  editionNumber,
  prevDate,
  nextDate,
}: {
  b: WcBriefing;
  editionNumber?: number;
  prevDate?: string | null;
  nextDate?: string | null;
}) {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      {/* Masthead */}
      <header>
        <Link href="/" className="text-[13px] text-muted transition-colors hover:text-bull">
          ← 预测市场中文早报
        </Link>
        <div className="mt-5 flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🏆</span>
          <h1 className="font-mono text-xl font-bold tracking-[0.15em] sm:text-2xl" style={{ color: GOLD }}>
            WORLD CUP 2026
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">
          世界杯专题 · 每天一个角度，深度解读真金白银怎么押注夺冠
        </p>
        <div className="tnum mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
          <span>{formatCnDate(b.date)}</span>
          {editionNumber ? <span>· 第 {editionNumber} 期</span> : null}
          <span
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{ color: GOLD, backgroundColor: `${GOLD}1f`, border: `1px solid ${GOLD}40` }}
          >
            {PHASE_LABEL[b.phase] ?? b.phase}
          </span>
        </div>
      </header>

      <div className="mt-6 h-px w-full" style={{ background: `${GOLD}33` }} />

      {/* Angle + headline + deep narrative */}
      <section className="mt-6">
        <p className="text-[12px] font-medium tracking-wide" style={{ color: GOLD }}>
          今日角度 · {b.title}
        </p>
        <h2 className="mt-2 text-[22px] font-bold leading-snug text-fg sm:text-[26px]">
          {b.headline}
        </h2>
        <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-fg/90">{b.lede}</p>
      </section>

      {/* Team focus */}
      {b.teamFocus.length > 0 && (
        <section className="mt-8">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
            <span className="inline-block h-3 w-0.5" style={{ background: GOLD }} />
            球队聚焦
          </h3>
          <div className="mt-3 flex flex-col gap-4">
            {b.teamFocus.map((t) => (
              <div key={t.team} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-semibold text-fg">{t.team}</span>
                  <span className="tnum flex items-baseline gap-2">
                    <span className="text-[12px] text-faint">夺冠</span>
                    <span className="text-xl font-bold" style={{ color: GOLD }}>
                      {formatPct(t.prob)}
                    </span>
                    <MoveTag change={t.move24h} />
                  </span>
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{t.narrative}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Odds snapshot (data as support, not the headline) */}
      {b.oddsSnapshot.length > 0 && (
        <section className="mt-8">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
            <span className="inline-block h-3 w-0.5" style={{ background: GOLD }} />
            夺冠概率榜
          </h3>
          <ul className="mt-3 space-y-2">
            {b.oddsSnapshot.slice(0, 10).map((t, i) => (
              <li key={t.team} className="flex items-center gap-3">
                <span className="tnum w-4 text-right text-[12px] text-faint">{i + 1}</span>
                <span className="w-28 shrink-0 truncate text-[13px] text-fg">{t.team}</span>
                <span className="flex-1">
                  <OddsBar prob={t.prob} />
                </span>
                <span className="tnum w-12 text-right text-[13px] font-medium" style={{ color: GOLD }}>
                  {formatPct(t.prob)}
                </span>
                <span className="tnum w-14 text-right">
                  <MoveTag change={t.move24h} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Look ahead */}
      {b.lookAhead && (
        <section className="mt-8 rounded-xl border p-4" style={{ borderColor: `${GOLD}40`, background: `${GOLD}0f` }}>
          <span className="text-[12px] font-medium" style={{ color: GOLD }}>接下来 </span>
          <span className="text-[14px] text-fg/90">{b.lookAhead}</span>
        </section>
      )}

      {/* Archive nav */}
      <nav className="mt-8 flex items-center justify-between text-[13px]">
        {prevDate ? (
          <Link href={`/worldcup/${prevDate}`} className="tnum text-muted transition-colors hover:text-bull">
            ← 前一期
          </Link>
        ) : (
          <span />
        )}
        <Link href="/worldcup/archive" className="text-muted transition-colors hover:text-bull">
          往期专题
        </Link>
        {nextDate ? (
          <Link href={`/worldcup/${nextDate}`} className="tnum text-muted transition-colors hover:text-bull">
            后一期 →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {/* Provenance */}
      <footer className="mt-10 border-t border-line pt-6 text-[12px] leading-relaxed text-faint">
        <p className="tnum">
          本期由 {b.modelId} 基于 Polymarket 真实赔率生成 · 抓取于 {formatTimestamp(b.generatedAt)}
        </p>
        <p className="mt-2 max-w-2xl">
          夺冠概率、24h 变动均来自{" "}
          <a href="https://polymarket.com/event/world-cup-winner" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: GOLD }}>
            Polymarket World Cup Winner 市场
          </a>
          ；球队解读为 AI 基于公开数据与足球常识生成，不构成任何投注建议。
        </p>
      </footer>
    </article>
  );
}

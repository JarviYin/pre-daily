import Link from "next/link";
import type { WcBriefing } from "@/lib/wc-llm";
import type { WcFixture } from "@/lib/wc-schedule";
import { formatCnDate, formatCnKickoff, formatTimestamp } from "@/lib/date";
import { formatPct, formatMove } from "@/lib/format";
import { teamZh } from "@/lib/wc-names";

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
      <span className="inline-block h-3 w-0.5" style={{ background: GOLD }} />
      {children}
    </h3>
  );
}

// One 1X2 odds strip: two teams + draw, leading outcome emphasized.
function FixtureOdds({ f }: { f: WcFixture }) {
  const lead = Math.max(f.probA, f.probB, f.probDraw);
  const cell = (label: string, p: number) => (
    <span className={`tnum ${p === lead ? "font-semibold text-fg" : "text-muted"}`}>
      {label} <span style={p === lead ? { color: GOLD } : undefined}>{formatPct(p)}</span>
    </span>
  );
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
      {cell(`${teamZh(f.teamA)}胜`, f.probA)}
      {cell("平局", f.probDraw)}
      {cell(`${teamZh(f.teamB)}胜`, f.probB)}
    </span>
  );
}

function FixtureRow({ f, focus }: { f: WcFixture; focus?: boolean }) {
  return (
    <li className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-medium text-fg">
          {teamZh(f.teamA)} vs {teamZh(f.teamB)}
          {f.group ? <span className="ml-1.5 text-[11px] text-faint">{f.group}组</span> : null}
          {focus ? (
            <span
              className="ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ color: GOLD, backgroundColor: `${GOLD}1f` }}
            >
              焦点战
            </span>
          ) : null}
        </span>
        <span className="tnum shrink-0 text-[12px] text-faint">
          {f.live ? (
            <span className="font-semibold" style={{ color: GOLD }}>● 进行中</span>
          ) : f.kickoff ? (
            formatCnKickoff(f.kickoff)
          ) : (
            "待定"
          )}
        </span>
      </div>
      <div className="mt-1.5">
        <FixtureOdds f={f} />
      </div>
    </li>
  );
}

function ResultRow({ f }: { f: WcFixture }) {
  const who =
    f.result === "draw"
      ? "战平"
      : f.result === "A"
        ? `${teamZh(f.teamA)} 胜`
        : f.result === "B"
          ? `${teamZh(f.teamB)} 胜`
          : "已结束 · 待结算";
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
      <span className="text-[14px] text-fg">
        {teamZh(f.teamA)} vs {teamZh(f.teamB)}
        {f.group ? <span className="ml-1.5 text-[11px] text-faint">{f.group}组</span> : null}
      </span>
      <span className="tnum shrink-0 text-[14px] font-semibold text-fg">
        {who}
        {f.score ? <span className="ml-2" style={{ color: GOLD }}>{f.score}</span> : null}
      </span>
    </li>
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

      {/* Focus match breakdown (matchdays) */}
      {b.focusMatch && (
        <section className="mt-8">
          <SectionTitle>🎯 焦点战拆解</SectionTitle>
          <div className="mt-3 rounded-xl border p-4 sm:p-5" style={{ borderColor: `${GOLD}40`, background: `${GOLD}0a` }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[17px] font-bold text-fg">
                {teamZh(b.focusMatch.fixture.teamA)} vs {teamZh(b.focusMatch.fixture.teamB)}
                {b.focusMatch.fixture.group ? (
                  <span className="ml-2 text-[12px] font-normal text-faint">{b.focusMatch.fixture.group}组</span>
                ) : null}
              </span>
              <span className="tnum shrink-0 text-[12px] text-faint">
                {b.focusMatch.fixture.live
                  ? "进行中"
                  : b.focusMatch.fixture.kickoff
                    ? `北京时间 ${formatCnKickoff(b.focusMatch.fixture.kickoff)}`
                    : null}
              </span>
            </div>
            <div className="mt-2">
              <FixtureOdds f={b.focusMatch.fixture} />
            </div>
            {b.focusMatch.analysis && (
              <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-fg/90">
                {b.focusMatch.analysis}
              </p>
            )}
            {b.focusMatch.props.length > 0 && (
              <ul className="mt-3 space-y-1 border-t pt-3 text-[12px] text-faint" style={{ borderColor: `${GOLD}26` }}>
                {b.focusMatch.props.slice(0, 4).map((p) => (
                  <li key={p.label} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{p.label}</span>
                    <span className="tnum shrink-0" style={{ color: GOLD }}>
                      {formatPct(p.prob)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Schedule: settled results + live + upcoming */}
      {b.schedule &&
        (b.schedule.finished.length > 0 || b.schedule.live.length > 0 || b.schedule.upcoming.length > 0) && (
          <section className="mt-8">
            <SectionTitle>📅 赛程与赛果</SectionTitle>
            {b.schedule.finished.length > 0 && (
              <>
                <p className="mt-3 text-[12px] text-faint">已结束 · 据 Polymarket 结算</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {b.schedule.finished.map((f) => (
                    <ResultRow key={f.slug} f={f} />
                  ))}
                </ul>
              </>
            )}
            {(b.schedule.live.length > 0 || b.schedule.upcoming.length > 0) && (
              <>
                <p className="mt-4 text-[12px] text-faint">即将开打 · 实时胜负概率</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {b.schedule.live.map((f) => (
                    <FixtureRow key={f.slug} f={f} focus={f.slug === b.focusMatch?.fixture.slug} />
                  ))}
                  {b.schedule.upcoming.map((f) => (
                    <FixtureRow key={f.slug} f={f} focus={f.slug === b.focusMatch?.fixture.slug} />
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

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
                  <span className="text-[16px] font-semibold text-fg">{teamZh(t.team)}</span>
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

      {/* Group qualification picture (group stage) */}
      {b.groups && b.groups.length > 0 && (
        <section className="mt-8">
          <SectionTitle>🧩 小组出线格局 · 头名盘定价</SectionTitle>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {b.groups.map((g) => (
              <div key={g.group} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: GOLD }}>
                    {g.group} 组
                  </span>
                  {g.teams[0] && (
                    <span className="tnum text-[13px] text-fg">
                      {teamZh(g.teams[0].team)}{" "}
                      <span className="font-semibold" style={{ color: GOLD }}>
                        {formatPct(g.teams[0].winGroupProb)}
                      </span>
                    </span>
                  )}
                </div>
                {g.teams.length > 1 && (
                  <p className="tnum mt-1 truncate text-[12px] text-faint">
                    {g.teams.slice(1, 4).map((t) => `${teamZh(t.team)} ${formatPct(t.winGroupProb)}`).join(" · ")}
                  </p>
                )}
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
                <span className="w-28 shrink-0 truncate text-[13px] text-fg">{teamZh(t.team)}</span>
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

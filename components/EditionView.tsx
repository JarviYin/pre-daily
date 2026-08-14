import Link from "next/link";
import type { DailyIssue, DailyMarket } from "@/lib/types";
import { Masthead } from "./Masthead";
import { DailySummary } from "./DailySummary";
import { NarrativeBlock } from "./NarrativeBlock";
import { RecapBlock } from "./RecapBlock";
import { InvestmentBrief } from "./InvestmentBrief";
import { MacroView } from "./MacroView";
import { CatalystCalendar } from "./CatalystCalendar";
import { HeroMover } from "./HeroMover";
import { MarketCard } from "./MarketCard";
import { Expandable } from "./Expandable";
import { Footer } from "./Footer";
import { JsonLd } from "./JsonLd";
import { graph, newsArticleNode, breadcrumbNode } from "@/lib/seo";
import { WorldCupCard } from "./WorldCupCard";
import { WorldCupHero, type WcHeroData } from "./WorldCupHero";

export type WcCardData = { headline: string; leaderTeam?: string; leaderProb?: number };

// 热度榜默认只展开前 N 张卡，其余折叠——刊首保持"论点线"紧凑。
const HEAT_PREVIEW = 3;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
      <span className="inline-block h-3 w-0.5 bg-bull" />
      {children}
    </h2>
  );
}

function DateNav({
  prevDate,
  nextDate,
}: {
  prevDate?: string | null;
  nextDate?: string | null;
}) {
  return (
    <nav className="mt-6 flex items-center justify-between text-[13px]">
      {prevDate ? (
        <Link
          href={`/daily/${prevDate}`}
          className="tnum text-muted transition-colors hover:text-bull"
        >
          ← 前一刊
        </Link>
      ) : (
        <span />
      )}
      <Link href="/archive" className="text-muted transition-colors hover:text-bull">
        往期归档
      </Link>
      {nextDate ? (
        <Link
          href={`/daily/${nextDate}`}
          className="tnum text-muted transition-colors hover:text-bull"
        >
          后一刊 →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function EditionView({
  issue,
  prevDate,
  nextDate,
  editionNumber,
  wcCard,
  wcHero,
}: {
  issue: DailyIssue;
  prevDate?: string | null;
  nextDate?: string | null;
  editionNumber?: number;
  wcCard?: WcCardData | null;
  /** Tournament-time homepage top section; takes precedence over wcCard. */
  wcHero?: WcHeroData | null;
}) {
  const hero = issue.markets.find((m) => m.role === "hero") ?? null;
  // Every v2.1 edition has a hero (the pipeline guarantees one). So NO hero ⇒
  // a pre-v2.1 edition (its rows got role='heat' by migration default) or a
  // degenerate one — render those as a single neutral list, not "今日热度榜".
  const heatList = hero ? issue.markets.filter((m) => m.role === "heat") : [];
  const anchors = hero ? issue.markets.filter((m) => m.role === "anchor") : [];
  const legacy: DailyMarket[] = hero ? [] : issue.markets;
  const maxHeat = Math.max(
    ...[...heatList, ...anchors, ...legacy].map((m) => m.heatScore),
    0.0001
  );

  // 论点线信息架构：连续性(复盘) → 论点(论点线) → 证据(Hero) → 热度榜(折叠)
  // → 视角(投资/宏观) → 时间(催化剂) → 附录(锚点)。narrative 缺失时回退
  // 传统 summary 卡（旧刊/模型降级），其余板块不受影响。
  const heatCards = (ms: DailyMarket[], startLabel: number) =>
    ms.map((m, i) => (
      <MarketCard key={m.marketId} market={m} rankLabel={startLabel + i} maxHeat={maxHeat} />
    ));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <JsonLd data={graph(newsArticleNode(issue), breadcrumbNode(issue.date))} />
      <Masthead
        date={issue.date}
        generatedAt={issue.generatedAt}
        editionNumber={editionNumber}
      />
      {wcHero && <WorldCupHero data={wcHero} />}
      <DateNav prevDate={prevDate} nextDate={nextDate} />

      {/* 连续性：昨日判断复盘（best-effort，可能缺失） */}
      {issue.recap && <RecapBlock recap={issue.recap} />}

      {/* 论点线：今日论点 + 论据 + 反方 + 明日观察（替代 summary 卡） */}
      {issue.narrative ? (
        <NarrativeBlock narrative={issue.narrative} />
      ) : (
        <DailySummary summary={issue.summary} />
      )}

      {/* 证据一：今日最大异动完整卡 */}
      {hero && (
        <section className="mt-8">
          <HeroMover market={hero} />
        </section>
      )}

      {/* 证据二：热度榜（默认展开前 3，其余折叠） */}
      {heatList.length > 0 && (
        <section className="mt-8">
          <SectionHeading>🔥 今日热度榜</SectionHeading>
          <div className="mt-3">
            {heatList.length > HEAT_PREVIEW ? (
              <Expandable
                preview={
                  <div className="flex flex-col gap-4">
                    {heatCards(heatList.slice(0, HEAT_PREVIEW), 1)}
                  </div>
                }
                expanded={
                  <div className="mt-4 flex flex-col gap-4">
                    {heatCards(heatList.slice(HEAT_PREVIEW), HEAT_PREVIEW + 1)}
                  </div>
                }
                label={`其余 ${heatList.length - HEAT_PREVIEW} 个市场`}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {heatCards(heatList, 1)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 视角：资金信号 + 资产联动（若编辑产出） */}
      {issue.briefing && <InvestmentBrief briefing={issue.briefing} />}

      {/* 视角：宏观（外部行情 + 日历 + 宏观解读） */}
      {issue.macro && <MacroView macro={issue.macro} />}

      {/* 时间：临近揭晓的催化剂日历（纯数据派生） */}
      <CatalystCalendar markets={issue.markets} />

      {/* 附录：常青锚点（背景参照） */}
      {anchors.length > 0 && (
        <section className="mt-8">
          <SectionHeading>🐋 持续高热 · 背景参照</SectionHeading>
          <div className="mt-3 flex flex-col gap-4">
            {anchors.map((m, i) => (
              <MarketCard
                key={m.marketId}
                market={m}
                rankLabel={heatList.length + i + 1}
                maxHeat={maxHeat}
              />
            ))}
          </div>
        </section>
      )}

      {legacy.length > 0 && (
        <section className="mt-8">
          <SectionHeading>市场解读</SectionHeading>
          <div className="mt-3 flex flex-col gap-4">
            {legacy.map((m, i) => (
              <MarketCard key={m.marketId} market={m} rankLabel={i + 1} maxHeat={maxHeat} />
            ))}
          </div>
        </section>
      )}

      {!wcHero && wcCard && (
        <section className="mt-6">
          <WorldCupCard
            headline={wcCard.headline}
            leaderTeam={wcCard.leaderTeam}
            leaderProb={wcCard.leaderProb}
          />
        </section>
      )}

      <Footer
        modelId={issue.modelId}
        summaryModelId={issue.summaryModelId}
        generatedAt={issue.generatedAt}
      />
    </div>
  );
}

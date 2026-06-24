import Link from "next/link";
import type { DailyIssue, DailyMarket } from "@/lib/types";
import { Masthead } from "./Masthead";
import { DailySummary } from "./DailySummary";
import { InvestmentBrief } from "./InvestmentBrief";
import { CatalystCalendar } from "./CatalystCalendar";
import { HeroMover } from "./HeroMover";
import { MarketCard } from "./MarketCard";
import { Footer } from "./Footer";
import { JsonLd } from "./JsonLd";
import { graph, newsArticleNode, breadcrumbNode } from "@/lib/seo";
import { WorldCupCard } from "./WorldCupCard";
import { WorldCupHero, type WcHeroData } from "./WorldCupHero";

export type WcCardData = { headline: string; leaderTeam?: string; leaderProb?: number };

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
      <DailySummary summary={issue.summary} />

      {issue.briefing && <InvestmentBrief briefing={issue.briefing} />}
      <CatalystCalendar markets={issue.markets} />

      {!wcHero && wcCard && (
        <section className="mt-6">
          <WorldCupCard
            headline={wcCard.headline}
            leaderTeam={wcCard.leaderTeam}
            leaderProb={wcCard.leaderProb}
          />
        </section>
      )}

      {hero && (
        <section className="mt-8">
          <HeroMover market={hero} />
        </section>
      )}

      {heatList.length > 0 && (
        <section className="mt-8">
          <SectionHeading>🔥 今日热度榜</SectionHeading>
          <div className="mt-3 flex flex-col gap-4">
            {heatList.map((m, i) => (
              <MarketCard key={m.marketId} market={m} rankLabel={i + 1} maxHeat={maxHeat} />
            ))}
          </div>
        </section>
      )}

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

      <Footer
        modelId={issue.modelId}
        summaryModelId={issue.summaryModelId}
        generatedAt={issue.generatedAt}
      />
    </div>
  );
}

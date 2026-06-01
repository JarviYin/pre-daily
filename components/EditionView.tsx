import Link from "next/link";
import type { DailyIssue } from "@/lib/types";
import { Masthead } from "./Masthead";
import { DailySummary } from "./DailySummary";
import { MarketCard } from "./MarketCard";
import { Footer } from "./Footer";

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
}: {
  issue: DailyIssue;
  prevDate?: string | null;
  nextDate?: string | null;
  editionNumber?: number;
}) {
  const maxVolume24hr = Math.max(...issue.markets.map((m) => m.volume24hr), 0);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <Masthead
        date={issue.date}
        generatedAt={issue.generatedAt}
        editionNumber={editionNumber}
      />
      <DateNav prevDate={prevDate} nextDate={nextDate} />
      <DailySummary summary={issue.summary} />

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
          <span className="inline-block h-3 w-0.5 bg-bull" />
          交易量排名前 {issue.markets.length} 市场
        </h2>
        <div className="mt-3 flex flex-col gap-4">
          {issue.markets.map((m) => (
            <MarketCard key={m.marketId} market={m} maxVolume24hr={maxVolume24hr} />
          ))}
        </div>
      </section>

      <Footer
        modelId={issue.modelId}
        summaryModelId={issue.summaryModelId}
        generatedAt={issue.generatedAt}
      />
    </div>
  );
}

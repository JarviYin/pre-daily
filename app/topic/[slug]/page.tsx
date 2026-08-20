import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeoTopic, getTopicMarketRows } from "@/lib/db/seo-queries";
import { formatCnDate } from "@/lib/date";
import { formatPct, formatMove } from "@/lib/format";
import { CategoryChip } from "@/components/CategoryChip";

// 主题聚合页：SEO 长尾词落地页。ISR 5 分钟 + cron 每日 push-revalidate。

export const revalidate = 300;
export const dynamicParams = true;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  let topic: Awaited<ReturnType<typeof getSeoTopic>> = null;
  try {
    topic = await getSeoTopic(slug);
  } catch {
    /* DB unavailable */
  }
  if (!topic) return { title: "主题未找到", robots: { index: false } };
  return {
    title: topic.metaTitle,
    description: topic.metaDescription,
    alternates: { canonical: `/topic/${slug}` },
    openGraph: { title: topic.metaTitle, description: topic.metaDescription, type: "article" },
  };
}

export default async function TopicPage({ params }: Params) {
  const { slug } = await params;
  const topic = await getSeoTopic(slug).catch(() => null);
  if (!topic) notFound();

  const markets = await getTopicMarketRows(topic.marketSlugs).catch(() => []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6">
      <header className="pt-10 sm:pt-14">
        <Link href="/" className="block text-center">
          <h2 className="font-mono text-lg font-bold tracking-[0.2em] text-fg sm:text-xl">
            PREDICTION<span className="text-bull"> · </span>DAILY
          </h2>
        </Link>
        <h1 className="mt-6 text-center text-[22px] font-bold leading-snug text-fg sm:text-[26px]">
          {topic.h1}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          {topic.intro}
        </p>
        <p className="tnum mt-3 text-center text-[12px] text-faint">
          数据来自 Polymarket 公开市场 · 每日 8:00 更新 · 最近更新 {topic.lastUpdated}
        </p>
        <div className="masthead-rule mt-6 h-px w-full" />
      </header>

      <section className="mt-8">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
          <span className="inline-block h-3 w-0.5 bg-bull" />
          追踪的市场（{markets.length}）
        </h3>
        {markets.length === 0 ? (
          <p className="mt-3 rounded-lg border border-line bg-surface p-4 text-[13px] text-muted">
            该主题暂无历史市场记录，将在后续刊期出现相关市场时自动累积。
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {markets.map((m) => {
              const move = formatMove(m.move24h);
              return (
                <li
                  key={m.slug}
                  className="rounded-xl border border-line bg-surface p-4 sm:p-5"
                >
                  <div className="flex items-center gap-2.5">
                    <CategoryChip category={m.category} />
                    <Link
                      href={`/daily/${m.issueDate}`}
                      className="tnum text-[12px] text-faint transition-colors hover:text-bull"
                    >
                      {formatCnDate(m.issueDate)} 刊
                    </Link>
                  </div>
                  <h4 className="mt-2 text-[15px] font-semibold leading-snug text-fg">
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-bull"
                    >
                      {m.title}
                    </a>
                  </h4>
                  <div className="tnum mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] text-faint">
                    {m.leadProb != null && (
                      <span className="text-base font-semibold text-bull">
                        领先项 {formatPct(m.leadProb)}
                      </span>
                    )}
                    <span
                      className={
                        move.dir === "up"
                          ? "text-bull"
                          : move.dir === "down"
                            ? "text-bear"
                            : ""
                      }
                    >
                      {move.text}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-10 rounded-lg border border-line bg-surface p-4 text-[12px] leading-relaxed text-faint">
        <p>
          本页为信息聚合：所有概率来自 Polymarket 公开市场数据，每日自动更新。
          历史记录为该市场最近一次出现在 Prediction Daily 刊期时的快照。以上为信息解读，不构成投资建议。
        </p>
        <div className="mt-3 flex gap-4">
          <Link href="/" className="text-muted transition-colors hover:text-bull">
            ← 今日早报
          </Link>
          <Link href="/topic" className="text-muted transition-colors hover:text-bull">
            全部主题 →
          </Link>
          <Link href="/archive" className="text-muted transition-colors hover:text-bull">
            往期归档 →
          </Link>
        </div>
      </div>
    </div>
  );
}

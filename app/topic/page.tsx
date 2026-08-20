import type { Metadata } from "next";
import Link from "next/link";
import { listAllSeoTopicSlugs } from "@/lib/db/seo-queries";
import { EmptyState } from "@/components/EmptyState";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "预测市场主题跟踪 - Prediction Daily",
  description:
    "按主题聚合的预测市场概率跟踪页：美联储利率、AI 大事、美国选举、地缘政治、加密市场等，每日更新。",
  alternates: { canonical: "/topic" },
};

export default async function TopicIndexPage() {
  let topics: Awaited<ReturnType<typeof listAllSeoTopicSlugs>> = [];
  try {
    topics = await listAllSeoTopicSlugs();
  } catch (err) {
    console.error("[topic] failed to load topics:", err);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6">
      <header className="pt-10 sm:pt-14">
        <Link href="/" className="block text-center">
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-fg sm:text-2xl">
            PREDICTION<span className="text-bull"> · </span>DAILY
          </h1>
        </Link>
        <p className="mt-3 text-center text-[15px] text-muted">预测市场主题跟踪</p>
        <p className="mt-1.5 text-center text-[13px] text-faint">
          按主题聚合的预测市场概率历史与最新动态，每日 8:00 更新
        </p>
        <div className="masthead-rule mt-6 h-px w-full" />
      </header>

      {topics.length === 0 ? (
        <EmptyState title="暂无主题页" message="每日 SEO 循环首次运行后，主题聚合页会在这里生成。" />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {topics.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/topic/${t.slug}`}
                className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-bull/40 sm:p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[16px] font-semibold text-fg">{t.h1}</h2>
                  <span className="tnum shrink-0 text-[12px] text-faint">
                    {t.marketSlugs.length} 个市场 · 更新于 {t.lastUpdated}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
                  {t.intro}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-bull">
          ← 返回今日早报
        </Link>
      </div>
    </div>
  );
}

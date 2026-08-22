import type { Metadata } from "next";
import Link from "next/link";
import { NewsView } from "@/components/NewsView";
import { getLatestIssue } from "@/lib/db/queries";
import { formatTimestamp } from "@/lib/date";

export const revalidate = 300;

export const dynamicParams = true;

// 新闻版首页：最新一期的新闻要闻（历史各期在 /news/[date]）。
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "预测市场新闻版 · 全球大事要闻 - Prediction Daily",
    description:
      "把 Polymarket 真金白银的定价改写成每日全球大事要闻：今日头条 + 要闻，概率、异动与流动性一并提供。每日 8:00 更新。",
    alternates: { canonical: "/news" },
    openGraph: {
      title: "预测市场新闻版 · 全球大事要闻",
      description: "用真金白银的定价改写今日世界要闻，每日 8:00 更新。",
      type: "article",
    },
  };
}

export default async function NewsIndexPage() {
  let news = null;
  let latestDate = null;
  try {
    const issue = await getLatestIssue();
    news = issue?.news ?? null;
    latestDate = issue?.date ?? null;
  } catch (err) {
    console.error("[news] failed to load latest issue:", err);
  }

  if (!news) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-16 text-center sm:px-6">
        <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-fg">
          PREDICTION<span className="text-bull"> · </span>DAILY
        </h1>
        <p className="mt-6 text-[15px] text-muted">今日新闻版尚未生成。</p>
        <p className="mt-2 text-[13px] text-faint">
          新闻版随每日早报 8:00 自动生成；如刚过发布时间，请稍后刷新。
        </p>
        <div className="mt-8 flex justify-center gap-4 text-[13px]">
          <Link href="/" className="text-muted transition-colors hover:text-bull">
            ← 今日早报
          </Link>
          {latestDate && (
            <Link href={`/news/${latestDate}`} className="text-muted transition-colors hover:text-bull">
              最近一期 →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <NewsView
        date={news.date}
        items={news.items}
        generatedAt={formatTimestamp(news.generatedAt)}
      />
      {news.date !== latestDate && (
        <div className="mx-auto -mt-10 w-full max-w-2xl px-4 pb-12 text-center text-[13px] text-faint sm:px-6">
          该期新闻版之后尚无更新（最新刊 {latestDate}）
        </div>
      )}
    </>
  );
}

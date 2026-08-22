import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { NewsView } from "@/components/NewsView";
import { getIssue, listNewsDates } from "@/lib/db/queries";
import { formatCnDate, formatTimestamp, isValidDate } from "@/lib/date";

export const revalidate = 300;
export const dynamicParams = true;

type Params = { params: Promise<{ date: string }> };

// 历史新闻版（/news/[date]），与信号版 /daily/[date] 平行的第二编辑角度。
export async function generateStaticParams() {
  try {
    const dates = await listNewsDates();
    return dates.slice(0, 30).map((date) => ({ date }));
  } catch (err) {
    console.warn("[news/[date]] generateStaticParams: DB unavailable:", err);
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) return {};
  try {
    const issue = await getIssue(date);
    const lead = issue?.news?.items[0];
    if (!issue?.news || !lead) return {};
    const title = `${formatCnDate(date)} 新闻版 · ${lead.title.slice(0, 30)}`;
    const desc = lead.story.slice(0, 110);
    return {
      title,
      description: desc,
      alternates: { canonical: `/news/${date}` },
      openGraph: { title, description: desc, type: "article" },
      twitter: { title, description: desc },
    };
  } catch {
    return {};
  }
}

export default async function NewsDatePage({ params }: Params) {
  const { date } = await params;
  if (!isValidDate(date)) notFound();

  const issue = await getIssue(date);
  if (!issue?.news) notFound();

  const news = issue.news;
  let prevDate: string | null = null;
  let nextDate: string | null = null;
  try {
    const dates = await listNewsDates();
    const idx = dates.indexOf(date);
    nextDate = idx > 0 ? dates[idx - 1] : null;
    prevDate = idx >= 0 ? dates[idx + 1] ?? null : null;
  } catch {
    /* nav degrades */
  }

  return (
    <>
      <NewsView
        date={news.date}
        items={news.items}
        generatedAt={formatTimestamp(news.generatedAt)}
      />
      <div className="mx-auto -mt-6 w-full max-w-2xl px-4 pb-12 text-center text-[13px] sm:px-6">
        <div className="flex items-center justify-center gap-4">
          {prevDate && (
            <Link href={`/news/${prevDate}`} className="text-muted transition-colors hover:text-bull">
              ← 前一期
            </Link>
          )}
          <Link href="/news" className="text-muted transition-colors hover:text-bull">
            最新新闻版
          </Link>
          {nextDate && (
            <Link href={`/news/${nextDate}`} className="text-muted transition-colors hover:text-bull">
              后一期 →
            </Link>
          )}
        </div>
        <p className="mt-3 text-faint">
          信号版视角（面向交易者）→{" "}
          <Link href={`/daily/${date}`} className="text-muted transition-colors hover:text-bull">
            {formatCnDate(date)} 早报
          </Link>
        </p>
      </div>
    </>
  );
}

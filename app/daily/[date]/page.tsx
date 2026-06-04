import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditionView } from "@/components/EditionView";
import { getIssue, listIssueDates } from "@/lib/db/queries";
import { formatCnDate, isValidDate } from "@/lib/date";
import { getWcCard } from "@/lib/wc-card";

export const revalidate = 300;
export const dynamicParams = true;

type Params = { params: Promise<{ date: string }> };

// Pre-render recent editions; new dates render on-demand (ISR).
export async function generateStaticParams() {
  try {
    const dates = await listIssueDates();
    return dates.slice(0, 30).map((date) => ({ date }));
  } catch (err) {
    console.warn("[daily/[date]] generateStaticParams: DB unavailable, rendering on-demand:", err);
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) return {};
  try {
    const issue = await getIssue(date);
    if (!issue) return {};
    const title = `${formatCnDate(date)} 预测市场中文早报`;
    const desc = issue.summary.slice(0, 110);
    return {
      title,
      description: desc,
      alternates: { canonical: `/daily/${date}` },
      openGraph: { title, description: desc, type: "article" },
      twitter: { title, description: desc },
    };
  } catch {
    return {};
  }
}

export default async function DailyPage({ params }: Params) {
  const { date } = await params;
  if (!isValidDate(date)) notFound();

  const issue = await getIssue(date);
  if (!issue) notFound();

  const dates = await listIssueDates();
  const idx = dates.indexOf(date);
  // dates are newest-first: next (newer) is idx-1, prev (older) is idx+1.
  const nextDate = idx > 0 ? dates[idx - 1] : null;
  const prevDate = idx >= 0 ? dates[idx + 1] ?? null : null;
  // Edition ordinal counts from the oldest issue (第1刊).
  const editionNumber = idx >= 0 ? dates.length - idx : undefined;

  return (
    <EditionView
      issue={issue}
      prevDate={prevDate}
      nextDate={nextDate}
      editionNumber={editionNumber}
      wcCard={await getWcCard()}
    />
  );
}

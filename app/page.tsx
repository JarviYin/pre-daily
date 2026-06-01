import type { Metadata } from "next";
import { EditionView } from "@/components/EditionView";
import { EmptyState } from "@/components/EmptyState";
import { getLatestIssue, listIssueDates } from "@/lib/db/queries";
import { formatCnDate } from "@/lib/date";

// ISR: re-render at most every 5 min; cron also push-revalidates on publish.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const dates = await listIssueDates();
    const date = dates[0];
    if (!date) return {};
    return {
      // Canonicalise the homepage to the dated permalink to avoid duplicates.
      alternates: { canonical: `/daily/${date}` },
      title: `${formatCnDate(date)} · 预测市场中文早报`,
    };
  } catch {
    return {};
  }
}

export default async function Home() {
  let issue = null;
  let prevDate: string | null = null;
  let editionNumber: number | undefined;
  try {
    issue = await getLatestIssue();
    if (issue) {
      const dates = await listIssueDates();
      const idx = dates.indexOf(issue.date);
      prevDate = idx >= 0 ? dates[idx + 1] ?? null : null;
      editionNumber = idx >= 0 ? dates.length - idx : undefined;
    }
  } catch (err) {
    console.error("[home] failed to load latest issue:", err);
  }

  if (!issue) return <EmptyState />;
  return (
    <EditionView issue={issue} prevDate={prevDate} nextDate={null} editionNumber={editionNumber} />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorldCupSpecial } from "@/components/WorldCupSpecial";
import { getWcBriefing, listWcBriefingDates } from "@/lib/db/queries";
import { formatCnDate, isValidDate } from "@/lib/date";

export const revalidate = 300;
export const dynamicParams = true;

type Params = { params: Promise<{ date: string }> };

export async function generateStaticParams() {
  try {
    const dates = await listWcBriefingDates();
    return dates.slice(0, 40).map((date) => ({ date }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) return {};
  try {
    const b = await getWcBriefing(date);
    if (!b) return {};
    const title = `${formatCnDate(date)} 世界杯专题 · ${b.headline}`;
    return {
      title,
      description: b.lede.slice(0, 120),
      alternates: { canonical: `/worldcup/${date}` },
      openGraph: { title, description: b.lede.slice(0, 120), type: "article" },
    };
  } catch {
    return {};
  }
}

export default async function WorldCupDatePage({ params }: Params) {
  const { date } = await params;
  if (!isValidDate(date)) notFound();
  const b = await getWcBriefing(date);
  if (!b) notFound();

  const dates = await listWcBriefingDates();
  const idx = dates.indexOf(date);
  // dates are newest-first: next (newer) is idx-1, prev (older) is idx+1.
  const nextDate = idx > 0 ? dates[idx - 1] : null;
  const prevDate = idx >= 0 ? dates[idx + 1] ?? null : null;
  const editionNumber = idx >= 0 ? dates.length - idx : undefined;

  return (
    <WorldCupSpecial b={b} editionNumber={editionNumber} prevDate={prevDate} nextDate={nextDate} />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { WorldCupSpecial } from "@/components/WorldCupSpecial";
import { getLatestWcBriefing, listWcBriefingDates } from "@/lib/db/queries";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const b = await getLatestWcBriefing();
    if (!b) return { title: "世界杯专题", alternates: { canonical: "/worldcup" } };
    const title = `世界杯专题 · ${b.headline}`;
    return {
      title,
      description: b.lede.slice(0, 120),
      alternates: { canonical: "/worldcup" },
      openGraph: { title, description: b.lede.slice(0, 120), type: "article", url: "/worldcup" },
    };
  } catch {
    return { title: "世界杯专题", alternates: { canonical: "/worldcup" } };
  }
}

function Placeholder() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <div className="text-4xl" aria-hidden>🏆</div>
      <h1 className="mt-4 text-2xl font-bold" style={{ color: "#f5b13d" }}>
        世界杯专题即将上线
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        每天 8:00 一期，基于 Polymarket 真实赔率的世界杯深度解读。第一期生成后即可在此查看。
      </p>
      <Link href="/" className="mt-6 inline-block text-[14px] text-muted transition-colors hover:text-bull">
        ← 返回预测市场中文早报
      </Link>
    </div>
  );
}

export default async function WorldCupPage() {
  let b = null;
  let dates: string[] = [];
  try {
    b = await getLatestWcBriefing();
    dates = await listWcBriefingDates();
  } catch {
    /* DB unavailable */
  }
  if (!b) return <Placeholder />;
  const idx = dates.indexOf(b.date);
  const editionNumber = idx >= 0 ? dates.length - idx : undefined;
  const prevDate = idx >= 0 ? dates[idx + 1] ?? null : null;
  return <WorldCupSpecial b={b} editionNumber={editionNumber} prevDate={prevDate} nextDate={null} />;
}

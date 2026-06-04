import type { Metadata } from "next";
import Link from "next/link";
import { listWcBriefingHeads } from "@/lib/db/queries";
import { formatCnDate } from "@/lib/date";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "世界杯专题 · 往期",
  description: "世界杯专题每日深度解读的往期存档。",
  alternates: { canonical: "/worldcup/archive" },
};

const GOLD = "#f5b13d";

export default async function WorldCupArchivePage() {
  let heads: { date: string; title: string; headline: string }[] = [];
  try {
    heads = await listWcBriefingHeads();
  } catch {
    /* DB unavailable */
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/worldcup" className="text-[13px] text-muted transition-colors hover:text-bull">
        ← 世界杯专题
      </Link>
      <h1 className="mt-5 flex items-center gap-2 text-2xl font-bold">
        <span aria-hidden>🏆</span>
        <span style={{ color: GOLD }}>往期专题</span>
      </h1>
      {heads.length === 0 ? (
        <p className="mt-6 text-[15px] text-muted">暂无往期内容。</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {heads.map((h) => (
            <li key={h.date}>
              <Link
                href={`/worldcup/${h.date}`}
                className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line/80"
              >
                <span className="tnum text-[12px] text-faint">{formatCnDate(h.date)}</span>
                <p className="mt-1 text-[15px] font-semibold text-fg">{h.headline}</p>
                <p className="mt-0.5 text-[13px] text-muted">{h.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

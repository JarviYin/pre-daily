import type { Metadata } from "next";
import Link from "next/link";
import { listIssueHeads } from "@/lib/db/queries";
import { formatCnDate } from "@/lib/date";
import { EmptyState } from "@/components/EmptyState";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "往期归档",
  description: "《预测市场中文早报》历史刊期归档。",
};

export default async function ArchivePage() {
  let heads: { date: string; summary: string }[] = [];
  try {
    heads = await listIssueHeads();
  } catch (err) {
    console.error("[archive] failed to load:", err);
  }

  if (heads.length === 0) {
    return (
      <EmptyState title="暂无往期" message="首刊发布后，所有历史刊期会在这里归档。" />
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6">
      <header className="pt-10 sm:pt-14">
        <Link href="/" className="block text-center">
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-fg sm:text-2xl">
            PREDICTION<span className="text-bull"> · </span>DAILY
          </h1>
        </Link>
        <p className="mt-3 text-center text-sm text-muted">往期归档</p>
        <div className="masthead-rule mt-6 h-px w-full" />
      </header>

      <ul className="mt-6 flex flex-col gap-3">
        {heads.map((h) => (
          <li key={h.date}>
            <Link
              href={`/daily/${h.date}`}
              className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-bull/40"
            >
              <div className="tnum text-sm font-medium text-fg">
                {formatCnDate(h.date)}
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
                {h.summary}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-muted transition-colors hover:text-bull">
          ← 返回今日
        </Link>
      </div>
    </div>
  );
}

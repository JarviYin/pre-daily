import Link from "next/link";
import { formatCnDate } from "@/lib/date";
import { FreshnessBadge } from "./FreshnessBadge";
import { SubscribeButton } from "./SubscribeCTA";

export function Masthead({
  date,
  generatedAt,
  editionNumber,
}: {
  date: string;
  generatedAt: string;
  editionNumber?: number;
}) {
  return (
    <header className="pt-10 sm:pt-14">
      <Link href="/" className="block text-center">
        <h1 className="font-mono text-2xl font-bold tracking-[0.2em] text-fg sm:text-4xl">
          PREDICTION<span className="text-bull"> · </span>DAILY
        </h1>
      </Link>
      <p className="mt-3 text-center text-[13px] text-muted sm:text-sm">
        预测市场中文早报 · 每天 8:00，3 分钟看懂真金白银今日在重新定价什么
      </p>

      <SubscribeButton />

      <div className="masthead-rule mt-6 h-px w-full" />

      <div className="mt-3 flex flex-col items-center justify-between gap-2 text-[12px] text-faint sm:flex-row">
        <span className="tnum text-muted">
          {formatCnDate(date)}
          {editionNumber ? ` · 第 ${editionNumber} 刊` : ""}
        </span>
        <FreshnessBadge generatedAt={generatedAt} />
        <span>
          数据来源{" "}
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted underline-offset-2 hover:text-bull hover:underline"
          >
            Polymarket
          </a>
        </span>
      </div>
    </header>
  );
}

import Link from "next/link";
import { formatTimestamp } from "@/lib/date";
import { SubscribeLink } from "./SubscribeCTA";

export function Footer({
  modelId,
  summaryModelId,
  generatedAt,
}: {
  modelId: string;
  summaryModelId: string;
  generatedAt: string;
}) {
  const modelNote =
    modelId === summaryModelId
      ? `本刊解读由 ${modelId} 生成`
      : `逐市场解读由 ${modelId} 生成，今日信号摘要由 ${summaryModelId} 生成`;
  return (
    <footer className="mt-16 border-t border-line pt-6 pb-12 text-[12px] leading-relaxed text-faint">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href="/archive" className="text-muted transition-colors hover:text-bull">
          往期归档
        </Link>
        <Link href="/worldcup" className="transition-colors hover:text-bull" style={{ color: "#f5b13d" }}>
          🏆 世界杯专题
        </Link>
        <Link href="/about" className="text-muted transition-colors hover:text-bull">
          关于
        </Link>
        <SubscribeLink />
        <a
          href="https://polymarket.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted transition-colors hover:text-bull"
        >
          数据来源：Polymarket Gamma API
        </a>
      </div>
      <p className="tnum mt-3">
        {modelNote} · 数据抓取于 {formatTimestamp(generatedAt)}
      </p>
      <p className="mt-2 max-w-2xl">
        本站为预测市场信息聚合与中文解读，所有概率、成交量均来自 Polymarket
        公开数据；解读由 AI 基于上述真实数据生成，不构成任何投资建议。本站与
        Polymarket 无隶属关系。
      </p>
    </footer>
  );
}

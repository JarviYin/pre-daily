import type { DailyRecap } from "@/lib/types";

// 昨日判断复盘：昨天说 X，今天市场给了什么答案。置于刊首给连续性——
// 读者看的是"判断的兑现"，不是每天 10 条孤立信息。

const VERDICT_META: Record<
  DailyRecap["verdict"],
  { label: string; cls: string; icon: string }
> = {
  hit: { label: "兑现", cls: "text-bull", icon: "✅" },
  miss: { label: "证伪", cls: "text-bear", icon: "❌" },
  pending: { label: "未定", cls: "text-faint", icon: "⏳" },
};

export function RecapBlock({ recap }: { recap: DailyRecap }) {
  const v = VERDICT_META[recap.verdict] ?? VERDICT_META.pending;
  return (
    <section className="mt-6 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted">
          昨日判断复盘
        </h2>
        <span className={`tnum text-[12px] font-semibold ${v.cls}`}>
          {v.icon} 昨日 · {v.label}
        </span>
      </div>
      <p className="mt-2 text-[15px] font-medium leading-relaxed text-fg">
        {recap.summary}
      </p>
      {recap.detail && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          {recap.detail}
        </p>
      )}
      <p className="mt-2 text-[12px] leading-relaxed text-faint">
        对照昨刊（{recap.prevDate}）判断，基于今日真实市场数据复盘。
      </p>
    </section>
  );
}

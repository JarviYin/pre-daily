import { formatTimestamp, hoursSince } from "@/lib/date";

export function FreshnessBadge({ generatedAt }: { generatedAt: string }) {
  const stale = hoursSince(generatedAt) > 24;
  const color = stale ? "var(--warn)" : "var(--bull)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] text-muted"
      title={stale ? "数据超过 24 小时未更新" : "数据为最新"}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span className="tnum">更新于 {formatTimestamp(generatedAt)}</span>
      {stale && <span style={{ color: "var(--warn)" }}>· 可能已过期</span>}
    </span>
  );
}

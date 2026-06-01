import { formatMove } from "@/lib/format";

export function MoverChip({ change }: { change: number | null }) {
  const { text, dir } = formatMove(change);
  const color =
    dir === "up" ? "var(--bull)" : dir === "down" ? "var(--bear)" : "var(--faint)";
  return (
    <span
      className="tnum inline-flex items-center text-[12px] font-medium"
      style={{ color }}
      title="领先选项过去 24 小时的概率变动（百分点）"
    >
      {text}
    </span>
  );
}

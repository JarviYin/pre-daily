import type { Badge } from "@/lib/types";

// Each badge explains WHY a market is on today's board. Color-coded so the
// reason is felt at a glance, consistent with the terminal palette.
const BADGE_STYLE: Record<Badge, { color: string; title: string }> = {
  异动: { color: "#19e09a", title: "过去 24 小时概率大幅变动" },
  放量: { color: "#46d6e0", title: "24 小时成交量显著高于自身近期均值" },
  新晋: { color: "#4f9dff", title: "近几天新上线的市场" },
  临近揭晓: { color: "#f5b13d", title: "临近解析截止且结果仍胶着" },
  持续高热: { color: "#9aa1ad", title: "常青高成交市场，作背景参照" },
};

export function BadgeRow({
  badges,
  className = "",
}: {
  badges: Badge[];
  className?: string;
}) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((b) => {
        const { color, title } = BADGE_STYLE[b];
        return (
          <span
            key={b}
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide"
            style={{
              color,
              backgroundColor: `${color}1f`,
              border: `1px solid ${color}40`,
            }}
            title={title}
          >
            {b}
          </span>
        );
      })}
    </div>
  );
}

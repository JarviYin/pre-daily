import type { Outcome } from "@/lib/types";
import { formatPct } from "@/lib/format";

const GRAYS = ["#7f8895", "#646c78", "#4e555f", "#3d434c", "#2f343b"];

function colorFor(index: number, option: string): string {
  if (index === 0) return "var(--bull)";
  if (option === "其他") return "#2a2e35";
  return GRAYS[Math.min(index - 1, GRAYS.length - 1)];
}

export function ProbabilityBar({ outcomes }: { outcomes: Outcome[] }) {
  const leader = outcomes[0];
  return (
    <div>
      {/* Stacked distribution bar — leading outcome in signal green. */}
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={outcomes
          .map((o) => `${o.option} ${formatPct(o.probability)}`)
          .join("，")}
      >
        {outcomes.map((o, i) => (
          <div
            key={`${o.option}-${i}`}
            className="bar-fill h-full"
            style={{
              width: `${Math.max(o.probability * 100, 0.4)}%`,
              background: colorFor(i, o.option),
            }}
          />
        ))}
      </div>

      {/* Legend — leading row emphasised. */}
      <ul className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {outcomes.map((o, i) => {
          const lead = i === 0;
          return (
            <li
              key={`${o.option}-legend-${i}`}
              className="flex items-center justify-between gap-2 text-[13px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ background: colorFor(i, o.option) }}
                />
                <span
                  className={`truncate ${lead ? "text-fg" : "text-muted"}`}
                  title={o.option}
                >
                  {o.option}
                </span>
              </span>
              <span
                className={`tnum shrink-0 ${lead ? "text-bull" : "text-muted"}`}
                style={lead ? { fontWeight: 600 } : undefined}
              >
                {formatPct(o.probability)}
              </span>
            </li>
          );
        })}
      </ul>
      {/* leader is implicitly the first legend row; kept for potential a11y use */}
      <span className="sr-only">最高概率选项：{leader?.option}</span>
    </div>
  );
}

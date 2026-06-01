// Display formatters. Numbers render in a tabular mono face (see .tnum).

export function formatVolume(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/** Integer percent, with "<1%" for tiny non-zero shares. */
export function formatPct(p: number): string {
  if (!Number.isFinite(p)) return "—";
  const v = p * 100;
  if (v > 0 && v < 1) return "<1%";
  return `${Math.round(v)}%`;
}

/** 24h probability-point move, e.g. "▲ 4.0pt" / "▼ 2.5pt" / "持平". */
export function formatMove(change: number | null): {
  text: string;
  dir: "up" | "down" | "flat";
} {
  if (change == null || Math.abs(change) < 0.005) return { text: "持平", dir: "flat" };
  const pts = Math.abs(change) * 100;
  return {
    text: `${change > 0 ? "▲" : "▼"} ${pts.toFixed(1)}pt`,
    dir: change > 0 ? "up" : "down",
  };
}

import { ImageResponse } from "next/og";
import type { DailyIssue } from "./types";

// A dark "odds board" share card. Intentionally Latin/numeric (brand, de-slugged
// English market titles, leading outcomes, percentages) so it renders crisply
// without bundling a multi-MB CJK font into the edge image route. The page's
// own <title>/<description> still carry the Chinese context in link previews.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BG = "#0a0b0e";
const FG = "#e7e9ee";
const MUTED = "#9aa1ad";
const LINE = "#262a33";
const BULL = "#19e09a";

function deslug(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 42);
}

function pct(p: number): string {
  if (!Number.isFinite(p)) return "—";
  const v = p * 100;
  return v > 0 && v < 1 ? "<1%" : `${Math.round(v)}%`;
}

export function renderOg(issue: DailyIssue | null): ImageResponse {
  const rows = (issue?.markets ?? []).slice(0, 5);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: FG,
          padding: "44px 60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 5 }}>
            PREDICTION<span style={{ color: BULL, padding: "0 6px" }}>·</span>DAILY
          </div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{issue?.date ?? ""}</div>
        </div>
        <div style={{ display: "flex", fontSize: 18, color: MUTED, marginTop: 6 }}>
          What the world&apos;s money is betting on — daily
        </div>
        <div style={{ display: "flex", height: 2, background: LINE, margin: "16px 0 8px" }} />

        {/* Odds-board rows */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-start", gap: 14, marginTop: 6 }}>
          {rows.map((m, i) => {
            const lead = m.outcomes[0];
            const w = Math.max(lead.probability * 100, 3);
            return (
              <div key={m.marketId} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", fontSize: 23, color: FG }}>
                    <span style={{ color: MUTED, marginRight: 12 }}>{i + 1}</span>
                    {deslug(m.slug)}
                  </div>
                  <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: BULL }}>
                    {pct(lead.probability)}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", fontSize: 15, color: MUTED }}>{lead.option}</div>
                </div>
                <div style={{ display: "flex", height: 7, background: "#1b1e25", borderRadius: 4 }}>
                  <div style={{ display: "flex", width: `${w}%`, background: BULL, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div style={{ display: "flex", fontSize: 26, color: MUTED }}>
              预测市场中文早报 · Polymarket signals, in Chinese
            </div>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 17, color: MUTED, marginTop: 8 }}>
          Source: Polymarket · pre-daily.com
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}

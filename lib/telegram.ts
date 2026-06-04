import type { DailyIssue } from "./types";
import { formatCnDate } from "./date";
import { formatPct } from "./format";

// One-way daily broadcast to a Telegram channel via the Bot API (no extra deps).
// Best-effort: never throws — a push failure must not fail the publish.
// Requires TELEGRAM_BOT_TOKEN (the bot must be an admin of the channel) and
// TELEGRAM_CHANNEL_ID (e.g. "@prediction_daily" or a numeric -100… id).

function topMovers(issue: DailyIssue, n = 3): string {
  // Prefer the headline 24h move (any outcome); fall back to the leading line.
  const moveOf = (m: DailyIssue["markets"][number]) => m.move24h ?? m.leadingChange;
  return issue.markets
    .filter((m) => {
      const mv = moveOf(m);
      return mv != null && Math.abs(mv) >= 0.01;
    })
    .sort((a, b) => Math.abs(moveOf(b)!) - Math.abs(moveOf(a)!))
    .slice(0, n)
    .map((m) => {
      const mv = moveOf(m)!;
      // When the move came from move24h, the figure belongs to the HEADLINE
      // outcome (often not the leader) — show that outcome, not outcomes[0].
      const opt = m.move24h != null ? m.headlineOption ?? m.outcomes[0].option : m.outcomes[0].option;
      const o = m.outcomes.find((x) => x.option === opt) ?? m.outcomes[0];
      const arrow = mv > 0 ? "▲" : "▼";
      const pts = (Math.abs(mv) * 100).toFixed(1);
      return `${arrow} ${m.title} — ${o.option} ${formatPct(o.probability)} (${pts}pt)`;
    })
    .join("\n");
}

export async function sendDailyPush(
  issue: DailyIssue,
  siteUrl: string,
  worldCup?: { headline: string; url: string }
): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel) return { sent: false, reason: "not configured" };

  const permalink = `${siteUrl.replace(/\/$/, "")}/daily/${issue.date}`;
  const movers = topMovers(issue);
  const wcLine = worldCup
    ? `🏆 世界杯专题：${worldCup.headline} → ${worldCup.url}\n\n`
    : "";
  const text =
    `📊 预测市场中文早报 · ${formatCnDate(issue.date)}\n\n` +
    `${issue.summary}\n\n` +
    (movers ? `今日异动：\n${movers}\n\n` : "") +
    wcLine +
    `全文（前 ${issue.markets.length} 市场 + 中文解读）→ ${permalink}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channel,
        text,
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[telegram] push failed:", res.status, body);
      return { sent: false, reason: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[telegram] push error:", err);
    return { sent: false, reason: String(err) };
  }
}

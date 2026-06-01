import type { DailyIssue } from "./types";
import { formatCnDate } from "./date";
import { formatPct } from "./format";

// One-way daily broadcast to a Telegram channel via the Bot API (no extra deps).
// Best-effort: never throws — a push failure must not fail the publish.
// Requires TELEGRAM_BOT_TOKEN (the bot must be an admin of the channel) and
// TELEGRAM_CHANNEL_ID (e.g. "@prediction_daily" or a numeric -100… id).

function topMovers(issue: DailyIssue, n = 3): string {
  return issue.markets
    .filter((m) => m.leadingChange != null && Math.abs(m.leadingChange) >= 0.01)
    .sort((a, b) => Math.abs(b.leadingChange!) - Math.abs(a.leadingChange!))
    .slice(0, n)
    .map((m) => {
      const lead = m.outcomes[0];
      const arrow = m.leadingChange! > 0 ? "▲" : "▼";
      const pts = (Math.abs(m.leadingChange!) * 100).toFixed(1);
      return `${arrow} ${m.title} — ${lead.option} ${formatPct(lead.probability)} (${pts}pt)`;
    })
    .join("\n");
}

export async function sendDailyPush(
  issue: DailyIssue,
  siteUrl: string
): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel) return { sent: false, reason: "not configured" };

  const permalink = `${siteUrl.replace(/\/$/, "")}/daily/${issue.date}`;
  const movers = topMovers(issue);
  const text =
    `📊 预测市场中文早报 · ${formatCnDate(issue.date)}\n\n` +
    `${issue.summary}\n\n` +
    (movers ? `今日异动：\n${movers}\n\n` : "") +
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

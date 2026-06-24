import type { DailyIssue } from "./types";
import type { WcFixture } from "./wc-schedule";
import { formatCnDate, formatCnKickoff } from "./date";
import { formatPct } from "./format";
import { teamZh } from "./wc-names";
import { catalystCalendar } from "./catalyst";
import { CATEGORY_META } from "./categories";

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
      return `${arrow} ${clip(m.title, 48)} — ${clip(o.option, 24)} ${formatPct(o.probability)} (${pts}pt)`;
    })
    .join("\n");
}

async function sendMessage(text: string): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel) return { sent: false, reason: "not configured" };
  // Telegram hard-limits a message to 4096 chars; clamp as a last resort so an
  // over-length assembly degrades gracefully instead of failing the whole push.
  const safe = text.length > 4096 ? text.slice(0, 4095) + "…" : text;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channel,
        text: safe,
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

function resultLine(f: WcFixture): string {
  const who =
    f.result === "draw"
      ? "战平"
      : f.result === "A"
        ? `${teamZh(f.teamA)} 胜`
        : f.result === "B"
          ? `${teamZh(f.teamB)} 胜`
          : "已结束";
  const score = f.score ? ` ${f.score}` : "";
  return `${teamZh(f.teamA)} vs ${teamZh(f.teamB)} — ${who}${score}`;
}

function fixtureLine(f: WcFixture): string {
  const kick = f.live ? "进行中" : f.kickoff ? formatCnKickoff(f.kickoff) : "待定";
  // The market's actual favorite — the draw included (common in group games).
  const best = Math.max(f.probA, f.probB, f.probDraw);
  // A freshly-listed fixture may have no parsed odds yet (all zero) — don't
  // assert "平局 0%" as the favorite; show kickoff + teams only.
  if (best <= 0) {
    return `${kick} ${teamZh(f.teamA)} vs ${teamZh(f.teamB)}（赔率待定）`;
  }
  const lead =
    best === f.probDraw
      ? `平局 ${formatPct(f.probDraw)}`
      : best === f.probA
        ? `${teamZh(f.teamA)}胜 ${formatPct(f.probA)}`
        : `${teamZh(f.teamB)}胜 ${formatPct(f.probB)}`;
  return `${kick} ${teamZh(f.teamA)} vs ${teamZh(f.teamB)}（${lead}）`;
}

// Truncate a market title for compact list lines.
function clip(s: string, n = 30): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function catalystBlock(issue: DailyIssue, n = 4): string {
  const entries = catalystCalendar(issue.markets).slice(0, n);
  if (!entries.length) return "";
  const lines = entries.map((e) => {
    const when = e.daysLeft === 0 ? "今日揭晓" : `${e.daysLeft}天后`;
    const cat = CATEGORY_META[e.category].label;
    return `· ${clip(e.title)}（${cat}）— ${e.leadOption} ${formatPct(e.leadProb)}｜${when}`;
  });
  return `📅 临近揭晓：\n${lines.join("\n")}\n\n`;
}

export type WcPushBlock = {
  headline: string;
  url: string;
  finished?: WcFixture[]; // last night's settled results
  upcoming?: WcFixture[]; // today's fixtures (kickoff + 1X2 odds)
  focus?: WcFixture | null; // tonight's focus fixture
};

export async function sendDailyPush(
  issue: DailyIssue,
  siteUrl: string,
  worldCup?: WcPushBlock
): Promise<{ sent: boolean; reason?: string }> {
  const permalink = `${siteUrl.replace(/\/$/, "")}/daily/${issue.date}`;
  const movers = topMovers(issue);

  // Investment read (资金信号 + 资产联动) — only when the edition carries it.
  let briefBlock = "";
  if (issue.briefing) {
    if (issue.briefing.moneyFlow) briefBlock += `💰 资金信号：\n${issue.briefing.moneyFlow}\n\n`;
    if (issue.briefing.assetLink) briefBlock += `🔗 资产联动：\n${issue.briefing.assetLink}\n\n`;
  }

  let wcBlock = "";
  if (worldCup) {
    const lines = [`🏆 世界杯：${worldCup.headline}`];
    const finished = (worldCup.finished ?? []).filter((f) => f.result).slice(0, 3);
    if (finished.length) {
      lines.push(`昨夜赛果（据 Polymarket 结算）：`);
      lines.push(...finished.map((f) => `· ${resultLine(f)}`));
    }
    const upcoming = (worldCup.upcoming ?? []).slice(0, 5);
    if (upcoming.length) {
      // Window spans ~28h, so kickoffs are often next-Beijing-day early hours —
      // each line carries the exact date; the header must not claim "今日".
      lines.push(`接下来的比赛（北京时间，附胜平负概率）：`);
      lines.push(...upcoming.map((f) => `· ${fixtureLine(f)}`));
    }
    if (worldCup.focus) lines.push(`今日焦点：${fixtureLine(worldCup.focus)}`);
    lines.push(`专题全文 → ${worldCup.url}`);
    wcBlock = lines.join("\n") + "\n\n";
  }

  const text =
    `📊 预测市场中文早报 · ${formatCnDate(issue.date)}\n\n` +
    `${issue.summary}\n\n` +
    briefBlock +
    (movers ? `📈 今日异动：\n${movers}\n\n` : "") +
    catalystBlock(issue) +
    wcBlock +
    `全文（前 ${issue.markets.length} 市场 + 中文解读）→ ${permalink}`;

  return sendMessage(text);
}

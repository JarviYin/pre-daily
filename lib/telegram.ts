import type { DailyIssue } from "./types";
import type { WcFixture, WcScheduleSnapshot } from "./wc-schedule";
import type { WcFocusMatchBrief } from "./wc-llm";
import { formatCnDate, formatCnKickoff } from "./date";
import { formatPct } from "./format";
import { teamZh } from "./wc-names";

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

async function sendMessage(text: string): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel) return { sent: false, reason: "not configured" };
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
  const lead =
    best === f.probDraw
      ? `平局 ${formatPct(f.probDraw)}`
      : best === f.probA
        ? `${teamZh(f.teamA)}胜 ${formatPct(f.probA)}`
        : `${teamZh(f.teamB)}胜 ${formatPct(f.probB)}`;
  return `${kick} ${teamZh(f.teamA)} vs ${teamZh(f.teamB)}（${lead}）`;
}

export type WcPushBlock = {
  headline: string;
  url: string;
  finished?: WcFixture[]; // last night's settled results
  focus?: WcFixture | null; // tonight's focus fixture
};

export async function sendDailyPush(
  issue: DailyIssue,
  siteUrl: string,
  worldCup?: WcPushBlock
): Promise<{ sent: boolean; reason?: string }> {
  const permalink = `${siteUrl.replace(/\/$/, "")}/daily/${issue.date}`;
  const movers = topMovers(issue);

  let wcBlock = "";
  if (worldCup) {
    const lines = [`🏆 世界杯：${worldCup.headline}`];
    const finished = (worldCup.finished ?? []).filter((f) => f.result).slice(0, 3);
    if (finished.length) {
      lines.push(`昨夜赛果（据 Polymarket 结算）：`);
      lines.push(...finished.map((f) => `· ${resultLine(f)}`));
    }
    if (worldCup.focus) lines.push(`今日焦点：${fixtureLine(worldCup.focus)}`);
    lines.push(`专题全文 → ${worldCup.url}`);
    wcBlock = lines.join("\n") + "\n\n";
  }

  const text =
    `📊 预测市场中文早报 · ${formatCnDate(issue.date)}\n\n` +
    `${issue.summary}\n\n` +
    (movers ? `今日异动：\n${movers}\n\n` : "") +
    wcBlock +
    `全文（前 ${issue.markets.length} 市场 + 中文解读）→ ${permalink}`;

  return sendMessage(text);
}

/**
 * Evening matchday push: tonight's fixtures with fresh 1X2 odds + the focus
 * match breakdown from the day's briefing. The caller skips this entirely on
 * non-matchdays. Best-effort like the daily push.
 */
export async function sendWcMatchdayPush(input: {
  date: string;
  schedule: WcScheduleSnapshot;
  focus: WcFocusMatchBrief | null;
  siteUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const { schedule, focus } = input;
  const url = `${input.siteUrl.replace(/\/$/, "")}/worldcup`;
  const fixtures = [...schedule.live, ...schedule.upcoming].slice(0, 6);
  if (!fixtures.length) return { sent: false, reason: "no fixtures" };

  const lines = fixtures.map((f) => `· ${fixtureLine(f)}`);
  let focusBlock = "";
  if (focus) {
    const f = focus.fixture;
    const head = `🎯 焦点战：${teamZh(f.teamA)} vs ${teamZh(f.teamB)}`;
    const analysis = focus.analysis
      ? `\n${focus.analysis.length > 180 ? focus.analysis.slice(0, 178) + "…" : focus.analysis}`
      : "";
    focusBlock = `\n${head}${analysis}\n`;
  }

  const text =
    `🏆 世界杯今晚看点 · ${formatCnDate(input.date)}\n\n` +
    `今夜至明晨赛程（北京时间，附实时胜负概率）：\n${lines.join("\n")}\n` +
    focusBlock +
    `\n冠军概率、小组格局与深度解读 → ${url}`;

  return sendMessage(text);
}

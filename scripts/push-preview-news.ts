// 一次性脚本：把新闻版原型预览（lib/previewNewsData.ts）推送到 Telegram 频道。
// 用法: pnpm tsx scripts/push-preview-news.ts
import { config } from "dotenv";
config();

import { previewNews } from "../lib/previewNewsData";
import { formatMove, formatPct, formatVolume } from "../lib/format";
import { formatCnDate } from "../lib/date";

function line(item: (typeof previewNews.items)[number]): string {
  const move = formatMove(item.move24h);
  const body = [
    `📊 ${item.leadOption} ${formatPct(item.leadProb)}（${move.text}）｜24h ${formatVolume(item.volume24hr)}｜流动性 ${formatVolume(item.liquidity)}`,
    `💡 ${item.significance}`,
    `可信度 · ${item.confidence}`,
  ].join("\n");
  return `${item.title}\n${item.story}\n${body}\n→ ${item.sourceUrl}`;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel) {
    console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID not configured");
    process.exit(1);
  }

  const [lead, ...rest] = previewNews.items;
  const text =
    `📰 Prediction Daily · 新闻版（原型预览）\n` +
    `${formatCnDate(previewNews.date)} · 全球大事要闻\n` +
    `基于 Polymarket 真实市场数据，用真金白银的定价改写今日世界要闻\n\n` +
    `━━ 今日头条 ━━\n${line(lead)}\n\n` +
    (rest.length
      ? `━━ 今日要闻 ━━\n` +
        rest.map((it, i) => `${i + 1}️⃣\n${line(it)}`).join("\n\n") +
        "\n\n"
      : "") +
    `──\n原型说明：新闻版为产品方向演示，尚未接入每日管线。以上为公开数据的信息解读，不构成投资建议。`;

  // Telegram hard limit 4096 — clamp as last resort.
  const safe = text.length > 4096 ? text.slice(0, 4095) + "…" : text;
  console.log(`message length: ${text.length} chars (safe=${safe.length})`);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: channel,
      text: safe,
      disable_web_page_preview: false,
    }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    console.error("push failed:", res.status, JSON.stringify(body));
    process.exit(1);
  }
  console.log(
    `✓ pushed to ${channel} — message_id=${body.result ? (body.result as { message_id: number }).message_id : "?"}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("push-preview-news failed:", e);
  process.exit(1);
});

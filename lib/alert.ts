// Best-effort failure alert via Telegram. No-op if not configured.
// Fallback chain (2026-08): TELEGRAM_ALERT_CHAT_ID → TELEGRAM_CHANNEL_ID —
// 08-15~20 断更期间告警只进了 Vercel 日志（专用 chat 未配置），没人看到。
// 发到主频道虽吵，但强于静默；配置专用 chat 后自动分流。
export async function sendAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID ?? process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) {
    console.error("[alert]", message);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch (err) {
    console.error("[alert] failed to send:", err);
  }
}

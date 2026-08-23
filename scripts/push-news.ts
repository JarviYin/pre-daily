// Push stored news briefing to Telegram. Usage: pnpm tsx scripts/push-news.ts [YYYY-MM-DD]
import { config } from "dotenv";
config();

import { getIssue, getLatestIssue } from "../lib/db/queries";
import { sendNewsPush } from "../lib/telegram";

async function main() {
  const date = process.argv[2];
  const issue = date ? await getIssue(date) : await getLatestIssue();
  if (!issue?.news) throw new Error(`no news stored for ${issue?.date ?? date ?? "latest"}`);
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";
  const r = await sendNewsPush(issue.news, site);
  console.log(`news push ${issue.date}:`, r);
}

main().catch((e) => {
  console.error("push-news failed:", e);
  process.exit(1);
});

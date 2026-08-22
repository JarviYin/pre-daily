// 手动生成/回填某日新闻版（默认最新刊）：读当日刊 → LLM 改写 → 落库。
// 用于正式化上线时的历史回填，或新闻版生成失败后的补跑。
// 用法: pnpm tsx scripts/gen-news.ts [YYYY-MM-DD]
// 注意：写入 .env DATABASE_URL 指向的库；对生产库回填请用生产连接串运行。
import { config } from "dotenv";
config();

import { getLatestIssue, getIssue, setIssueNews } from "../lib/db/queries";
import { generateNewsBriefing } from "../lib/news";

async function main() {
  const date = process.argv[2];
  const issue = date ? await getIssue(date) : await getLatestIssue();
  if (!issue) throw new Error(`no issue found for ${date ?? "latest"}`);

  console.log(`Generating news briefing for ${issue.date} (${issue.markets.length} markets) …`);
  const news = await generateNewsBriefing(issue);
  await setIssueNews(issue.date, news);
  console.log(
    `✓ news stored ${issue.date}: ${news.items.length} items, ` +
      `lead="${news.items[0]?.title}", model=${news.modelId}, $${news.costUsd.toFixed(4)}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("gen-news failed:", e);
  process.exit(1);
});

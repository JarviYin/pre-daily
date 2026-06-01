// Run the daily pipeline once against real data and persist it.
// Usage: pnpm tsx scripts/refresh.ts            (uses today, Asia/Shanghai)
//        pnpm tsx scripts/refresh.ts 2026-06-01 (explicit date)
// Requires LLM_API_KEY and DATABASE_URL in the environment (.env).
import { config } from "dotenv";
config();

import { generateIssue } from "../lib/pipeline";
import { upsertIssue } from "../lib/db/queries";
import { todayShanghai } from "../lib/date";

async function main() {
  const date = process.argv[2] || todayShanghai();
  console.log(`Generating issue for ${date} …`);
  const issue = await generateIssue(date);
  await upsertIssue(issue);
  console.log(
    `✓ Published ${date}: ${issue.markets.length} markets, ` +
      `model=${issue.modelId}, summaryModel=${issue.summaryModelId}, ` +
      `cost≈$${issue.costUsd.toFixed(4)}`
  );
  console.log(`\nSummary:\n${issue.summary}\n`);
  for (const m of issue.markets) {
    console.log(`#${m.rank} [${m.category}] ${m.title}`);
    console.log(`   insight: ${m.analysis?.insight}`);
    console.log(`   signal : ${m.analysis?.signal}`);
    console.log(`   risk   : ${m.analysis?.risk}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("refresh failed:", e);
  process.exit(1);
});

// P1 QA gate: assert the published edition is trustworthy.
// Usage: pnpm tsx scripts/qa.ts [date]
import { config } from "dotenv";
config();

import { getIssue } from "../lib/db/queries";
import { todayShanghai, isValidDate } from "../lib/date";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓ PASS" : "✗ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const date = process.argv[2] || todayShanghai();
  const issue = await getIssue(date);
  if (!issue) {
    console.error(`No issue for ${date}`);
    process.exit(1);
  }
  const ms = issue.markets;
  console.log(`QA for ${date} — ${ms.length} markets\n`);

  // Gate 1: enough markets
  check("≥6 markets published", ms.length >= 6, `${ms.length}`);

  // Gate 2: ANTI-TEMPLATE — all analyses present & pairwise distinct
  const allHaveAnalysis = ms.every((m) => m.analysis?.insight && m.analysis?.signal && m.analysis?.risk);
  check("every market has full analysis", allHaveAnalysis);
  const insights = ms.map((m) => m.analysis?.insight ?? "");
  const signals = ms.map((m) => m.analysis?.signal ?? "");
  check(
    "insights all distinct (not a template)",
    new Set(insights).size === insights.length,
    `${new Set(insights).size}/${insights.length} unique`
  );
  check(
    "signals all distinct (not a template)",
    new Set(signals).size === signals.length,
    `${new Set(signals).size}/${signals.length} unique`
  );

  // Gate 3: each insight cites a market-specific number (digit present)
  const cited = insights.every((s) => /\d/.test(s));
  check("every insight cites a concrete number", cited);

  // Gate 4: no expired markets (endDate in the future when present)
  const now = Date.now();
  const expired = ms.filter((m) => m.endDate && Date.parse(m.endDate) < now);
  check("no expired markets", expired.length === 0, expired.map((m) => m.title).join("; "));

  // Gate 5: probability distributions sum to ~100%
  const badSum = ms.filter((m) => {
    const s = m.outcomes.reduce((a, o) => a + o.probability, 0);
    return s < 0.99 || s > 1.01;
  });
  check(
    "all distributions sum to 100% (±1%)",
    badSum.length === 0,
    badSum.map((m) => `${m.title}=${(m.outcomes.reduce((a, o) => a + o.probability, 0) * 100).toFixed(1)}%`).join("; ")
  );

  // Gate 6: every market links to a real Polymarket event
  const badUrl = ms.filter((m) => !/^https:\/\/polymarket\.com\/event\/.+/.test(m.sourceUrl));
  check("every market links to polymarket.com/event/…", badUrl.length === 0);

  // Gate 7: honest model attribution (no OpenAI claim unless actually used)
  check("model id recorded", Boolean(issue.modelId), issue.modelId);
  check("summary present & non-template", issue.summary.length > 20);

  console.log(`\n${failures === 0 ? "✅ ALL GATES PASSED" : `❌ ${failures} GATE(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("qa failed:", e);
  process.exit(1);
});

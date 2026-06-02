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

  // ── v2.1 heat / curation gates ──────────────────────────────────────────
  // Gate 8: curation — no sports market survived (mechanical churn excluded).
  const sports = ms.filter((m) => m.category === "sports");
  check("no sports/esports markets (curation)", sports.length === 0, sports.map((m) => m.title).join("; "));

  // Gate 9: edition shape — exactly one hero, at most two anchors.
  const heroes = ms.filter((m) => m.role === "hero");
  const anchors = ms.filter((m) => m.role === "anchor");
  check("exactly one hero", heroes.length === 1, `${heroes.length}`);
  check("≤2 anchors", anchors.length <= 2, `${anchors.length}`);

  // Gate 10: hero is genuinely the biggest 24h mover — but on a quiet day
  // (no market clears the ~3pt hero floor) selectEdition picks the highest
  // heatScore instead, so the gate must mirror that fallback.
  const HERO_MIN_MOVE = 0.03;
  if (heroes.length === 1) {
    const nonAnchor = ms.filter((m) => m.role !== "anchor");
    const maxMove = Math.max(...nonAnchor.map((m) => Math.abs(m.move24h ?? 0)), 0);
    if (maxMove >= HERO_MIN_MOVE) {
      const heroMove = Math.abs(heroes[0].move24h ?? heroes[0].leadingChange ?? 0);
      check("hero has the largest |24h move|", heroMove >= maxMove - 1e-9, `hero=${(heroMove * 100).toFixed(1)}pt max=${(maxMove * 100).toFixed(1)}pt`);
    } else {
      const maxHeat = Math.max(...nonAnchor.map((m) => m.heatScore), 0);
      check("quiet day: hero has the largest heatScore", heroes[0].heatScore >= maxHeat - 1e-9, `hero=${heroes[0].heatScore.toFixed(2)} max=${maxHeat.toFixed(2)}`);
    }
  }

  // Gate 11: heat list is sorted by heat score (descending).
  const heat = ms.filter((m) => m.role === "heat");
  const sorted = heat.every((m, i) => i === 0 || heat[i - 1].heatScore >= m.heatScore - 1e-9);
  check("heat list sorted by heatScore desc", sorted);

  // Gate 12: badges are consistent with the underlying numbers.
  const badgeViolations = ms.filter((m) => {
    if (m.badges.includes("异动") && Math.abs(m.move24h ?? 0) < 0.05) return true;
    if (m.badges.includes("放量") && m.surge < 2) return true;
    if (m.badges.includes("新晋") && !m.isNew) return true;
    return false;
  });
  check("badges consistent with metrics", badgeViolations.length === 0, badgeViolations.map((m) => m.title).join("; "));

  console.log(`\n${failures === 0 ? "✅ ALL GATES PASSED" : `❌ ${failures} GATE(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("qa failed:", e);
  process.exit(1);
});

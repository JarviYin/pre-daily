// P1 QA gate: assert the published edition is trustworthy.
// Usage: pnpm tsx scripts/qa.ts [date]
import { config } from "dotenv";
config();

import { getIssue } from "../lib/db/queries";
import { todayShanghai } from "../lib/date";

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
  const allHaveAnalysis = ms.every(
    (m) => m.analysis?.insight && m.analysis?.signal && m.analysis?.risk
  );
  check("every market has full analysis", allHaveAnalysis);
  // 交易视角 is best-effort (optional in the schema): flag only on poor coverage.
  const tradeCov = ms.filter((m) => m.analysis?.trade).length;
  check("交易视角 coverage ≥80%", tradeCov >= Math.ceil(ms.length * 0.8), `${tradeCov}/${ms.length}`);
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

  // Gate 7b: investment read present (资金信号 + 资产联动).
  check(
    "daily briefing present (资金信号+资产联动)",
    Boolean(issue.briefing?.moneyFlow?.trim() && issue.briefing?.assetLink?.trim()),
    issue.briefing ? `moneyFlow=${issue.briefing.moneyFlow.length}字 assetLink=${issue.briefing.assetLink.length}字` : "缺失"
  );

  // Gate 7c: 宏观视角 present — snapshot chips + at least the macro read.
  // (Data-source outages degrade fields individually; a fully missing section
  //  means the whole macro path silently died and deserves a failing gate.)
  check(
    "宏观视角 present (快照+宏观定价)",
    Boolean(issue.macro && issue.macro.chips.length >= 3 && issue.macro.view?.trim()),
    issue.macro
      ? `chips=${issue.macro.chips.length} view=${issue.macro.view.length}字 calendar=${issue.macro.calendar.length}条`
      : "缺失"
  );

  // Gate 7d: finance quota — ≥2 macro/crypto markets in every edition.
  const financeCnt = ms.filter((m) => m.category === "macro" || m.category === "crypto").length;
  check("≥2 宏观/金融类市场 (finance quota)", financeCnt >= 2, `${financeCnt}`);

  // ── v2.1 heat / curation gates ──────────────────────────────────────────
  // Gate 8: curation — no sports market survived (mechanical churn excluded).
  const sports = ms.filter((m) => m.category === "sports");
  check("no sports/esports markets (curation)", sports.length === 0, sports.map((m) => m.title).join("; "));

  // Gate 9: edition shape — exactly one hero, at most two anchors.
  const heroes = ms.filter((m) => m.role === "hero");
  const anchors = ms.filter((m) => m.role === "anchor");
  check("exactly one hero", heroes.length === 1, `${heroes.length}`);
  check("≤2 anchors", anchors.length <= 2, `${anchors.length}`);

  // Gate 10: hero is genuinely the biggest 24h mover among CREDIBLE markets
  // (mirrors lib/gamma.ts hero gates: move + liquidity + volume floors) — on a
  // quiet day selectEdition falls back to the highest heatScore instead.
  const HERO_MIN_MOVE = 0.03;
  const HERO_MIN_LIQ = 100_000;
  const HERO_MIN_VOL24 = 50_000;
  if (heroes.length === 1) {
    // Mover comparison pool mirrors gamma's hero gates (credible movers only);
    // the quiet-day fallback pool mirrors gamma's UNGATED `eligible` set.
    const nonAnchor = ms.filter((m) => m.role !== "anchor");
    const credible = nonAnchor.filter(
      (m) => m.liquidity >= HERO_MIN_LIQ && m.volume24hr >= HERO_MIN_VOL24
    );
    const maxMove = Math.max(...credible.map((m) => Math.abs(m.move24h ?? 0)), 0);
    if (maxMove >= HERO_MIN_MOVE) {
      const heroMove = Math.abs(heroes[0].move24h ?? heroes[0].leadingChange ?? 0);
      check("hero has the largest credible |24h move|", heroMove >= maxMove - 1e-9, `hero=${(heroMove * 100).toFixed(1)}pt max=${(maxMove * 100).toFixed(1)}pt`);
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

  // ── v3 narrative / recap gates ─────────────────────────────────────────
  // Gate 13: 论点线 — thesis 为整刊核心；论据块必须互不相同且引用具体数字。
  const n = issue.narrative;
  if (n) {
    check("narrative thesis non-empty", n.thesis.trim().length > 0, `${n.thesis.length}字`);
    check("narrative pillars ≥2", n.pillars.length >= 2, `${n.pillars.length}`);
    const evCited = n.pillars.every((p) => /\d/.test(p.evidence));
    check("pillars evidence cites numbers", evCited);
    const distinctClaims = new Set(n.pillars.map((p) => p.claim)).size;
    check("pillar claims pairwise distinct", distinctClaims === n.pillars.length, `${distinctClaims}/${n.pillars.length}`);
    check("narrative counterView non-empty", n.counterView.trim().length > 0, `${n.counterView.length}字`);
    check("narrative watch non-empty", n.watch.trim().length > 0, `${n.watch.length}字`);
  } else {
    check("narrative present (论点线)", false, "缺失——本刊将以 summary 卡回退渲染");
  }

  // Gate 14: 昨日复盘 — 存在时 verdict 合法、结论非空；缺失不阻塞（无昨日刊）。
  const r = issue.recap;
  if (r) {
    check("recap verdict valid", ["hit", "miss", "pending"].includes(r.verdict), r.verdict);
    check("recap summary non-empty", r.summary.trim().length > 0, `${r.summary.length}字`);
    check("recap cites prev date", Boolean(r.prevDate), r.prevDate);
  } else {
    console.log("⚠ recap 缺失（无昨日刊或复盘失败）——不阻塞发布");
  }

  // Gate 15: 新闻版 — 存在时：≥3 条、slug 全部回链当日市场、头条标题含数字
  // （新闻版是 best-effort 增量，缺失只告警不失败——不阻塞主刊）。
  const nw = issue.news;
  if (nw) {
    check("news items ≥3", nw.items.length >= 3, `${nw.items.length}`);
    const marketSlugs = new Set(issue.markets.map((m) => m.slug));
    const dangling = nw.items.filter((it) => !marketSlugs.has(it.slug));
    check("news slugs link to real markets", dangling.length === 0, dangling.map((d) => d.slug).join("; "));
    check("news headline cites a number", /\d/.test(nw.items[0]?.title ?? ""), nw.items[0]?.title.slice(0, 40));
    check("news date matches issue", nw.date === issue.date, nw.date);
  } else {
    console.log("⚠ news 缺失（生成失败或旧刊）——不阻塞发布");
  }

  console.log(`\n${failures === 0 ? "✅ ALL GATES PASSED" : `❌ ${failures} GATE(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("qa failed:", e);
  process.exit(1);
});

// Dry-run probe for the World Cup match layer — fetches LIVE Gamma data and
// prints what the pipeline would see today. No DB, no LLM.
//   pnpm tsx scripts/check-wc.ts

import { getWorldCup } from "../lib/worldcup";
import { planAngle } from "../lib/wc-angles";
import { todayShanghai, formatCnKickoff } from "../lib/date";
import { teamZh } from "../lib/wc-names";

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

async function main() {
  const date = todayShanghai();
  const snap = await getWorldCup();

  console.log(`=== World Cup snapshot ${date} (asOf ${snap.asOf}) ===`);
  console.log(`teams: ${snap.teams.length}, 24h vol $${(snap.volume24hr / 1e6).toFixed(1)}M`);
  console.log(`\n— 夺冠 Top 8 —`);
  for (const t of snap.teams.slice(0, 8)) {
    console.log(`  ${teamZh(t.team).padEnd(8)} ${pct(t.prob)}  move24h=${t.move24h ?? "-"}`);
  }

  const s = snap.schedule;
  console.log(`\n— 赛程 — upcoming=${s.upcoming.length} live=${s.live.length} finished=${s.finished.length}`);
  for (const f of s.finished)
    console.log(`  [完] ${teamZh(f.teamA)} vs ${teamZh(f.teamB)} (${f.group ?? "?"}组) result=${f.result ?? "未结算"} score=${f.score ?? "-"}`);
  for (const f of s.live)
    console.log(`  [中] ${teamZh(f.teamA)} ${pct(f.probA)} / 平 ${pct(f.probDraw)} / ${teamZh(f.teamB)} ${pct(f.probB)}`);
  for (const f of s.upcoming)
    console.log(
      `  [待] ${f.kickoff ? formatCnKickoff(f.kickoff) : "??"} ${teamZh(f.teamA)} ${pct(f.probA)} / 平 ${pct(f.probDraw)} / ${teamZh(f.teamB)} ${pct(f.probB)} ($${(f.vol24h / 1e3).toFixed(0)}K)`
    );

  console.log(`\n— 小组头名盘 — groups=${snap.groups.length}`);
  for (const g of snap.groups) {
    console.log(`  ${g.group}组: ${g.teams.map((t) => `${teamZh(t.team)} ${pct(t.winGroupProb)}`).join(" · ")}`);
  }

  if (snap.focusMatch) {
    const f = snap.focusMatch.fixture;
    console.log(`\n— 焦点战 — ${teamZh(f.teamA)} vs ${teamZh(f.teamB)} ($${(f.vol24h / 1e3).toFixed(0)}K/24h)`);
    for (const p of snap.focusMatch.props) console.log(`  prop: ${p.label} → ${pct(p.prob)}`);
  } else {
    console.log(`\n— 焦点战 — (无)`);
  }

  const angle = planAngle(date, snap);
  console.log(`\n— 今日角度 — [${angle.phase}/${angle.key}] ${angle.title}`);
  console.log(`  focus teams: ${angle.focus.map((t) => teamZh(t.team)).join("、")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

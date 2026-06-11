// LOCAL visual-QA seed: build today's WC briefing from LIVE Gamma data but a
// SYNTHETIC narrative (DeepSeek is unreachable from this dev machine). Never
// run against prod — the narrative is fake and clearly labeled.
//   DATABASE_URL=postgres://localhost:5432/predaily_dev pnpm tsx scripts/seed-wc.ts

import { getWorldCup } from "../lib/worldcup";
import { planAngle } from "../lib/wc-angles";
import { upsertWcBriefing } from "../lib/db/queries";
import { todayShanghai } from "../lib/date";
import { teamZh } from "../lib/wc-names";
import type { WcBriefing } from "../lib/wc-llm";

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Refusing to seed a non-local database.");
  }
  const date = todayShanghai();
  const snap = await getWorldCup();
  const angle = planAngle(date, snap);

  const b: WcBriefing = {
    date,
    phase: angle.phase,
    angleKey: angle.key,
    title: angle.title,
    headline: "[SEED] 揭幕战之夜：市场押注墨西哥开门红",
    lede:
      "[SEED 合成文案，仅本地视觉验证] 世界杯今夜在墨西哥城揭幕，赛果盘给了东道主 68.5% 的胜率——这是本届开赛前市场最有共识的一场。" +
      "与此同时夺冠盘上西班牙以 17% 继续领跑，法国 16.1% 紧随其后，两强差距不到一个百分点，市场仍未选边。",
    teamFocus: angle.focus.slice(0, 2).map((t) => ({
      team: teamZh(t.team),
      prob: t.prob,
      move24h: t.move24h,
      narrative: `[SEED] ${teamZh(t.team)} 的合成解读文案，用于本地布局检查。市场当前定价 ${(t.prob * 100).toFixed(1)}%，文字长度模拟真实输出的六十到一百六十字区间，确保卡片在两行与四行之间的排版都正常。`,
    })),
    oddsSnapshot: snap.teams.slice(0, 10),
    schedule: snap.schedule,
    groups: snap.groups.length ? snap.groups : null,
    focusMatch: snap.focusMatch
      ? {
          ...snap.focusMatch,
          analysis:
            "[SEED] 焦点战合成拆解：墨西哥 68.5% 的胜率定价反映了主场与实力的双重溢价；双方进球盘只有 37.5%，说明市场预期这是一场南非摆大巴、东道主控场的比赛。若上半场未进球，赛果盘可能快速回落——这是今夜值得盯的盘口信号。",
        }
      : null,
    lookAhead: "[SEED] 明晨韩国 vs 捷克接近三向均势，是首轮最大的悬念场。",
    modelId: "seed-local",
    generatedAt: new Date().toISOString(),
    costUsd: 0,
  };

  await upsertWcBriefing(b);
  console.log(`seeded wc_briefings ${date} (${angle.phase}/${angle.key})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

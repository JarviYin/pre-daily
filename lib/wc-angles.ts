// The "expand daily" engine. Given the date + live market snapshot, decide the
// day's editorial ANGLE (so the special never repeats and tracks the tournament
// arc) and which teams to spotlight. The schedule-aware part: before kick-off we
// rotate preview themes; during the tournament we lead with the day's actual
// match markets when present, otherwise track the biggest odds movers.

import type { WcSnapshot, WcTeam } from "./worldcup";

export type WcPhase = "pre" | "group" | "knockout" | "final" | "after";

export type WcAngle = {
  phase: WcPhase;
  key: string;
  title: string; // human-facing angle headline seed
  instruction: string; // what the LLM should focus the deep-dive on
  focus: WcTeam[]; // 1-3 teams to spotlight (with their live odds)
};

// Tournament calendar (2026 FIFA World Cup, USA/Canada/Mexico).
const KICKOFF = "2026-06-11";
const GROUP_END = "2026-07-03";
const KO_END = "2026-07-18";
const FINAL_DAY = "2026-07-19";
export const SUNSET = "2026-07-20"; // after this the special winds down

export function phaseFor(date: string): WcPhase {
  if (date < KICKOFF) return "pre";
  if (date <= GROUP_END) return "group";
  if (date <= KO_END) return "knockout";
  if (date <= FINAL_DAY) return "final";
  return "after";
}

function dayIndex(date: string): number {
  const base = Date.parse("2026-06-01T00:00:00Z");
  const d = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(d) ? Math.max(0, Math.round((d - base) / 86_400_000)) : 0;
}

const byName = (snap: WcSnapshot, ...names: string[]): WcTeam[] =>
  names
    .map((n) => snap.teams.find((t) => t.team.toLowerCase() === n.toLowerCase()))
    .filter((t): t is WcTeam => Boolean(t));

// Pre-tournament rotating preview themes. Each picks its spotlight teams from
// the live odds so the data stays real.
const PRE_THEMES: ((s: WcSnapshot) => Omit<WcAngle, "phase">)[] = [
  (s) => ({
    key: "contenders",
    title: "夺冠热门盘点：谁是头号种子",
    instruction:
      "盘点当前夺冠概率最高的几支球队，解释市场为何把它们排在前列；对比第一与第二热门的差距说明了什么。",
    focus: s.teams.slice(0, 3),
  }),
  (s) => ({
    key: "darkhorses",
    title: "黑马候选：被低估的中游军团",
    instruction:
      "聚焦夺冠概率处于中游（约第 8–16 位）、但有潜力制造冷门的球队，分析它们的上限与软肋。",
    focus: s.teams.slice(7, 10),
  }),
  (s) => ({
    key: "euro-vs-samerica",
    title: "欧洲 vs 南美：两大势力的赔率对决",
    instruction:
      "对比欧洲与南美头号球队的夺冠概率，从风格与历史维度解读市场为何如此定价两大足球势力。",
    focus: [
      ...byName(s, "France", "Spain", "England", "Germany").slice(0, 1),
      ...byName(s, "Argentina", "Brazil").slice(0, 2),
    ],
  }),
  (s) => ({
    key: "giants",
    title: "豪门成色：传统列强的真实位置",
    instruction:
      "选取传统豪门，结合当前赔率分析它们这届的成色——是真热门还是名气大于实力。",
    focus: byName(s, "Brazil", "Germany", "Argentina", "England", "Italy").slice(0, 2),
  }),
  (s) => ({
    key: "hosts",
    title: "东道主与新赛制：48 队首届的看点",
    instruction:
      "解读三个东道主（美国、加拿大、墨西哥）的赔率与主场预期，并说明 48 队新赛制对赛程和冷门概率的影响。",
    focus: byName(s, "United States", "USA", "Mexico", "Canada").slice(0, 2),
  }),
  (s) => ({
    key: "divergence",
    title: "赔率背后：市场分歧在哪里",
    instruction:
      "找出资金量大或近日有变动的球队，解读市场分歧点——哪些队被押注者看高、哪些被看衰。",
    focus: (s.topMovers.length ? s.topMovers : s.teams.slice(3, 6)).slice(0, 3),
  }),
];

export function planAngle(date: string, snap: WcSnapshot): WcAngle {
  const phase = phaseFor(date);
  const idx = dayIndex(date);

  if (phase === "pre") {
    const t = PRE_THEMES[idx % PRE_THEMES.length](snap);
    return { phase, ...t };
  }

  if (phase === "final") {
    return {
      phase,
      key: "final-preview",
      title: "决赛前瞻：冠军悬念",
      instruction:
        "聚焦进入决赛的两队（用当前夺冠概率最高的两队近似），前瞻这场决赛的看点与市场倾向。",
      focus: snap.teams.slice(0, 2),
    };
  }

  if (phase === "after") {
    return {
      phase,
      key: "wrap",
      title: "世界杯收官：冠军回顾",
      instruction:
        "本届世界杯已结束。回顾夺冠概率最高（已基本确定）的球队的夺冠之路，并对整届赛事的市场表现做简短复盘。",
      focus: snap.teams.slice(0, 1),
    };
  }

  // group / knockout — schedule-aware: lead with today's match markets if any.
  const matchTeams = snap.matches
    .flatMap((m) => m.title.split(/\s+vs\.?\s+/i))
    .map((s) => s.replace(/[-–].*/, "").trim())
    .map((name) => snap.teams.find((t) => t.team.toLowerCase() === name.toLowerCase()))
    .filter((t): t is WcTeam => Boolean(t))
    .slice(0, 3);

  if (snap.matches.length > 0) {
    return {
      phase,
      key: phase === "group" ? "matchday" : "ko-tie",
      title:
        phase === "group"
          ? `今日焦点战：${snap.matches[0].title}`
          : `淘汰赛前瞻：${snap.matches[0].title}`,
      instruction:
        "围绕今日的比赛做前瞻：分析对阵双方的特点与赛果市场倾向，并结合夺冠概率的变化说明这场比赛的分量。绝不编造尚未发生的比分或结果。",
      focus: matchTeams.length ? matchTeams : snap.teams.slice(0, 2),
    };
  }

  // No match today → track the biggest odds movers (very informative mid-event).
  const movers = snap.topMovers.length ? snap.topMovers : snap.teams.slice(0, 3);
  return {
    phase,
    key: phase === "group" ? "group-standings" : "ko-bracket",
    title: phase === "group" ? "小组出线形势与资金异动" : "晋级路线图与冷门预警",
    instruction:
      "结合最近 24 小时夺冠概率变动最大的球队，解读小组/淘汰赛的出线形势与资金流向；指出潜在冷门。仅基于赔率变动与公认实力，不编造比赛结果。",
    focus: movers.slice(0, 3),
  };
}

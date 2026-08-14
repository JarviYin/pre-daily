import type { Category } from "./types";

// ─────────────────────────────────────────────────────────────
// 新闻版原型数据（/preview/news）
// 由 scripts/gen-preview-news.ts 用最新一刊真实市场数据经 LLM 改写生成，
// 数字已用 DB 真实值人工校正。这是一个产品原型演示文件，非正式数据管线。
// ─────────────────────────────────────────────────────────────

export type PreviewNewsItem = {
  slug: string;
  category: Category;
  sourceUrl: string;
  endDate: string | null;
  leadOption: string;
  leadProb: number; // 0..1
  move24h: number | null; // signed points
  headlineOption: string | null;
  volume24hr: number; // USD
  liquidity: number; // USD
  // LLM 新闻改写（title/story/significance/confidence 为模型产出）
  title: string;
  story: string;
  significance: string;
  confidence: string;
};

export type PreviewNews = {
  date: string;
  generatedAt: string;
  items: PreviewNewsItem[]; // [0] = 今日头条，其余按新闻价值排序
};

export const previewNews: PreviewNews = {
  date: "2026-08-14",
  generatedAt: "2026-08-14T08:00:00+08:00",
  items: [
    {
      slug: "fed-decision-in-december-20260729232808632",
      category: "macro",
      sourceUrl:
        "https://polymarket.com/event/fed-decision-in-december-20260729232808632",
      endDate: "2026-12-09T23:59:00Z",
      leadOption: "No change",
      leadProb: 0.6647,
      move24h: 0.097,
      headlineOption: "No change",
      volume24hr: 31917,
      liquidity: 524838,
      title: "美联储12月按兵不动概率升至66.5%",
      story:
        "市场对美联储12月利率决议的预期出现显著变化：按兵不动概率升至66.5%，较前一日上升9.7个百分点。押注资金明确流入宽松预期，市场数据未显示具体催化事件。",
      significance:
        "若12月维持利率不变成为基准情景，意味着本轮加息周期基本终结，利好股市与债市，并影响全球资产定价锚。",
      confidence: "流动性中等（$0.52M），放量2.9x，距截止约118天。",
    },
    {
      slug: "bank-of-japan-decision-in-september-20260616002734979",
      category: "macro",
      sourceUrl:
        "https://polymarket.com/event/bank-of-japan-decision-in-september-20260616002734979",
      endDate: "2026-09-18T15:59:00Z",
      leadOption: "25 bps increase",
      leadProb: 0.8342,
      move24h: 0.1567,
      headlineOption: "No change",
      volume24hr: 9318,
      liquidity: 36125,
      title: "日本央行9月加息25个基点概率飙至83.4%",
      story:
        "市场对日本央行9月政策会议的预期急剧转向鹰派：加息25个基点的概率升至83.4%，「按兵不动」选项大跌15.7个百分点。市场正定价日本货币政策正常化加速，与美联储暂停形成鲜明反差。",
      significance:
        "日美政策分化可能收窄利差、支撑日元，此前借日元进行的套利交易面临平仓压力，或波及全球风险资产。",
      confidence: "流动性极低（$36K），方向性信号明确但深度不足，需防薄量漂移。",
    },
    {
      slug: "fed-decisions-juloct-20260617191209856",
      category: "macro",
      sourceUrl:
        "https://polymarket.com/event/fed-decisions-juloct-20260617191209856",
      endDate: "2026-10-28T23:59:00Z",
      leadOption: "Pause–Pause–Pause",
      leadProb: 0.5468,
      move24h: 0.0788,
      headlineOption: "Pause–Pause–Pause",
      volume24hr: 18613,
      liquidity: 137299,
      title: "美联储7-10月连续三次暂停概率升至54.7%",
      story:
        "市场对美联储未来三次会议（7月、9月、10月）的路径预期趋于一致：连续暂停加息的情景概率升至54.7%，较前一日上升7.9个百分点，且成交放量4.6倍。",
      significance:
        "连续暂停一旦兑现，将确认政策转向，成为利率与风险资产定价的关键拐点信号。",
      confidence: "流动性较低（$0.14M），但放量明显，市场关注度快速提升。",
    },
    {
      slug: "wyoming-governor-republican-primary-winner",
      category: "politics",
      sourceUrl:
        "https://polymarket.com/event/wyoming-governor-republican-primary-winner",
      endDate: "2026-08-18T00:00:00Z",
      leadOption: "Eric Barlow",
      leadProb: 0.7705,
      move24h: 0.0466,
      headlineOption: "Eric Barlow",
      volume24hr: 55537,
      liquidity: 277703,
      title: "怀俄明州共和党初选：巴洛胜选概率77.1%，4天后揭晓",
      story:
        "怀俄明州州长共和党初选临近揭晓，埃里克·巴洛的胜选概率升至77.1%，较前一日上升4.7个百分点，成交放量4.9倍。市场正在快速定价这一即将发生的结果。",
      significance:
        "这是本刊跟踪范围内最先揭晓的政治事件，其结果将成为美国地方选举风向的一个即时样本。",
      confidence: "4天后截止，流动性$0.28M，放量与异动同向，可信度中等。",
    },
    {
      slug: "where-will-the-next-next-round-of-us-iran-peace-talks-beptptpt-20260623023740663",
      category: "geopolitics",
      sourceUrl:
        "https://polymarket.com/event/where-will-the-next-next-round-of-us-iran-peace-talks-beptptpt-20260623023740663",
      endDate: "2026-09-30T23:59:00Z",
      leadOption: "No Meeting by September 30",
      leadProb: 0.6205,
      move24h: 0.0653,
      headlineOption: "No Meeting by September 30",
      volume24hr: 73660,
      liquidity: 780378,
      title: "美伊下轮和谈9月底前难举行，概率升至62.1%",
      story:
        "市场对美伊和平谈判进展转趋悲观：认为9月30日前不会举行下一轮会谈的概率升至62.1%，较前一日上升6.5个百分点。资金正从地缘风险事件流向货币政策定价。",
      significance:
        "谈判停滞意味着中东紧张局势延续，地缘溢价回落可能受限，对油价与避险资产构成支撑。",
      confidence: "流动性较高（$0.78M），放量1.9x，事件时间跨度约48天。",
    },
    {
      slug: "largest-ipo-by-market-cap-in-2026-287",
      category: "tech",
      sourceUrl:
        "https://polymarket.com/event/largest-ipo-by-market-cap-in-2026-287",
      endDate: "2026-12-31T00:00:00Z",
      leadOption: "SpaceX",
      leadProb: 0.7279,
      move24h: -0.1652,
      headlineOption: "SpaceX",
      volume24hr: 140279,
      liquidity: 708333,
      title: "SpaceX领跑2026最大IPO，但概率单日回落16.5pt",
      story:
        "市场仍认为SpaceX将成为2026年市值最大的IPO（概率72.8%），但该概率单日大跌16.5个百分点，Anthropic同步上涨14.2pt至26.4%，成交放量6.2倍。资金正在两位头部候选之间重新分配。",
      significance:
        "年度最大IPO的归属之争牵动科技股估值叙事，市场对AI公司上市前景的信心变化值得跟踪。",
      confidence: "流动性中等（$0.71M），放量6.2x，但距截止约139天。",
    },
    {
      slug: "spider-man-brand-new-day-total-domestic-gross-by-august-31-20260716181307512",
      category: "other",
      sourceUrl:
        "https://polymarket.com/event/spider-man-brand-new-day-total-domestic-gross-by-august-31-20260716181307512",
      endDate: "2026-08-31T23:59:00Z",
      leadOption: "800 - 900m",
      leadProb: 0.6328,
      move24h: 0.2541,
      headlineOption: "800 - 900m",
      volume24hr: 122814,
      liquidity: 111677,
      title: "《蜘蛛侠：新的一天》北美票房押注8-9亿美元，概率63.3%",
      story:
        "票房市场显示「800-900m」区间成为最可能结果，概率单日大涨25.4个百分点至63.3%，为今日全市场最大单项异动。市场对票房表现的信心显著增强，数据未显示具体催化。",
      significance:
        "暑期档大片的票房走向反映观众情绪，也牵动相关影视公司股价预期。",
      confidence: "流动性较低（$0.11M），概率变动剧烈但放量仅1.4x，可信度打折。",
    },
  ],
};

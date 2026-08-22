// 新闻版（news briefing）生成：把当日刊的真实市场数据改写成面向大众
// 读者的新闻摘要（1 条头条 + 5-8 条要闻）。
//
// 与信号版共用同一条数据管线（当日刊 markets），只是编辑角度不同：
// 信号版面向交易者（热度/异动选刊），新闻版面向大众（新闻价值选刊）。
// 一次 LLM 调用（~$0.002），复用当日数据，不重新抓取。
//
// 诚实纪律（与全站一致）：
//  • slug 必须原样来自当日市场，模型编造的 slug 直接丢弃该条；
//  • 数字快照（概率/量/流动性）由本模块从市场行注入，非模型产出；
//  • 有效条目 < 3 视为生成失败（调用方降级为无新闻版，绝不硬凑）。
import { z } from "zod";
import { client, analysisModelId, estimateCost, type Usage } from "./llm";
import { CATEGORY_META } from "./categories";
import type { DailyIssue, NewsBriefing, NewsItem } from "./types";

const MIN_ITEMS = 3;

const NewsItemSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(6).max(60),
  story: z.string().trim().min(10).max(500),
  significance: z.string().trim().min(5).max(300),
  confidence: z.string().trim().min(2).max(80),
});

const NewsSchema = z.object({ items: z.array(NewsItemSchema).min(1) });

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Prompt 与 /preview/news 原型一致（用户已确认的编辑角度）。 */
function buildPrompt(issue: DailyIssue): string {
  const lines = issue.markets.map((m, i) => {
    const lead = m.outcomes[0];
    const mv =
      m.move24h != null
        ? `，最大异动 ${m.move24h >= 0 ? "+" : ""}${(m.move24h * 100).toFixed(1)}pt${m.headlineOption ? `(${m.headlineOption})` : ""}`
        : "";
    const sg = m.surge >= 1.05 ? `，放量 ${m.surge.toFixed(1)}x` : "";
    const dLeft = m.endDate
      ? `，${Math.max(0, Math.round((Date.parse(m.endDate) - Date.now()) / 86_400_000))}天后截止`
      : "";
    return (
      `${i + 1}. [${CATEGORY_META[m.category].label}] ${m.title}｜` +
      `领先选项 ${lead.option} ${pct(lead.probability)}${mv}${sg}｜` +
      `24h量 $${(m.volume24hr / 1e6).toFixed(1)}M，流动性 $${(m.liquidity / 1e6).toFixed(2)}M${dLeft}`
    );
  });

  return (
    `今日（${issue.date}）Polymarket 真实市场数据（slug 用于定位，勿改动）：\n${lines.join("\n")}\n\n` +
    `今日主线（信号版主编判断，供参考）：${issue.summary}\n\n` +
    "请从中选出最有新闻价值的 1 条头条 + 5-8 条要闻，改写成面向大众读者的新闻摘要，输出 JSON：\n" +
    '{\n  "items": [\n    {\n      "slug": "对应市场的 slug（必须原样来自输入）",\n' +
    '      "title": "新闻式标题（≤40字）：断言 + 具体数字/事实，如「美联储12月按兵不动概率升至66.5%」；禁止空泛口号",\n' +
    '      "story": "发生了什么（2-3句）：把概率变化写成事件叙述——谁/什么变了、变化多大；只基于给定数据，数据未显示原因时写「市场数据未显示具体催化」，绝不编造新闻事件",\n' +
    '      "significance": "为什么重要（1-2句）：对世界经济/市场/读者的含义",\n' +
    '      "confidence": "可信度注记（1句，≤30字）：流动性高低、是否临近截止、是否新晋、是否薄量"\n' +
    "    }\n  ]\n}\n" +
    "头条（新闻价值最高的一条）必须放在 items[0]；其余按新闻价值排序：事件本身的世界影响 × 市场确信度（成交量/流动性）× 今日新鲜度（异动/放量/临近揭晓）。"
  );
}

/**
 * 生成当日新闻版。复用当日刊市场数据，一次 LLM 调用。
 * 有效条目（slug 可回链）< 3 时抛错，调用方按 best-effort 降级。
 */
export async function generateNewsBriefing(issue: DailyIssue): Promise<NewsBriefing> {
  const model = analysisModelId();
  const res = await client().chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "你是《预测市场中文早报》新闻版主编。基于 Polymarket 真实市场数据，把「市场在定价什么」改写成面向大众读者的重大新闻摘要——不是交易信号，而是新闻：今天世界上发生了什么值得知道的事、市场如何反应、为什么重要。" +
          "纪律：①标题必须含具体数字/事实；②story 只基于给定数据，绝不编造数据外的催化事件；③significance 写对世界/读者的含义；④confidence 给可信度注记；⑤全部用简体中文，输出严格 JSON。",
      },
      { role: "user", content: buildPrompt(issue) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 4000,
  });

  const usage: Usage = {
    promptTokens: res.usage?.prompt_tokens ?? 0,
    completionTokens: res.usage?.completion_tokens ?? 0,
  };

  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = NewsSchema.parse(JSON.parse(raw));

  // 诚实性硬校验：slug 必须回链到当日市场；编造的条目直接丢弃。
  const bySlug = new Map(issue.markets.map((m) => [m.slug, m]));
  const items: NewsItem[] = [];
  for (const it of parsed.items) {
    const m = bySlug.get(it.slug);
    if (!m) continue;
    const lead = m.outcomes[0];
    items.push({
      slug: m.slug,
      category: m.category,
      sourceUrl: m.sourceUrl,
      endDate: m.endDate,
      leadOption: lead?.option ?? "—",
      leadProb: lead?.probability ?? 0,
      move24h: m.move24h ?? m.leadingChange,
      volume24hr: m.volume24hr,
      liquidity: m.liquidity,
      title: it.title,
      story: it.story,
      significance: it.significance,
      confidence: it.confidence,
    });
  }

  if (items.length < MIN_ITEMS) {
    throw new Error(
      `news briefing: only ${items.length}/${parsed.items.length} items link to real markets (min ${MIN_ITEMS})`
    );
  }

  return {
    date: issue.date,
    items,
    modelId: model,
    generatedAt: new Date().toISOString(),
    costUsd: estimateCost(usage),
  };
}

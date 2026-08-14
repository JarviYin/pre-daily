// 一次性脚本：把最新一刊的真实市场数据改写成「新闻版」内容，
// 输出 JSON 用于 /preview/news 原型页。用法: pnpm tsx scripts/gen-preview-news.ts
import { config } from "dotenv";
config();

import OpenAI from "openai";
import { getLatestIssue } from "../lib/db/queries";
import { CATEGORY_META } from "../lib/categories";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

async function main() {
  const issue = await getLatestIssue();
  if (!issue) throw new Error("no issue in DB");

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

  const prompt =
    `今日（${issue.date}）Polymarket 真实市场数据（slug 用于定位，勿改动）：\n${lines.join("\n")}\n\n` +
    `今日主线（信号版主编判断，供参考）：${issue.summary}\n\n` +
    "请从中选出最有新闻价值的 1 条头条 + 5-8 条要闻，改写成面向大众读者的新闻摘要，输出 JSON：\n" +
    '{\n  "items": [\n    {\n      "slug": "对应市场的 slug（必须原样来自输入）",\n' +
    '      "title": "新闻式标题（≤40字）：断言 + 具体数字/事实，如「美联储12月按兵不动概率升至66.5%」；禁止空泛口号",\n' +
    '      "story": "发生了什么（2-3句）：把概率变化写成事件叙述——谁/什么变了、变化多大；只基于给定数据，数据未显示原因时写「市场数据未显示具体催化」，绝不编造新闻事件",\n' +
    '      "marketReaction": "市场反应（1句）：只引用输入中的数字（概率、24h变动、成交量、流动性、放量倍数）",\n' +
    '      "significance": "为什么重要（1-2句）：对世界经济/市场/读者的含义",\n' +
    '      "confidence": "可信度注记（1句，≤30字）：流动性高低、是否临近截止、是否新晋、是否薄量"\n' +
    "    }\n  ]\n}\n" +
    "头条（新闻价值最高的一条）必须放在 items[0]；其余按新闻价值排序：事件本身的世界影响 × 市场确信度（成交量/流动性）× 今日新鲜度（异动/放量/临近揭晓）。";

  const client = new OpenAI({
    apiKey: process.env.LLM_API_KEY!,
    baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com",
  });
  const model = process.env.LLM_MODEL || "deepseek-chat";
  const res = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "你是《预测市场中文早报》新闻版主编。基于 Polymarket 真实市场数据，把「市场在定价什么」改写成面向大众读者的重大新闻摘要——不是交易信号，而是新闻：今天世界上发生了什么值得知道的事、市场如何反应、为什么重要。" +
          "纪律：①标题必须含具体数字/事实；②story 只基于给定数据，绝不编造数据外的催化事件；③marketReaction 只引用输入数字；④significance 写对世界/读者的含义；⑤confidence 给可信度注记；⑥全部用简体中文，输出严格 JSON。",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 4000,
  });

  console.log(res.choices[0]?.message?.content ?? "{}");
  process.exit(0);
}

main().catch((e) => {
  console.error("gen-preview-news failed:", e);
  process.exit(1);
});

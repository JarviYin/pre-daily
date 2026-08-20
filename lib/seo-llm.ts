// SEO 循环的 LLM 层：一次调用批量刷新所有主题页的 SEO 文案。
// 输入 = 每主题的今日相关市场（真实数字）；输出 = title/description/h1/intro。
// 任何失败由调用方捕获后整体回退到 lib/seo-topics.ts 的确定性文案。

import OpenAI from "openai";
import { z } from "zod";
import type { TopicCopy, TopicMarketBrief } from "./seo-topics";

export type SeoLlmTopicInput = {
  slug: string;
  zhTitle: string;
  markets: TopicMarketBrief[]; // 今日相关市场（≤3 条用于文案；全量用于聚合）
};

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not set");
  _client = new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com",
  });
  return _client;
}

function modelId(): string {
  return process.env.LLM_MODEL || "deepseek-chat";
}

// DeepSeek-V4 defaults to thinking ENABLED; SEO copy is cheap — explicit OFF.
function thinkingParam(model: string, enabled: boolean): Record<string, unknown> {
  return model.startsWith("deepseek-v4")
    ? { thinking: { type: enabled ? "enabled" : "disabled" } }
    : {};
}

const CopySchema = z.object({
  metaTitle: z.string().trim().min(5).max(70).catch(""),
  metaDescription: z.string().trim().min(10).max(170).catch(""),
  h1: z.string().trim().min(2).max(40).catch(""),
  intro: z.string().trim().min(10).max(300).catch(""),
});

const BatchSchema = z.record(z.string(), CopySchema);

function briefLine(m: TopicMarketBrief): string {
  return (
    `「${m.title}」领先项 ${m.leadOption} ${(m.leadProb * 100).toFixed(1)}%` +
    `${m.move24h != null ? `（24h ${m.move24h >= 0 ? "+" : ""}${(m.move24h * 100).toFixed(1)}pt）` : ""}` +
    `（刊期 ${m.date}）`
  );
}

/**
 * 批量生成主题页 SEO 文案。返回 Map<slug, TopicCopy>；任何主题缺失时
 * 调用方用 fallbackCopy 补位。
 */
export async function generateTopicCopyBatch(
  topics: SeoLlmTopicInput[]
): Promise<Map<string, TopicCopy>> {
  if (topics.length === 0) return new Map();

  const lines = topics
    .map((t) => {
      const ms = t.markets.slice(0, 3).map(briefLine).join("；") || "（今日无新相关市场）";
      return `## ${t.slug}｜${t.zhTitle}\n${ms}`;
    })
    .join("\n\n");

  const prompt =
    `你是预测市场资讯站（prediction-daily.com）的 SEO 编辑。以下是今天各主题下的最新预测市场数据（全部真实），` +
    `请为每个主题页写 4 段 SEO 文案。\n\n${lines}\n\n` +
    "输出 JSON，键为上述 slug，值为：\n" +
    "{\n" +
    '  "metaTitle": "≤60字符的搜索标题：主题关键词 + 今日最新数字（如「美联储利率路径预测：12月按兵不动概率66.5%」），结尾不用网站名",\n' +
    '  "metaDescription": "≤160字符的描述：一句话说清页面内容 + 今日数字 + 价值点（每日更新），吸引点击",\n' +
    '  "h1": "简洁页面大标题（≤20字），含主题关键词",\n' +
    '  "intro": "导语2-3句(≤150字)：①这个主题是什么、为什么值得跟踪 ②今日最新概率（必须引用上面数据中的具体数字）③数据来源与更新频率"\n' +
    "}\n\n" +
    "纪律：只使用上面给出的真实数字，绝不编造；标题必须含具体数字；禁止空话套话（如「值得关注」「深度解读」）；全部简体中文。";

  const model = modelId();
  const res = await client().chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "你是中文预测市场资讯站的 SEO 编辑。目标是让搜索用户通过主题关键词找到页面：标题包含关键词与今日真实数字，描述有信息增量与点击理由。只基于提供的真实数据写作，绝不编造。输出严格 JSON。",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 4000,
    ...thinkingParam(model, false),
  });

  const raw = (res.choices[0]?.message?.content ?? "").trim();
  if (!raw) throw new Error("SEO LLM returned empty response");
  const parsed = BatchSchema.parse(JSON.parse(raw));

  const out = new Map<string, TopicCopy>();
  for (const t of topics) {
    const c = parsed[t.slug];
    if (!c) continue;
    // 任一核心字段缺失时跳过该主题的 LLM 结果（回退到确定性文案）。
    if (!c.metaTitle || !c.intro) continue;
    out.set(t.slug, c);
  }
  return out;
}

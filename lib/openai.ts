import OpenAI from 'openai';
import { PolymarketData, DailySummary, SummaryItem } from '@/types';
import { countChineseWords, extractJsonFromText, retry } from './utils';
import { z } from 'zod';

const SummaryResponseSchema = z.object({
  summary: z.string(),
  items: z.array(z.object({
    title: z.string(),
    content: z.string(),
    volume: z.number().optional(),
    probabilities: z.array(z.object({
      option: z.string(),
      probability: z.number(),
    })).optional(),
  })).max(10),
  wordCount: z.number(),
});

type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

/**
 * 构建摘要提示词
 */
function buildSummaryPrompt(data: PolymarketData): string {
  const sortedMarkets = [...data.markets]
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 10);

  let prompt = `你是专业的市场分析师，需要深度解读 Polymarket 上热度最高、交易量排名前10的市场。

核心要求：
1. 使用中文
2. 严格按照交易量从高到低排序，只解读前10个市场（必须正好10条）
3. 每条解读必须约300字（280-320字），进行深度分析
4. 解读内容必须包含以下维度：
   a) 事件背景与重要性：该预测事件在相关领域/行业/政治/经济中的重要性
   b) 市场热度分析：为什么这个市场交易量高？反映了什么市场情绪和关注焦点？请包含具体的概率数据（如"93%的概率认为..."）和最热门的选项。
   c) 可能结果分析：不同结果的可能性及其对相关领域/行业/政策/资产价格/社会的影响
   d) 深层意义与趋势洞察：这个预测市场反映了什么宏观趋势？对投资者/政策制定者/相关参与方的启示
   e) 风险与机遇：相关参与方需要注意的具体风险点和潜在机遇
5. 总体摘要控制在300字以内，总结这10个市场的整体趋势和关注焦点
6. 分析要专业、深入、有洞察力，要有数据支撑和逻辑推理，不能只是表面描述
7. 要结合当前国际形势、经济环境、政策背景进行深度拓展
8. 所有市场标题必须翻译成中文，不能保留英文。

当前数据（已按交易量从高到低排序，热度排名前10）：
`;

  sortedMarkets.forEach((market, i) => {
    prompt += `\n${i + 1}. ${market.question}\n`;
    if (market.volume) {
      prompt += `   交易量：$${market.volume.toLocaleString()}\n`;
    }
    if (market.probabilities && market.probabilities.length > 0) {
      const sortedProbs = [...market.probabilities].sort((a, b) => b.probability - a.probability);
      prompt += `   概率分布：\n`;
      sortedProbs.slice(0, 3).forEach(prob => {
        prompt += `     - ${prob.option}: ${(prob.probability * 100).toFixed(1)}%\n`;
      });
    }
    if (market.description) {
      prompt += `   描述：${market.description}\n`;
    }
    prompt += `\n`;
  });

  prompt += `\n请以 JSON 格式返回，严格遵循以下要求：

返回格式：
{
  "summary": "总体摘要（300字以内，总结这10个热门市场的整体趋势、关注焦点和共同特征）",
  "items": [
    {
      "title": "市场完整标题（已翻译成中文）",
      "content": "深度解读（280-320字，必须包含：事件背景与重要性、市场热度分析（含具体概率数据）、可能结果分析、深层意义与趋势洞察、风险与机遇）",
      "volume": 交易量数字（如果有）,
      "probabilities": [{"option": "选项名", "probability": 概率值}]
    }
    // ... 必须正好10条，按交易量从高到低排序
  ],
  "wordCount": 总字数（约3300字：300字摘要 + 10条×300字解读）
}

关键要求：
1. 必须正好10条解读，不能多也不能少
2. 每条解读必须280-320字，不能过短或过长
3. 解读要深入、专业、有洞察力，不能只是表面描述
4. 要分析为什么这个市场热度高（交易量反映的市场情绪），并包含具体的概率数据和最热门选项
5. 要分析不同结果的可能性和影响
6. 要提供对相关参与方的启示和风险提示
7. 所有市场标题必须翻译成中文

现在开始分析：`;

  return prompt;
}

/**
 * 生成默认摘要（降级方案）
 */
function generateDefaultSummary(data: PolymarketData): SummaryResponse {
  const sortedMarkets = [...data.markets]
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 10);

  const translateTitle = (title: string): string => {
    const translations: Record<string, string> = {
      'Fed decision in December?': '美联储12月议息会议决策',
      'F1 Drivers Champion': 'F1车手总冠军预测',
      'English Premier League Winner': '英超联赛冠军预测',
      'What price will Bitcoin hit in 2025?': '比特币2025年价格预测',
      'Romania: Bucharest Mayoral Election': '罗马尼亚布加勒斯特市长选举',
      'Largest Company end of 2025?': '2025年末全球最大市值公司',
      'Russia x Ukraine ceasefire in 2025?': '俄罗斯与乌克兰2025年停火协议',
      'US x Venezuela military engagement by...?': '美国与委内瑞拉军事冲突时间预测',
      'Maduro out by...?': '委内瑞拉总统马杜罗下台时间',
      'Who will Trump nominate as Fed Chair?': '特朗普将提名谁为美联储主席',
    };
    return translations[title] || title;
  };

  const items: SummaryItem[] = sortedMarkets.map((market, index) => {
    const chineseTitle = translateTitle(market.question);
    const topOption = market.probabilities && market.probabilities.length > 0
      ? market.probabilities.sort((a, b) => b.probability - a.probability)[0]
      : null;
    
    const probabilityText = topOption 
      ? `，最热门选项为"${topOption.option}"，市场给出的概率高达${(topOption.probability * 100).toFixed(0)}%` 
      : '';

    return {
      title: chineseTitle,
      content: `${chineseTitle} 是当前 Polymarket 上交易量排名第${index + 1}的热门预测市场，交易量高达$${market.volume?.toLocaleString() || '未知'}${probabilityText}。这一市场的高热度反映了投资者和参与者对该事件未来走向的强烈关注和资金投入。该预测结果将对相关领域产生重要影响，值得密切关注市场动态和可能的结果。市场的高交易量不仅体现了事件的重要性，也反映了参与者对不确定性的风险定价和预期管理。从更深层次来看，这个预测市场反映了当前市场对相关领域的关注焦点和预期趋势，对投资者、政策制定者和相关参与方都具有重要的参考价值。`,
      volume: market.volume,
      probabilities: market.probabilities,
    };
  });

  return {
    summary: `Polymarket 当前热度最高的10个预测市场涵盖了宏观经济政策、地缘政治冲突、体育竞技、加密货币价格和科技公司市值等多个关键领域。这些市场的高交易量反映了全球投资者和参与者对未来重大事件的强烈关注和预期，体现了预测市场作为信息聚合工具的重要价值。`,
    items,
    wordCount: countChineseWords(
      items.map(i => i.content).join('') + 
      'Polymarket 当前热度最高的10个预测市场涵盖了宏观经济政策、地缘政治冲突、体育竞技、加密货币价格和科技公司市值等多个关键领域。这些市场的高交易量反映了全球投资者和参与者对未来重大事件的强烈关注和预期，体现了预测市场作为信息聚合工具的重要价值。'
    ),
  };
}

/**
 * 使用 OpenAI 生成摘要
 */
export async function summarizePolymarketNews(
  data: PolymarketData
): Promise<SummaryResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set, using default summary');
    return generateDefaultSummary(data);
  }

  const openai = new OpenAI({ apiKey });

  // 确保有足够的数据
  if (!data.markets || data.markets.length === 0) {
    console.warn('No market data available, using default summary');
    return generateDefaultSummary(data);
  }

  const prompt = buildSummaryPrompt(data);

  return retry(async () => {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的市场分析师，需要深度解读 Polymarket 上热度最高、趋势排名前10的市场。你总是返回有效的 JSON 格式。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsed = extractJsonFromText(content);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON response from OpenAI');
      }

      const validated = SummaryResponseSchema.parse({
        summary: parsed.summary || '',
        items: parsed.items || [],
        wordCount: typeof parsed.wordCount === 'number'
          ? parsed.wordCount
          : (typeof parsed.wordCount === 'string'
            ? parseInt(parsed.wordCount, 10)
            : 0),
      });

      // 确保 items 有正确的概率数据
      const itemsWithProbs = validated.items.map((item, index) => {
        const market = data.markets[index];
        return {
          ...item,
          volume: item.volume || market?.volume,
          probabilities: item.probabilities || market?.probabilities,
        };
      });

      const totalWords = countChineseWords(
        validated.summary + itemsWithProbs.map(i => i.content).join('')
      );

      return {
        ...validated,
        items: itemsWithProbs,
        wordCount: totalWords,
      };
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }, 3, 1000).catch(() => {
    console.warn('All OpenAI retries failed, using default summary');
    return generateDefaultSummary(data);
  });
}


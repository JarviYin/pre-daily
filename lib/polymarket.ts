import * as cheerio from 'cheerio';
import { PolymarketData, Market, PolymarketDataSchema } from '@/types';
import { retry, formatNumber } from './utils';

/**
 * 从文本中提取交易量
 */
function parseVolume(text: string): number | undefined {
  // 匹配 $262M, $262m, $262 million, $262,000,000 等格式
  const patterns = [
    /\$([\d,]+\.?\d*)\s*([kmb])/i, // $262M, $1.5K
    /\$([\d,]+\.?\d*)\s*million/i, // $262 million
    /\$([\d,]+\.?\d*)\s*billion/i, // $1.2 billion
    /\$([\d,]+)/, // $262000000
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      const unit = match[2]?.toLowerCase();
      
      if (unit === 'k') return num * 1000;
      if (unit === 'm') return num * 1000000;
      if (unit === 'b') return num * 1000000000;
      if (text.toLowerCase().includes('million')) return num * 1000000;
      if (text.toLowerCase().includes('billion')) return num * 1000000000;
      return num;
    }
  }
  
  return undefined;
}

/**
 * 从文本中提取概率
 */
function parseProbability(text: string): { option: string; probability: number } | null {
  // 匹配 "93% Yes", "76% Lando Norris", "Yes 93%" 等格式
  const patterns = [
    /(\d+\.?\d*)%\s*(.+)/, // 93% Yes
    /(.+)\s+(\d+\.?\d*)%/, // Yes 93%
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const probability = parseFloat(match[1] || match[2]) / 100;
      const option = (match[2] || match[1]).trim();
      
      if (probability >= 0 && probability <= 1 && option) {
        return { option, probability };
      }
    }
  }
  
  return null;
}

/**
 * 从 HTML 中提取市场数据
 */
function extractMarketsFromHTML(html: string): Market[] {
  const $ = cheerio.load(html);
  const markets: Market[] = [];
  const seenQuestions = new Set<string>();

  // 多种选择器策略
  const selectors = [
    '[data-testid*="market"]',
    '[class*="market-card"]',
    '[class*="MarketCard"]',
    'article[class*="market"]',
    'div[class*="market"]',
  ];

  for (const selector of selectors) {
    $(selector).each((i, elem) => {
      const $elem = $(elem);
      const question = $elem.find('h1, h2, h3, h4, [class*="question"], [class*="title"]')
        .first()
        .text()
        .trim()
        .replace(/\s+/g, ' ');

      if (!question || seenQuestions.has(question)) {
        return;
      }

      const description = $elem.find('p, [class*="description"], [class*="subtitle"]')
        .first()
        .text()
        .trim();

      // 提取交易量
      const fullText = $elem.text();
      const volume = parseVolume(fullText);

      // 提取概率
      const probabilities: { option: string; probability: number }[] = [];
      $elem.find('[class*="option"], [class*="outcome"], [class*="probability"]').each((j, probElem) => {
        const probText = $(probElem).text().trim();
        const prob = parseProbability(probText);
        if (prob) {
          probabilities.push(prob);
        }
      });

      // 如果没有找到概率，尝试从整个元素文本中提取
      if (probabilities.length === 0) {
        const probMatches = fullText.matchAll(/(\d+\.?\d*)%\s*([A-Za-z0-9\s]+)/g);
        for (const match of probMatches) {
          const probability = parseFloat(match[1]) / 100;
          const option = match[2].trim();
          if (probability >= 0 && probability <= 1 && option && option.length < 50) {
            probabilities.push({ option, probability });
          }
        }
      }

      // 提取 URL
      const url = $elem.find('a').first().attr('href');
      const fullUrl = url?.startsWith('http') ? url : url ? `https://polymarket.com${url}` : undefined;

      seenQuestions.add(question);
      markets.push({
        id: `market-${markets.length + 1}`,
        question,
        description: description || undefined,
        volume,
        probabilities: probabilities.length > 0 ? probabilities : undefined,
        url: fullUrl,
      });
    });

    if (markets.length >= 10) break;
  }

  return markets;
}

/**
 * 尝试从 API 获取数据
 */
async function tryFetchFromAPI(): Promise<PolymarketData | null> {
  try {
    // Polymarket GraphQL API 端点（如果可用）
    const apiUrl = 'https://clob.polymarket.com/markets';
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // 解析 API 响应（根据实际 API 结构调整）
    if (Array.isArray(data)) {
      const markets: Market[] = data
        .slice(0, 20)
        .map((item: any, index: number) => ({
          id: item.id || `api-market-${index}`,
          question: item.question || item.title || '',
          description: item.description,
          volume: item.volume || item.totalVolume,
          endDate: item.endDate || item.end_date_iso,
          url: item.url || item.slug ? `https://polymarket.com/event/${item.slug}` : undefined,
        }))
        .filter((m: Market) => m.question && (m.volume || 0) > 0)
        .sort((a: Market, b: Market) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 10);

      if (markets.length > 0) {
        return PolymarketDataSchema.parse({ markets });
      }
    }
  } catch (error) {
    console.warn('API fetch failed:', error);
  }

  return null;
}

/**
 * 获取降级数据（当真实数据获取失败时使用）
 */
function getFallbackData(): PolymarketData {
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

  return {
    markets: [
      {
        id: 'fallback-1',
        question: translateTitle('Fed decision in December?'),
        description: '市场高度关注美联储12月是否降息25个基点，交易量高达2.62亿美元',
        volume: 262000000,
        probabilities: [
          { option: '25 bps decrease', probability: 0.93 },
          { option: '50+ bps decrease', probability: 0.01 },
          { option: 'No change', probability: 0.06 },
        ],
      },
      {
        id: 'fallback-2',
        question: translateTitle('F1 Drivers Champion'),
        description: '兰多·诺里斯 vs 维斯塔潘，市场对F1赛季结果的预测',
        volume: 153000000,
        probabilities: [
          { option: 'Lando Norris', probability: 0.76 },
          { option: 'Max Verstappen', probability: 0.21 },
          { option: 'Others', probability: 0.03 },
        ],
      },
      {
        id: 'fallback-3',
        question: translateTitle('English Premier League Winner'),
        description: '阿森纳 vs 曼城，英超赛季冠军归属预测',
        volume: 128000000,
        probabilities: [
          { option: 'Arsenal', probability: 0.65 },
          { option: 'Man City', probability: 0.25 },
          { option: 'Others', probability: 0.10 },
        ],
      },
      {
        id: 'fallback-4',
        question: translateTitle('What price will Bitcoin hit in 2025?'),
        description: '市场预测比特币在2025年是否能突破10.5万美元',
        volume: 85000000,
        probabilities: [
          { option: '↑ 105,000', probability: 0.18 },
          { option: '↑ 100,000', probability: 0.33 },
          { option: '↑ 95,000', probability: 0.25 },
        ],
      },
      {
        id: 'fallback-5',
        question: translateTitle('Romania: Bucharest Mayoral Election'),
        description: '齐普里安·奇乌库 vs 丹尼尔·巴卢塔，市长选举结果预测',
        volume: 82000000,
        probabilities: [
          { option: 'Ciprian Ciucu', probability: 0.42 },
          { option: 'Daniel Baluta', probability: 0.41 },
          { option: 'Others', probability: 0.17 },
        ],
      },
      {
        id: 'fallback-6',
        question: translateTitle('Largest Company end of 2025?'),
        description: '英伟达 vs 苹果，市场对AI浪潮下市值冠军的预测',
        volume: 50000000,
        probabilities: [
          { option: 'NVIDIA', probability: 0.88 },
          { option: 'Apple', probability: 0.10 },
          { option: 'Others', probability: 0.02 },
        ],
      },
      {
        id: 'fallback-7',
        question: translateTitle('Russia x Ukraine ceasefire in 2025?'),
        description: '市场预测俄乌冲突是否能在2025年达成停火协议',
        volume: 50000000,
        probabilities: [
          { option: 'Yes', probability: 0.06 },
          { option: 'No', probability: 0.94 },
        ],
      },
      {
        id: 'fallback-8',
        question: translateTitle('US x Venezuela military engagement by...?'),
        description: '市场预测美委军事冲突可能发生的时间节点',
        volume: 34000000,
        probabilities: [
          { option: 'December 9', probability: 0.05 },
          { option: 'December 15', probability: 0.13 },
          { option: 'Later', probability: 0.82 },
        ],
      },
      {
        id: 'fallback-9',
        question: translateTitle('Maduro out by...?'),
        description: '市场预测马杜罗是否会在2025年底或2026年3月前下台',
        volume: 21000000,
        probabilities: [
          { option: 'December 31, 2025', probability: 0.15 },
          { option: 'March 31, 2026', probability: 0.39 },
          { option: 'Later', probability: 0.46 },
        ],
      },
      {
        id: 'fallback-10',
        question: translateTitle('Who will Trump nominate as Fed Chair?'),
        description: '市场预测特朗普可能提名的人选，凯文·哈塞特 vs 凯文·沃什',
        volume: 17000000,
        probabilities: [
          { option: 'Kevin Hassett', probability: 0.72 },
          { option: 'Kevin Warsh', probability: 0.13 },
          { option: 'Others', probability: 0.15 },
        ],
      },
    ],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * 获取 Polymarket 数据（主函数）
 */
export async function fetchPolymarketData(): Promise<PolymarketData> {
  return retry(async () => {
    try {
      // 方法1: 从网页抓取
      const response = await fetch('https://polymarket.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const markets = extractMarketsFromHTML(html);

      // 按交易量排序并取前10
      const sortedMarkets = markets
        .filter(m => m.volume !== undefined && m.volume > 0)
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 10);

      // 如果抓取到的数据不足，尝试 API
      if (sortedMarkets.length < 5) {
        const apiData = await tryFetchFromAPI();
        if (apiData && apiData.markets.length > sortedMarkets.length) {
          return apiData;
        }
      }

      // 如果数据足够，返回
      if (sortedMarkets.length >= 5) {
        return PolymarketDataSchema.parse({
          markets: sortedMarkets,
          fetchedAt: new Date().toISOString(),
        });
      }

      // 数据不足，使用降级数据
      console.warn('Insufficient data from scraping, using fallback');
      return getFallbackData();
    } catch (error) {
      console.error('Failed to fetch Polymarket data:', error);
      // 使用降级数据
      return getFallbackData();
    }
  }, 3, 1000);
}


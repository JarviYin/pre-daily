/**
 * 工具函数
 */

/**
 * 计算中文字数（包括标点）
 */
export function countChineseWords(text: string): number {
  // 匹配中文字符、数字、英文单词和标点
  const matches = text.match(/[\u4e00-\u9fa5]|[a-zA-Z]+|\d+/g);
  return matches ? matches.reduce((sum, match) => {
    // 中文字符每个算1字，英文单词每个算1字，数字每个算1字
    if (/[\u4e00-\u9fa5]/.test(match)) {
      return sum + match.length;
    }
    return sum + 1;
  }, 0) : 0;
}

/**
 * 格式化数字为可读格式
 */
export function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return `$${(num / 1000000000).toFixed(2)}B`;
  }
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(2)}K`;
  }
  return `$${num.toLocaleString()}`;
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await delay(delayMs * attempt); // 指数退避
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * 安全解析 JSON
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * 提取 JSON 从文本中
 */
export function extractJsonFromText(text: string): any | null {
  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch {
    // 尝试提取 JSON 对象
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}


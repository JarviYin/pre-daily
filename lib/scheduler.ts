import cron from 'node-cron';
import { fetchPolymarketData } from './polymarket';
import { summarizePolymarketNews } from './openai';
import { DailySummary } from '@/types';
import { format } from 'date-fns';

let dailySummaryCache: DailySummary | null = null;
let isUpdating = false;

/**
 * 执行每日更新任务
 */
export async function runDailyUpdate(): Promise<DailySummary> {
  if (isUpdating) {
    console.log('Update already in progress, skipping...');
    return dailySummaryCache || getEmptySummary();
  }

  isUpdating = true;
  
  try {
    console.log('开始执行每日更新任务...');
    const data = await fetchPolymarketData();
    console.log(`获取到 ${data.markets.length} 条市场数据`);
    
    const summary = await summarizePolymarketNews(data);
    console.log(`生成摘要完成，共 ${summary.items.length} 条解读`);
    
    const dailySummary: DailySummary = {
      date: format(new Date(), 'yyyy-MM-dd'),
      summary: summary.summary,
      items: summary.items,
      wordCount: summary.wordCount,
      updatedAt: new Date().toISOString(),
    };
    
    dailySummaryCache = dailySummary;
    console.log('每日更新任务完成');
    return dailySummary;
  } catch (error) {
    console.error('每日更新任务失败:', error);
    console.error('错误详情:', error instanceof Error ? error.stack : error);
    
    // 返回缓存的摘要或空摘要
    return dailySummaryCache || getEmptySummary();
  } finally {
    isUpdating = false;
  }
}

/**
 * 获取空摘要（降级方案）
 */
function getEmptySummary(): DailySummary {
  return {
    date: format(new Date(), 'yyyy-MM-dd'),
    summary: '未能获取最新数据，请稍后重试。',
    items: [],
    wordCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 启动定时任务
 */
export function startScheduler() {
  // 每天早上8点（北京时间）执行
  cron.schedule('0 8 * * *', async () => {
    try {
      await runDailyUpdate();
    } catch (error) {
      console.error('定时任务执行失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai',
  });
  
  console.log('定时任务已启动：每天早上8点（北京时间）执行');
}

/**
 * 获取缓存的每日摘要
 */
export function getDailySummary(): DailySummary | null {
  return dailySummaryCache;
}

/**
 * 手动触发更新
 */
export async function triggerManualUpdate(): Promise<DailySummary> {
  return await runDailyUpdate();
}


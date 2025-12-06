import { NextRequest, NextResponse } from 'next/server';
import { triggerManualUpdate } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';

/**
 * 外部 Cron 服务调用的端点
 * 用于 Vercel Cron 或其他定时任务服务
 */
export async function GET(request: NextRequest) {
  // 验证请求来源（可选，增加安全性）
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    await triggerManualUpdate();
    return NextResponse.json({
      success: true,
      message: 'Daily update triggered successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed',
      },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getDailySummary, triggerManualUpdate } from '@/lib/scheduler';
import { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET: 获取缓存的每日摘要
 */
export async function GET() {
  try {
    const summary = getDailySummary();
    
    if (summary) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: summary,
      });
    }

    // 如果没有缓存，触发更新
    try {
      const newSummary = await triggerManualUpdate();
      return NextResponse.json<ApiResponse>({
        success: true,
        data: newSummary,
      });
    } catch (error) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: error instanceof Error ? error.message : '生成摘要失败',
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误',
    }, { status: 500 });
  }
}

/**
 * POST: 手动触发更新
 */
export async function POST() {
  try {
    const summary = await triggerManualUpdate();
    return NextResponse.json<ApiResponse>({
      success: true,
      data: summary,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : '更新失败',
    }, { status: 500 });
  }
}


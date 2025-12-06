'use client';

import { useEffect, useState, useCallback } from 'react';
import { DailySummary, ApiResponse } from '@/types';
import { formatNumber } from '@/lib/utils';

export default function Home() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerUpdate = useCallback(async () => {
    setUpdating(true);
    setError(null);
    try {
      const response = await fetch('/api/daily', { method: 'POST' });
      const data: ApiResponse = await response.json();
      if (data.success && data.data) {
        setSummary(data.data);
        setError(null);
      } else {
        setError(data.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setUpdating(false);
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/daily');
      const data: ApiResponse = await response.json();

      if (data.success && data.data) {
        setSummary(data.data);
        setError(null);
        setLoading(false);
      } else {
        // 如果没有缓存数据，触发更新
        await triggerUpdate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
      setLoading(false);
    }
  }, [triggerUpdate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>{updating ? '正在生成今日内容...' : '正在加载最新资讯...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Prediction Daily</h1>
        <p className="header-subtitle">
          每日前沿新闻汇总 · 每天早上8点自动更新 · Powered by Polymarket &amp; OpenAI
        </p>
      </header>

      {error && (
        <div className="error">
          <p>⚠️ {error}</p>
        </div>
      )}

      {summary && (
        <div>
          <div className="card">
            <h2>今日摘要</h2>
            <div className="summary-content">
              {summary.summary}
            </div>
            <div className="meta">
              <div className="meta-item">
                <span className="meta-label">📅 日期：</span>
                <span className="meta-value">{summary.date}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">🕐 更新：</span>
                <span className="meta-value">
                  {new Date(summary.updatedAt).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">📝 字数：</span>
                <span className="meta-value">{summary.wordCount} 字</span>
              </div>
            </div>
          </div>

          {summary.items.length > 0 && (
            <div className="card">
              <h2>交易量排名前10市场解读</h2>
              {summary.items.map((item, index) => (
                <div key={index} className="news-item">
                  <div className="news-item-title">
                    <span className="news-item-number">{index + 1}</span>
                    <span>{item.title}</span>
                    {item.volume && (
                      <span className="volume-badge">
                        交易量: {formatNumber(item.volume)}
                      </span>
                    )}
                  </div>
                  <div className="news-item-content">
                    {item.content}
                    {item.probabilities && item.probabilities.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        backgroundColor: '#f5f5f5',
                        borderLeft: '3px solid #000000',
                        fontSize: '14px',
                        color: '#666666',
                      }}>
                        <strong>市场概率分布：</strong>
                        {item.probabilities
                          .sort((a, b) => b.probability - a.probability)
                          .slice(0, 3)
                          .map((prob, i) => (
                            <span key={i} style={{ marginLeft: '12px' }}>
                              {prob.option}: {(prob.probability * 100).toFixed(1)}%
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!summary && !error && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-text">
              暂无数据，系统将于每天早上8点自动更新，请稍后再来查看
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


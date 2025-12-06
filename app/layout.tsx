import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prediction Daily - 每日前沿新闻汇总',
  description: '每日汇总 Polymarket 重要信息和前沿新闻，每天早上8点自动更新',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}


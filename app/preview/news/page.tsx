import type { Metadata } from "next";
import { NewsView } from "@/components/NewsView";
import { previewNews } from "@/lib/previewNewsData";

// 新闻版产品原型预览页（/preview/news）。noindex：原型不进入搜索引擎。
// 新闻版已正式化（/news 每日 8:00 随主刊自动生成），本页保留为最初原型的
// 存档演示（2026-08-14 数据），正式内容请访问 /news。
export const metadata: Metadata = {
  title: "新闻版预览（原型存档） · Prediction Daily",
  robots: { index: false, follow: false },
};

export default function PreviewNewsPage() {
  return (
    <NewsView
      date={previewNews.date}
      items={previewNews.items}
      badge="新闻版 · 原型存档"
      footnote={`原型说明：本页为 2026-08-14 的产品方向演示数据（数字已人工校正）。新闻版已正式化 → /news 每日 8:00 自动生成。`}
    />
  );
}

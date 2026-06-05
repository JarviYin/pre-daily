import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { JsonLd } from "@/components/JsonLd";
import { graph, orgNode, websiteNode } from "@/lib/seo";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Prediction Daily 预测市场中文早报",
    template: "%s · Prediction Daily",
  },
  description:
    "每天 8:00，3 分钟看懂真金白银今日在重新定价什么。基于 Polymarket 实时数据的预测市场中文信号早报：聚焦今日异动——概率显著变动、资金放量、新晋与临近揭晓的世界事件市场，附 AI 中文解读。",
  applicationName: "Prediction Daily",
  keywords: [
    "Polymarket", "预测市场", "prediction market", "中文", "早报", "信号",
    "概率", "异动", "地缘", "政治", "宏观", "加密",
  ],
  authors: [{ name: "Prediction Daily 预测市场中文早报", url: SITE_URL }],
  creator: "Prediction Daily",
  publisher: "Prediction Daily 预测市场中文早报",
  category: "finance",
  openGraph: {
    type: "website",
    siteName: "Prediction Daily 预测市场中文早报",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: {
    types: { "application/rss+xml": `${SITE_URL}/feed.xml` },
  },
};

export const viewport = { themeColor: "#0a0b0e" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <JsonLd data={graph(orgNode(), websiteNode())} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    "每天 8:00，用 3 分钟读懂全球真金白银在押注什么。基于 Polymarket 实时数据的预测市场中文信号解读：当前概率、24h 变动、流动性可信度与中文解读。",
  applicationName: "Prediction Daily",
  keywords: ["Polymarket", "预测市场", "prediction market", "中文", "早报", "信号"],
  openGraph: {
    type: "website",
    siteName: "Prediction Daily 预测市场中文早报",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}

import { listIssueHeads } from "@/lib/db/queries";
import { formatCnDate } from "@/lib/date";
import { SITE } from "@/lib/seo";

// RSS 2.0 feed of recent editions. Re-built hourly (ISR); the cron also covers
// freshness. Discovered via <link rel="alternate" type="application/rss+xml">.
export const revalidate = 3600;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  let heads: { date: string; summary: string }[] = [];
  try {
    heads = await listIssueHeads();
  } catch {
    /* DB unavailable → empty but valid feed */
  }
  const recent = heads.slice(0, 30);
  const lastBuild = recent[0]
    ? new Date(`${recent[0].date}T00:00:00Z`).toUTCString()
    : new Date(0).toUTCString();

  const items = recent
    .map((h) => {
      const url = `${SITE}/daily/${h.date}`;
      const title = `${formatCnDate(h.date)} 预测市场中文早报：今日异动`;
      const pub = new Date(`${h.date}T00:00:00Z`).toUTCString();
      return [
        "    <item>",
        `      <title>${esc(title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${pub}</pubDate>`,
        `      <description>${esc(h.summary)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Prediction Daily 预测市场中文早报</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>每天 8:00 的预测市场中文信号早报，聚焦今日异动。基于 Polymarket 实时数据 + AI 中文解读。</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

import type { MetadataRoute } from "next";
import { listIssueDates, listWcBriefingDates, listNewsDates } from "@/lib/db/queries";
import { listAllSeoTopicSlugs } from "@/lib/db/seo-queries";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let dates: string[] = [];
  let wcDates: string[] = [];
  let newsDates: string[] = [];
  let topics: Awaited<ReturnType<typeof listAllSeoTopicSlugs>> = [];
  try {
    dates = await listIssueDates();
  } catch {
    /* DB unavailable at build → ship the static routes only */
  }
  try {
    wcDates = await listWcBriefingDates();
  } catch {
    /* ignore */
  }
  try {
    newsDates = await listNewsDates();
  } catch {
    /* ignore */
  }
  try {
    topics = await listAllSeoTopicSlugs();
  } catch {
    /* ignore */
  }

  const editions: MetadataRoute.Sitemap = dates.map((d) => ({
    url: `${SITE}/daily/${d}`,
    lastModified: `${d}T00:00:00Z`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const wcPages: MetadataRoute.Sitemap = wcDates.map((d) => ({
    url: `${SITE}/worldcup/${d}`,
    lastModified: `${d}T00:00:00Z`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // SEO 主题聚合页（每日循环刷新内容与 lastUpdated）。
  const topicPages: MetadataRoute.Sitemap = topics.map((t) => ({
    url: `${SITE}/topic/${t.slug}`,
    lastModified: `${t.lastUpdated}T00:00:00Z`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // 新闻版（/news 最新 + 历史各期）。
  const newsPages: MetadataRoute.Sitemap = newsDates.map((d) => ({
    url: `${SITE}/news/${d}`,
    lastModified: `${d}T00:00:00Z`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const latest = dates[0];
  const wcLatest = wcDates[0];
  const newsLatest = newsDates[0];
  return [
    {
      url: SITE,
      lastModified: latest ? `${latest}T00:00:00Z` : undefined,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE}/news`,
      lastModified: newsLatest ? `${newsLatest}T00:00:00Z` : undefined,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE}/worldcup`,
      lastModified: wcLatest ? `${wcLatest}T00:00:00Z` : undefined,
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: `${SITE}/worldcup/archive`, changeFrequency: "daily", priority: 0.4 },
    { url: `${SITE}/topic`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/archive`, changeFrequency: "daily", priority: 0.5 },
    ...topicPages,
    ...editions,
    ...newsPages,
    ...wcPages,
  ];
}

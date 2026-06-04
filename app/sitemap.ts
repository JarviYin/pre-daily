import type { MetadataRoute } from "next";
import { listIssueDates, listWcBriefingDates } from "@/lib/db/queries";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let dates: string[] = [];
  let wcDates: string[] = [];
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

  const latest = dates[0];
  const wcLatest = wcDates[0];
  return [
    {
      url: SITE,
      lastModified: latest ? `${latest}T00:00:00Z` : undefined,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE}/worldcup`,
      lastModified: wcLatest ? `${wcLatest}T00:00:00Z` : undefined,
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: `${SITE}/worldcup/archive`, changeFrequency: "daily", priority: 0.4 },
    { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/archive`, changeFrequency: "daily", priority: 0.5 },
    ...editions,
    ...wcPages,
  ];
}

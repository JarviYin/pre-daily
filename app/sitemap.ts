import type { MetadataRoute } from "next";
import { listIssueDates } from "@/lib/db/queries";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let dates: string[] = [];
  try {
    dates = await listIssueDates();
  } catch {
    /* DB unavailable at build → ship the static routes only */
  }

  const editions: MetadataRoute.Sitemap = dates.map((d) => ({
    url: `${SITE}/daily/${d}`,
    lastModified: `${d}T00:00:00Z`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/archive`, changeFrequency: "daily", priority: 0.5 },
    ...editions,
  ];
}

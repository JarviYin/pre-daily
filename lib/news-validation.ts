import { z } from "zod";

const MIN_ITEMS = 3;

const NewsItemSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(6).max(60),
  story: z.string().trim().min(10).max(500),
  significance: z.string().trim().min(5).max(300),
  confidence: z.string().trim().min(2).max(80),
});

const NewsSchema = z.object({ items: z.array(z.unknown()).min(1) });

/** Keep the ranked, distinct items that pass validation and link to today's markets. */
export function parseNewsItems(raw: string, marketSlugs: ReadonlySet<string>) {
  const { items: candidates } = NewsSchema.parse(JSON.parse(raw));
  const items: z.infer<typeof NewsItemSchema>[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const result = NewsItemSchema.safeParse(candidate);
    if (!result.success) continue;
    const item = result.data;
    if (!marketSlugs.has(item.slug) || seen.has(item.slug)) continue;
    seen.add(item.slug);
    items.push(item);
  }
  if (items.length < MIN_ITEMS) {
    throw new Error(
      `news briefing: only ${items.length}/${candidates.length} valid distinct items link to real markets (min ${MIN_ITEMS})`
    );
  }
  return items;
}

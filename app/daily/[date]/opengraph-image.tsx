import { getIssue } from "@/lib/db/queries";
import { renderOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-card";
import { isValidDate } from "@/lib/date";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Prediction Daily — 预测市场中文早报";

export default async function Image({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDate(date)) return renderOg(null);
  let issue = null;
  try {
    issue = await getIssue(date);
  } catch {
    /* render brand-only card on failure */
  }
  return renderOg(issue);
}

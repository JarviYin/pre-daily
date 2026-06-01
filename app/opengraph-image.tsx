import { getLatestIssue } from "@/lib/db/queries";
import { renderOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Prediction Daily — 预测市场中文早报";

export default async function Image() {
  let issue = null;
  try {
    issue = await getLatestIssue();
  } catch {
    /* render brand-only card on failure */
  }
  return renderOg(issue);
}

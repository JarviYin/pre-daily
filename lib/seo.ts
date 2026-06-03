// Structured-data (schema.org) builders for SEO + GEO. Nodes omit @context so
// they can be combined under a single @graph; use graph() to wrap them.
import type { DailyIssue } from "./types";
import { CATEGORY_META } from "./categories";
import { formatCnDate } from "./date";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";
const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;

const ORG_DESC =
  "预测市场中文早报：基于 Polymarket 实时数据，每天聚焦今日异动——概率显著变动、资金放量、新晋与临近揭晓的世界事件市场，附 AI 中文解读。";

export function orgNode() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Prediction Daily 预测市场中文早报",
    alternateName: "预测市场中文早报",
    url: `${SITE}/`,
    logo: { "@type": "ImageObject", url: `${SITE}/apple-icon`, width: 180, height: 180 },
    description: ORG_DESC,
    sameAs: ["https://t.me/predaily"],
  };
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${SITE}/`,
    name: "Prediction Daily 预测市场中文早报",
    alternateName: "预测市场中文早报",
    inLanguage: "zh-CN",
    description: ORG_DESC,
    publisher: { "@id": ORG_ID },
  };
}

export function newsArticleNode(issue: DailyIssue) {
  const url = `${SITE}/daily/${issue.date}`;
  const cats = [...new Set(issue.markets.map((m) => CATEGORY_META[m.category].label))];
  return {
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    headline: `${formatCnDate(issue.date)}预测市场中文早报：今日异动`,
    description: issue.summary,
    datePublished: issue.generatedAt,
    dateModified: issue.generatedAt,
    inLanguage: "zh-CN",
    url,
    mainEntityOfPage: url,
    image: [`${url}/opengraph-image`],
    isAccessibleForFree: true,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    keywords: ["Polymarket", "预测市场", "prediction market", ...cats].join(", "),
    // Entity associations help generative engines tie this article to topics.
    about: issue.markets.slice(0, 8).map((m) => ({ "@type": "Thing", name: m.title })),
  };
}

export function breadcrumbNode(date: string | null) {
  const items: object[] = [
    { "@type": "ListItem", position: 1, name: "首页", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "往期归档", item: `${SITE}/archive` },
  ];
  if (date) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: formatCnDate(date),
      item: `${SITE}/daily/${date}`,
    });
  }
  return { "@type": "BreadcrumbList", itemListElement: items };
}

export function faqNode(qas: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: qas.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };
}

/** Wrap nodes in a single schema.org @graph document. */
export function graph(...nodes: (object | null | undefined)[]) {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}

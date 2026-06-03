import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com";

// AI answer-engine + training crawlers we explicitly WELCOME (GEO): we WANT this
// citable, dated, sourced content to be read and attributed by generative engines.
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", // OpenAI
  "ClaudeBot", "Claude-User", "anthropic-ai", // Anthropic
  "PerplexityBot", "Perplexity-User", // Perplexity
  "Google-Extended", // Google Gemini / AI Overviews opt-in
  "Applebot-Extended", // Apple Intelligence
  "CCBot", // Common Crawl (feeds many models)
  "cohere-ai", "Bytespider", "Amazonbot", "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_BOTS.map((bot) => ({ userAgent: bot, allow: "/" })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

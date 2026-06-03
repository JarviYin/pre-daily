// Ping IndexNow (Bing, Yandex, …) with the site's current URLs for instant
// discovery. Reads the live sitemap so it always submits the real URL set.
// The key file public/<KEY>.txt must be deployed and reachable at keyLocation
// BEFORE running this (IndexNow validates ownership via that file).
// Run: pnpm tsx scripts/indexnow.ts
const HOST = "www.pre-daily.com";
const KEY = "90294919de6f95e9e0f8eac988df513d";
const SITE = `https://${HOST}`;

async function main() {
  const sm = await fetch(`${SITE}/sitemap.xml`, { cache: "no-store" }).then((r) => r.text());
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) throw new Error("no <loc> URLs parsed from sitemap.xml");

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList: urls,
  };
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  // IndexNow returns 200 or 202 on success; 422 = key/host mismatch, 403 = key not found.
  console.log(`IndexNow HTTP ${res.status} ${text}`);
  console.log(`submitted ${urls.length} urls:`);
  for (const u of urls) console.log("  " + u);
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}

main().catch((e) => {
  console.error("indexnow failed:", e);
  process.exit(1);
});

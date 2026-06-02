// Dry-run the edition selection against LIVE Gamma data — no DB, no LLM.
// Shows role / heat / 24h move / surge / badges so the curation + ranking can
// be eyeballed before spending tokens on analysis.
// Run: pnpm tsx scripts/check-heat.ts
import { getEditionMarkets } from "../lib/gamma";
import { CATEGORY_META } from "../lib/categories";

const ROLE_ICON: Record<string, string> = { hero: "⚡", heat: "🔥", anchor: "🐋" };

async function main() {
  const markets = await getEditionMarkets(10);
  console.log(`\nEdition preview — ${markets.length} markets\n`);
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    const mv =
      m.move24h == null
        ? "  —  "
        : `${m.move24h >= 0 ? "▲" : "▼"}${(Math.abs(m.move24h) * 100).toFixed(1)}pt`;
    const lead = m.outcomes[0];
    console.log(
      `${ROLE_ICON[m.role] ?? " "} #${i + 1} [${CATEGORY_META[m.category].en}] ${m.title}`
    );
    console.log(
      `     heat ${m.heatScore.toFixed(2)}  move ${mv}  surge ${m.surge.toFixed(1)}x  ` +
        `${m.isNew ? "🆕 " : ""}lead ${lead.option} ${(lead.probability * 100).toFixed(0)}%  ` +
        `liq $${(m.liquidity / 1e3).toFixed(0)}k  24h $${(m.volume24hr / 1e6).toFixed(1)}M`
    );
    console.log(`     badges: ${m.badges.join(" · ") || "—"}`);
  }
  const roles = markets.reduce<Record<string, number>>((a, m) => {
    a[m.role] = (a[m.role] ?? 0) + 1;
    return a;
  }, {});
  console.log("\nRole spread:", roles);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});

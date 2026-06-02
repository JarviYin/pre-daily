// Throwaway QA harness for the Gamma ingestion module.
// Run: pnpm tsx scripts/check-gamma.ts
import { getEditionMarkets } from "../lib/gamma";
import { CATEGORY_META } from "../lib/categories";

async function main() {
  const markets = await getEditionMarkets(10);
  console.log(`\nEdition: ${markets.length} markets:\n`);
  const catCount: Record<string, number> = {};
  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];
    catCount[m.category] = (catCount[m.category] ?? 0) + 1;
    const sum = m.outcomes.reduce((s, o) => s + o.probability, 0);
    const dist = m.outcomes
      .map((o) => `${o.option} ${(o.probability * 100).toFixed(1)}%`)
      .join(" / ");
    const chg =
      m.leadingChange === null
        ? "—"
        : `${m.leadingChange >= 0 ? "▲" : "▼"}${(m.leadingChange * 100).toFixed(1)}pt`;
    console.log(
      `#${i + 1} [${CATEGORY_META[m.category].en}] ${m.title}\n` +
        `    vol $${(m.volume / 1e6).toFixed(1)}M · 24h $${(m.volume24hr / 1e6).toFixed(1)}M` +
        ` · liq $${(m.liquidity / 1e6).toFixed(1)}M · end ${m.endDate?.slice(0, 10) ?? "—"} · 24hΔ ${chg}\n` +
        `    SUM=${(sum * 100).toFixed(1)}%  ${dist}\n` +
        `    ${m.sourceUrl}`
    );
  }
  console.log("\nCategory spread:", catCount);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});

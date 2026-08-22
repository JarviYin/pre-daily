// 冒烟测试：只跑 Gamma 拉取 + 策展 + 选版（不调 LLM、不写库）。
// 用于验证类目配额 / watchlist / curation 行为。
// 用法: pnpm tsx scripts/smoke-edition.ts [topN]
import { getEditionMarkets } from "../lib/gamma";
import { CATEGORY_META } from "../lib/categories";

async function main() {
  const topN = Number(process.argv[2]) || 10;
  const markets = await getEditionMarkets(topN);

  console.log(`\nEdition composition (${markets.length} markets):\n`);
  for (const m of markets) {
    console.log(
      `  [${m.role.padEnd(6)}] ${CATEGORY_META[m.category].label.padEnd(4)} ` +
        `heat=${m.heatScore.toFixed(2)} liq=${Math.round(m.liquidity / 1000)}k ` +
        `${m.title.slice(0, 58)}`
    );
  }

  const byCat = new Map<string, number>();
  for (const m of markets) {
    const k = CATEGORY_META[m.category].label;
    byCat.set(k, (byCat.get(k) ?? 0) + 1);
  }
  console.log("\nCategory mix:", [...byCat.entries()].map(([k, v]) => `${k}=${v}`).join(" "));
  const ai = markets.filter((m) => m.category === "ai").length;
  const finance = markets.filter((m) => m.category === "macro" || m.category === "crypto").length;
  console.log(
    `Quotas: finance=${finance} (min 2) ${finance >= 2 ? "✓" : "✗"}  ai=${ai} (min 2) ${ai >= 2 ? "✓" : "✗"}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("smoke-edition failed:", e);
  process.exit(1);
});

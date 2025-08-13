import { getMarketsEndingSoon } from "../lib/storage/database";
import { writeFileSync } from "fs";

function getTodayParts() {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return { year, month, day };
}

async function main() {
  const { year, month, day } = getTodayParts();
  const todayStrings = [year, month, day];
  const markets = getMarketsEndingSoon(1000);
  const filtered = markets.filter(market => {
    const fields = [market.question, market.description, market.market_slug].map(f => f?.toLowerCase() || "");
    return todayStrings.some(str => fields.some(f => f.includes(str)));
  });
  writeFileSync("markets_ending_today.json", JSON.stringify(filtered, null, 2));
  console.log(`Saved ${filtered.length} markets ending today to markets_ending_today.json`);
}

main().catch((err) => {
  console.error("Error filtering markets:", err);
  process.exit(1);
});

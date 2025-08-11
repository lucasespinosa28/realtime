import { getMarketsEndingSoon } from "../lib/storage/db";
import { writeFileSync } from "fs";

async function main() {
  // Get markets ending soon (default: 24 hours)
  const markets = getMarketsEndingSoon(24);
  // Save to JSON file
  writeFileSync("markets_ending_soon.json", JSON.stringify(markets, null, 2));
  console.log(`Saved ${markets.length} markets ending soon to markets_ending_soon.json`);
}

main().catch((err) => {
  console.error("Error saving markets ending soon:", err);
  process.exit(1);
});

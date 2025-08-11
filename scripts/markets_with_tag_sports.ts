import { getMarketsWithTagSports } from "../lib/storage/db";
import { writeFileSync } from "fs";

async function main() {
  const sportsMarkets = getMarketsWithTagSports();
  writeFileSync("markets_with_tag_sports.json", JSON.stringify(sportsMarkets, null, 2));
  console.log(`Saved ${sportsMarkets.length} sports markets to markets_with_tag_sports.json`);
}

main().catch((err) => {
  console.error("Error saving sports markets:", err);
  process.exit(1);
});

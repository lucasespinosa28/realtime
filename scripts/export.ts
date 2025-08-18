import { DatabaseManager } from "../lib/storage/database";


const database = new DatabaseManager("trades.sqlite");


const trades = database.getAllTradesUnfiltered();

console.log({trades})
// // Combine all records (trades, buys, sells) into one array
// const allRecords = [...trades, ...buys, ...sells];

// // Type guard for Trade
// function isTrade(obj: any): obj is { outcome: string } {
//   return typeof obj.outcome === "string";
// }

// const marketMap = new Map();
// for (const rec of allRecords) {
//     if (!marketMap.has(rec.conditionId)) {
//         marketMap.set(rec.conditionId, {});
//     }
//     const entry = marketMap.get(rec.conditionId);
//     if (isTrade(rec)) {
//         if (rec.outcome === "Up") {
//             entry["Up"] = rec.asset;
//         } else if (rec.outcome === "Down") {
//             entry["Down"] = rec.asset;
//         }
//     } else if (rec.side === "BUY") {
//         entry["Up"] = rec.asset;
//     } else if (rec.side === "SELL") {
//         entry["Down"] = rec.asset;
//     }
// }

// // Build the final array
// const markets = Array.from(marketMap.entries()).map(([conditionId, obj]) => ({
//     conditionId,
//     ...obj
// }));

// console.log(JSON.stringify(markets, null, 2));
// database.close();

// await Bun.write("market.json", JSON.stringify(markets, null, 2));

// 673
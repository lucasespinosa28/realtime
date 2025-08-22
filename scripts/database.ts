// import { DatabaseManager } from "../lib/storage";

// const database1 = new DatabaseManager("trades.sqlite");
// const database2 = new DatabaseManager("trades1.sqlite");
// const database3 = new DatabaseManager("trades2.sqlite");
// const database4 = new DatabaseManager("trades3.sqlite");
// const database5 = new DatabaseManager("trades4.sqlite");

// const tradeDB1 = database1.getAllTradesUnfiltered();
// const tradeDB2 = database2.getAllTradesUnfiltered();
// const tradeDB3 = database3.getAllTradesUnfiltered();
// const tradeDB4 = database4.getAllTradesUnfiltered();
// const tradeDB5 = database5.getAllTradesUnfiltered();

// const tradeDB = tradeDB1.concat(tradeDB2, tradeDB3, tradeDB4, tradeDB5);

// // Filter trades with timestamp >= 0 (timestamp is in unix time, so use a reasonable cutoff)
// const MIN_TIMESTAMP = 0; // <-- replace with a real unix timestamp if needed
// const filteredTradeDB = tradeDB.filter(trade => Number(trade.timestamp) >= MIN_TIMESTAMP);

// const assets: string[] = ["xrp", "solana", "bitcoin", "ethereum"];
// const outcomes: string[] = ["Up", "Down"];
// const conditionOutcomePairs = new Set<string>();

// // Only add pairs where eventSlug includes one of the assets
// for (const trade of filteredTradeDB) {

//     if (assets.some(asset => trade.eventSlug.includes(asset))) {
//         conditionOutcomePairs.add(`${trade.conditionId}::${trade.outcome}`);
//     }
// }

// // Prepare report data structure: asset -> outcome -> array of drops and counts
// const report: Record<string, Record<string, { drops: number[], noDropCount: number }>> = {};
// for (const asset of assets) {
//     report[asset] = {};
//     for (const outcome of outcomes) {
//         report[asset][outcome] = { drops: [], noDropCount: 0 };
//     }
// }

// for (const pair of conditionOutcomePairs) {
//     const [id, outcome] = pair.split('::');

//     // Only consider trades for the selected assets
//     const tradesForConditionOutcome = filteredTradeDB
//         .filter(trade =>
//             trade.conditionId === id &&
//             trade.outcome === outcome &&
//             assets.some(asset => trade.eventSlug.includes(asset))
//         )
//         .sort((a, b) => a.timestamp - b.timestamp);

//     // Get the asset from the eventSlug of the first trade
//     const slugTitle = tradesForConditionOutcome[0]?.eventSlug || "unknown";
//     const asset = assets.find(a => slugTitle.includes(a));
//     if (!asset) continue;

//     // Find trades where price reaches 0.90
//     for (let i = 0; i < tradesForConditionOutcome.length; i++) {
//         const trade = tradesForConditionOutcome[i];

//         if (trade.price >= 0.90) {
//             // Look for subsequent trades to find the lowest price after this point
//             let lowestPrice = trade.price;

//             for (let j = i + 1; j < tradesForConditionOutcome.length; j++) {
//                 const subsequentTrade = tradesForConditionOutcome[j];
//                 if (subsequentTrade.price < lowestPrice) {
//                     lowestPrice = subsequentTrade.price;
//                 }
//             }

//             if (lowestPrice < trade.price) {
//                 const dropPercent = ((trade.price - lowestPrice) / trade.price) * 100;
//                 report[asset][outcome].drops.push(dropPercent);
//             } else {
//                 report[asset][outcome].noDropCount += 1;
//             }
//             // Only first occurrence per condition+outcome
//             break;
//         }
//     }
// }

// const tableRows: Array<Record<string, string>> = [];

// // Define thresholds to check (from 0.80 down to 0.01, step 0.10 then 0.01)
// const thresholds = [0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20, 0.10, 0.01];

// for (const asset of assets) {
//     for (const outcome of outcomes) {
//         const drops = report[asset][outcome].drops; // No filter, include all drops
//         const avgDrop = drops.length === 0 ? "-" : (drops.reduce((a, b) => a + b, 0) / drops.length).toFixed(2) + "%";
//         const dropCount = drops.length;
//         const noDropCount = report[asset][outcome].noDropCount;
//         const rowTotal = dropCount + noDropCount;

//         // Calculate percent of drops that reach each threshold
//         const thresholdPercents: Record<string, string> = {};
//         for (const threshold of thresholds) {
//             // Drop percent needed to reach this threshold from 0.90
//             const neededDrop = ((0.90 - threshold) / 0.90) * 100;
//             const count = drops.filter(drop => drop >= neededDrop).length;
//             thresholdPercents[`<=${threshold}`] = dropCount === 0 ? "-" : ((count / dropCount) * 100).toFixed(0) + "%";
//         }

//         tableRows.push({
//             Asset: asset,
//             Outcome: outcome,
//             "Avg Drop": avgDrop,
//             "Drop Count": dropCount.toString(),
//             "No Drop Count": noDropCount.toString(),
//             Total: rowTotal.toString(),
//             ...thresholdPercents
//         });
//     }
// }

// // Remove total row at the bottom
// // tableRows.push({
// //     Asset: "TOTAL",
// //     Outcome: "",
// //     "Avg Drop": "",
// //     "Drop Count": totalDropCount.toString(),
// //     "No Drop Count": totalNoDropCount.toString(),
// //     Total: (totalDropCount + totalNoDropCount).toString()
// // });

// console.log("\n=== Price Drop Heatmap After Price >= 0.90 ===");
// console.table(tableRows);

// // Save tableRows to CSV
// const csvFile = "price_drop_heatmap.csv";
// if (tableRows.length > 0) {
//     const headers = Object.keys(tableRows[0]);
//     const csvRows = [
//         headers.join(","),
//         ...tableRows.map(row => headers.map(h => row[h]).join(","))
//     ];
//     Bun.write(csvFile, csvRows.join("\n"));
//     console.log(`CSV saved to ${csvFile}`);
// }

// // --- Cross Table Calculation (count all crosses and avg, per outcome probability) ---
// type CrossInfo = {
//     crossCount: number;
//     upCrossCount: number;
//     downCrossCount: number;
//     lastOutcome: string | "-";
// };

// const crossTable: Record<string, CrossInfo> = {};
// let totalCrosses = 0;

// for (const asset of assets) {
//     // Get all trades for this asset, sorted by timestamp
//     const assetTrades = filteredTradeDB
//         .filter(trade => trade.eventSlug.includes(asset))
//         .sort((a, b) => (a.timestamp) - (b.timestamp));

//     let crossCount = 0;
//     let upCrossCount = 0;
//     let downCrossCount = 0;
//     let lastOutcome: string | "-" = "-";
//     let lastCrossOutcome: string | null = null;
//     let upReady = false;
//     let downReady = false;

//     for (const trade of assetTrades) {
//         if (trade.price >= 0.90) {
//             if (trade.outcome === "Up") {
//                 if (!upReady) {
//                     upReady = true;
//                     if (downReady) {
//                         crossCount++;
//                         upCrossCount++;
//                         lastCrossOutcome = "Up";
//                         downReady = false; // reset to only count alternations
//                     }
//                 }
//             } else if (trade.outcome === "Down") {
//                 if (!downReady) {
//                     downReady = true;
//                     if (upReady) {
//                         crossCount++;
//                         downCrossCount++;
//                         lastCrossOutcome = "Down";
//                         upReady = false; // reset to only count alternations
//                     }
//                 }
//             }
//         }
//     }
//     lastOutcome = lastCrossOutcome ?? "-";
//     crossTable[asset] = { crossCount, upCrossCount, downCrossCount, lastOutcome };
//     totalCrosses += crossCount;
// }

// const avgCrosses = (assets.length > 0) ? (totalCrosses / assets.length).toFixed(2) : "0";

// console.log("\n=== Cross Table (Asset, Cross Count, Last Outcome to 0.90, P(Cross Up), P(Cross Down)) ===");
// console.table(
//     assets.map(asset => {
//         const info = crossTable[asset];
//         const pUp = info.crossCount > 0 ? (info.upCrossCount / info.crossCount * 100).toFixed(2) + "%" : "-";
//         const pDown = info.crossCount > 0 ? (info.downCrossCount / info.crossCount * 100).toFixed(2) + "%" : "-";
//         return {
//             Asset: asset,
//             "Cross Count": info.crossCount,
//             "Last Outcome": info.lastOutcome,
//             "P(Cross Up)": pUp,
//             "P(Cross Down)": pDown
//         };
//     })
// );
// console.log(`Average Crosses per Asset: ${avgCrosses}`);

// // Probability of cross happening (fraction of assets with at least one cross)
// const assetsWithCross = assets.filter(asset => crossTable[asset].crossCount > 0).length;
// const crossProbability = (assets.length > 0) ? (assetsWithCross / assets.length * 100).toFixed(2) : "0";
// console.log(`Probability of Cross Happening: ${crossProbability}%`);

// // --- Cross Analysis by Minute of Hour ---
// type MinuteCrossInfo = {
//     minute: number;
//     totalCrosses: number;
//     upCrosses: number;
//     downCrosses: number;
//     assetsWithCrosses: string[];
// };

// const minuteCrossAnalysis: Record<number, MinuteCrossInfo> = {};

// // Initialize all minutes 0-59
// for (let minute = 0; minute < 60; minute++) {
//     minuteCrossAnalysis[minute] = {
//         minute,
//         totalCrosses: 0,
//         upCrosses: 0,
//         downCrosses: 0,
//         assetsWithCrosses: []
//     };
// }

// for (const asset of assets) {
//     // Get all trades for this asset, sorted by timestamp
//     const assetTrades = filteredTradeDB
//         .filter(trade => trade.eventSlug.includes(asset))
//         .sort((a, b) => (a.timestamp) - (b.timestamp));

//     let upReady = false;
//     let downReady = false;

//     for (const trade of assetTrades) {
//         if (trade.price >= 0.90) {
//             // Get minute of hour from timestamp
//             const date = new Date(trade.timestamp * 1000);
//             const minute = date.getMinutes();

//             if (trade.outcome === "Up") {
//                 if (!upReady) {
//                     upReady = true;
//                     if (downReady) {
//                         minuteCrossAnalysis[minute].totalCrosses++;
//                         minuteCrossAnalysis[minute].upCrosses++;
//                         if (!minuteCrossAnalysis[minute].assetsWithCrosses.includes(asset)) {
//                             minuteCrossAnalysis[minute].assetsWithCrosses.push(asset);
//                         }
//                         downReady = false;
//                     }
//                 }
//             } else if (trade.outcome === "Down") {
//                 if (!downReady) {
//                     downReady = true;
//                     if (upReady) {
//                         minuteCrossAnalysis[minute].totalCrosses++;
//                         minuteCrossAnalysis[minute].downCrosses++;
//                         if (!minuteCrossAnalysis[minute].assetsWithCrosses.includes(asset)) {
//                             minuteCrossAnalysis[minute].assetsWithCrosses.push(asset);
//                         }
//                         upReady = false;
//                     }
//                 }
//             }
//         }
//     }
// }

// // Create table for minutes with crosses
// const minuteTable = Object.values(minuteCrossAnalysis)
//     .filter(info => info.totalCrosses > 0)
//     .map(info => ({
//         "Minute": info.minute,
//         "Total Crosses": info.totalCrosses,
//         "Up Crosses": info.upCrosses,
//         "Down Crosses": info.downCrosses,
//         "Assets": info.assetsWithCrosses.join(", ")
//     }))
//     .sort((a, b) => a["Minute"] - b["Minute"]);

// console.log("\n=== Cross Analysis by Minute of Hour (Top Minutes with Crosses) ===");
// console.table(minuteTable);

// // Summary stats
// const totalMinutesWithCrosses = minuteTable.length;
// const avgCrossesPerActiveMinute = minuteTable.length > 0 ? 
//     (minuteTable.reduce((sum, row) => sum + row["Total Crosses"], 0) / minuteTable.length).toFixed(2) : "0";

// console.log(`Minutes with crosses: ${totalMinutesWithCrosses} out of 60`);
// console.log(`Average crosses per active minute: ${avgCrossesPerActiveMinute}`);

// // --- Best Time Analysis: Safest Minutes for Each Asset/Outcome ---
// type SafeTimeInfo = {
//     asset: string;
//     outcome: string;
//     safestMinutes: number[];
//     crossRiskAtSafestMinutes: number;
//     worstMinutes: number[];
//     crossRiskAtWorstMinutes: number;
// };

// const safeTimeAnalysis: SafeTimeInfo[] = [];

// for (const asset of assets) {
//     for (const outcome of outcomes) {
//         // Count cross risk by minute for this specific asset/outcome
//         const minuteCrossRisk: Record<number, number> = {};
        
//         // Initialize all minutes to 0
//         for (let minute = 0; minute < 60; minute++) {
//             minuteCrossRisk[minute] = 0;
//         }

//         // Get all trades for this asset, sorted by timestamp
//         const assetTrades = filteredTradeDB
//             .filter(trade => trade.eventSlug.includes(asset))
//             .sort((a, b) => (a.timestamp) - (b.timestamp));

//         // Group trades by hour
//         const tradesByHour: Record<string, typeof assetTrades> = {};
//         for (const trade of assetTrades) {
//             const date = new Date(trade.timestamp * 1000);
//             const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
//             if (!tradesByHour[hourKey]) {
//                 tradesByHour[hourKey] = [];
//             }
//             tradesByHour[hourKey].push(trade);
//         }

//         // For each hour, check if placing an order at each minute would result in a cross later in that hour
//         for (const hourTrades of Object.values(tradesByHour)) {
//             const hourTradesFiltered = hourTrades.filter(trade => trade.price >= 0.90);
            
//             for (let orderMinute = 0; orderMinute < 60; orderMinute++) {
//                 // Simulate placing an order at this minute
//                 // Check if a cross occurs later in the same hour
//                 let upReady = false;
//                 let downReady = false;
//                 let crossOccurred = false;

//                 // Set initial state based on the order we're placing
//                 if (outcome === "Up") {
//                     upReady = true;
//                 } else {
//                     downReady = true;
//                 }

//                 for (const trade of hourTradesFiltered) {
//                     const tradeDate = new Date(trade.timestamp * 1000);
//                     const tradeMinute = tradeDate.getMinutes();
                    
//                     // Only look at trades that happen AFTER our order minute
//                     if (tradeMinute <= orderMinute) continue;

//                     if (trade.outcome === "Up") {
//                         if (!upReady) {
//                             upReady = true;
//                             if (downReady) {
//                                 crossOccurred = true;
//                                 break;
//                             }
//                         }
//                     } else if (trade.outcome === "Down") {
//                         if (!downReady) {
//                             downReady = true;
//                             if (upReady) {
//                                 crossOccurred = true;
//                                 break;
//                             }
//                         }
//                     }
//                 }

//                 if (crossOccurred) {
//                     minuteCrossRisk[orderMinute]++;
//                 }
//             }
//         }

//         // Find minutes with different risk levels (exclude minutes 55-59 as impractical)
//         const practicalMinutes = Object.entries(minuteCrossRisk)
//             .filter(([minute]) => parseInt(minute) < 55)
//             .map(([minute, risk]) => ({ minute: parseInt(minute), risk }))
//             .sort((a, b) => a.risk - b.risk);

//         const minRisk = practicalMinutes[0]?.risk || 0;
//         const maxRisk = practicalMinutes[practicalMinutes.length - 1]?.risk || 0;
        
//         // Get different risk categories
//         const safestMinutes = practicalMinutes.filter(m => m.risk === minRisk).map(m => m.minute);
//         const lowRiskMinutes = practicalMinutes.filter(m => m.risk > minRisk && m.risk <= minRisk + (maxRisk - minRisk) * 0.25).map(m => m.minute);
//         const mediumRiskMinutes = practicalMinutes.filter(m => m.risk > minRisk + (maxRisk - minRisk) * 0.25 && m.risk <= minRisk + (maxRisk - minRisk) * 0.75).map(m => m.minute);
//         const highRiskMinutes = practicalMinutes.filter(m => m.risk > minRisk + (maxRisk - minRisk) * 0.75).map(m => m.minute);

//         safeTimeAnalysis.push({
//             asset,
//             outcome,
//             safestMinutes: safestMinutes.slice(0, 10),
//             crossRiskAtSafestMinutes: minRisk,
//             worstMinutes: highRiskMinutes.slice(0, 10),
//             crossRiskAtWorstMinutes: maxRisk
//         });

//         // Add detailed risk breakdown for this asset/outcome
//         console.log(`\n--- ${asset.toUpperCase()} ${outcome.toUpperCase()} Risk Breakdown ---`);
//         console.log(`Safest (${minRisk} risk): ${safestMinutes.slice(0, 10).join(', ')}`);
//         if (lowRiskMinutes.length > 0) {
//             const lowRisk = practicalMinutes.find(m => lowRiskMinutes.includes(m.minute))?.risk || 0;
//             console.log(`Low Risk (${lowRisk} risk): ${lowRiskMinutes.slice(0, 10).join(', ')}`);
//         }
//         if (mediumRiskMinutes.length > 0) {
//             const medRisk = practicalMinutes.find(m => mediumRiskMinutes.includes(m.minute))?.risk || 0;
//             console.log(`Medium Risk (~${medRisk} risk): ${mediumRiskMinutes.slice(0, 10).join(', ')}`);
//         }
//         if (highRiskMinutes.length > 0) {
//             console.log(`High Risk (${maxRisk} risk): ${highRiskMinutes.slice(0, 10).join(', ')}`);
//         }
//     }
// }

// // Create readable table
// const safeTimeTable = safeTimeAnalysis.map(info => ({
//     "Asset": info.asset,
//     "Outcome": info.outcome,
//     "Safest Minutes": info.safestMinutes.join(", "),
//     "Risk (Safest)": info.crossRiskAtSafestMinutes,
//     "Worst Minutes": info.worstMinutes.join(", "),
//     "Risk (Worst)": info.crossRiskAtWorstMinutes,
//     "Risk Difference": info.crossRiskAtWorstMinutes - info.crossRiskAtSafestMinutes,
//     "Risk Reduction %": info.crossRiskAtWorstMinutes > 0 ? 
//         `${(((info.crossRiskAtWorstMinutes - info.crossRiskAtSafestMinutes) / info.crossRiskAtWorstMinutes) * 100).toFixed(1)}%` : "N/A"
// }));

// console.log("\n=== Best Time Analysis: Risk of Cross AFTER Placing Order ===");
// console.log("Risk numbers = how many times out of all hours a cross occurred after placing order at that minute");
// console.table(safeTimeTable);

// // Overall recommendations
// const overallSafestMinutes = new Map<number, number>();
// for (let minute = 0; minute < 60; minute++) {
//     let totalRisk = 0;
//     for (const info of safeTimeAnalysis) {
//         // Count if this minute appears in safest minutes for this asset/outcome
//         if (info.safestMinutes.includes(minute)) {
//             totalRisk += info.crossRiskAtSafestMinutes;
//         }
//     }
//     if (totalRisk === 0) {
//         overallSafestMinutes.set(minute, 0);
//     }
// }

// const globalSafestMinutes = Array.from(overallSafestMinutes.keys()).slice(0, 10);
// console.log(`\nGlobal safest minutes (across all assets/outcomes): ${globalSafestMinutes.join(", ")}`);

// // --- New Strategy Analysis: Buy at minute 50 when price hits 0.90, compare sell at 0.95 vs 0.99 ---
// type StrategyResult = {
//     asset: string;
//     outcome: string;
//     totalOpportunities: number;
//     sell95_wins: number;
//     sell95_losses: number;
//     sell95_winRate: number;
//     sell99_wins: number;
//     sell99_losses: number;
//     sell99_winRate: number;
//     sell95_avgProfit: number;
//     sell99_avgProfit: number;
//     recommendation: string;
// };

// const strategyResults: StrategyResult[] = [];

// for (const asset of assets) {
//     for (const outcome of outcomes) {
//         // Get all trades for this asset/outcome, sorted by timestamp
//         const assetTrades = filteredTradeDB
//             .filter(trade => 
//                 trade.eventSlug.includes(asset) && 
//                 trade.outcome === outcome
//             )
//             .sort((a, b) => a.timestamp - b.timestamp);

//         // Group trades by hour
//         const tradesByHour: Record<string, typeof assetTrades> = {};
//         for (const trade of assetTrades) {
//             const date = new Date(trade.timestamp * 1000);
//             const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
//             if (!tradesByHour[hourKey]) {
//                 tradesByHour[hourKey] = [];
//             }
//             tradesByHour[hourKey].push(trade);
//         }

//         let totalOpportunities = 0;
//         let sell95_wins = 0, sell95_losses = 0;
//         let sell99_wins = 0, sell99_losses = 0;
//         const sell95_profits: number[] = [];
//         const sell99_profits: number[] = [];

//         // Analyze each hour
//         for (const hourTrades of Object.values(tradesByHour)) {
//             // Look for buy opportunity: price hits 0.90 at or after minute 50
//             let buyExecuted = false;
//             let buyPrice = 0;

//             for (const trade of hourTrades) {
//                 const tradeDate = new Date(trade.timestamp * 1000);
//                 const minute = tradeDate.getMinutes();

//                 // Buy condition: minute >= 50 and price <= 0.90
//                 if (minute >= 50 && trade.price <= 0.90 && !buyExecuted) {
//                     buyPrice = trade.price;
//                     buyExecuted = true;
//                     totalOpportunities++;

//                     // Strategy 1: Sell at 0.95
//                     let sell95_executed = false;
//                     let sell99_executed = false;

//                     // Look for trades after buy
//                     for (const laterTrade of hourTrades) {
//                         if (laterTrade.timestamp <= trade.timestamp) continue;

//                         // Check if we can sell at 0.95
//                         if (!sell95_executed && laterTrade.price >= 0.95) {
//                             sell95_wins++;
//                             sell95_profits.push((0.95 - buyPrice) / buyPrice * 100);
//                             sell95_executed = true;
//                         }

//                         // Check if we can sell at 0.99
//                         if (!sell99_executed && laterTrade.price >= 0.99) {
//                             sell99_wins++;
//                             sell99_profits.push((0.99 - buyPrice) / buyPrice * 100);
//                             sell99_executed = true;
//                         }
//                     }

//                     // Count losses
//                     if (!sell95_executed) {
//                         sell95_losses++;
//                         sell95_profits.push(-buyPrice / buyPrice * 100); // Assume total loss for simplicity
//                     }
//                     if (!sell99_executed) {
//                         sell99_losses++;
//                         sell99_profits.push(-buyPrice / buyPrice * 100); // Assume total loss for simplicity
//                     }

//                     break; // Only one buy per hour
//                 }
//             }
//         }

//         const sell95_winRate = totalOpportunities > 0 ? (sell95_wins / totalOpportunities) * 100 : 0;
//         const sell99_winRate = totalOpportunities > 0 ? (sell99_wins / totalOpportunities) * 100 : 0;
        
//         const sell95_avgProfit = sell95_profits.length > 0 ? 
//             sell95_profits.reduce((a, b) => a + b, 0) / sell95_profits.length : 0;
//         const sell99_avgProfit = sell99_profits.length > 0 ? 
//             sell99_profits.reduce((a, b) => a + b, 0) / sell99_profits.length : 0;

//         // Determine recommendation
//         let recommendation = "Insufficient data";
//         if (totalOpportunities >= 5) {
//             const sell95_expectedValue = sell95_winRate * sell95_avgProfit / 100;
//             const sell99_expectedValue = sell99_winRate * sell99_avgProfit / 100;
//             recommendation = sell95_expectedValue > sell99_expectedValue ? "Sell at 0.95" : "Wait for 0.99";
//         }

//         strategyResults.push({
//             asset,
//             outcome,
//             totalOpportunities,
//             sell95_wins,
//             sell95_losses,
//             sell95_winRate: parseFloat(sell95_winRate.toFixed(1)),
//             sell99_wins,
//             sell99_losses,
//             sell99_winRate: parseFloat(sell99_winRate.toFixed(1)),
//             sell95_avgProfit: parseFloat(sell95_avgProfit.toFixed(2)),
//             sell99_avgProfit: parseFloat(sell99_avgProfit.toFixed(2)),
//             recommendation
//         });
//     }
// }

// console.log("\n=== Strategy Test: Buy at minute 50 (price ≤ 0.90) - Sell at 0.95 vs Wait for 0.99 ===");
// console.table(strategyResults.map(r => ({
//     "Asset": r.asset,
//     "Outcome": r.outcome,
//     "Opportunities": r.totalOpportunities,
//     "0.95 Win Rate": `${r.sell95_winRate}%`,
//     "0.99 Win Rate": `${r.sell99_winRate}%`,
//     "0.95 Avg Profit": `${r.sell95_avgProfit}%`,
//     "0.99 Avg Profit": `${r.sell99_avgProfit}%`,
//     "Recommendation": r.recommendation
// })));

// // Summary
// const totalOpps = strategyResults.reduce((sum, r) => sum + r.totalOpportunities, 0);
// const overall95WinRate = strategyResults.reduce((sum, r) => sum + r.sell95_wins, 0) / totalOpps * 100;
// const overall99WinRate = strategyResults.reduce((sum, r) => sum + r.sell99_wins, 0) / totalOpps * 100;

// console.log(`\n=== Strategy Summary ===`);
// console.log(`Total opportunities analyzed: ${totalOpps}`);
// console.log(`Overall win rate selling at 0.95: ${overall95WinRate.toFixed(1)}%`);
// console.log(`Overall win rate waiting for 0.99: ${overall99WinRate.toFixed(1)}%`);

// // --- Price Heatmap at Minute 59 ---
// type PriceFrequency = {
//     price: string;
//     count: number;
//     assets: string[];
//     outcomes: string[];
//     percentage: number;
// };

// const priceHeatmapData: Record<string, { count: number; assets: Set<string>; outcomes: Set<string> }> = {};

// let totalMinute59Trades = 0;

// // Analyze all trades at minute 59
// for (const trade of filteredTradeDB) {
//     const date = new Date(trade.timestamp * 1000);
//     const minute = date.getMinutes();
    
//     if (minute === 59) {
//         totalMinute59Trades++;
        
//         // Round price to 2 decimal places for grouping
//         const priceKey = trade.price.toFixed(2);
        
//         if (!priceHeatmapData[priceKey]) {
//             priceHeatmapData[priceKey] = { count: 0, assets: new Set(), outcomes: new Set() };
//         }
        
//         priceHeatmapData[priceKey].count++;
        
//         // Track which assets and outcomes have trades at this price
//         const asset = assets.find(a => trade.eventSlug.includes(a));
//         if (asset) {
//             priceHeatmapData[priceKey].assets.add(asset);
//             priceHeatmapData[priceKey].outcomes.add(trade.outcome);
//         }
//     }
// }

// // Convert to array and calculate percentages
// const priceHeatmap: PriceFrequency[] = Object.entries(priceHeatmapData)
//     .map(([price, data]) => ({
//         price,
//         count: data.count,
//         assets: Array.from(data.assets),
//         outcomes: Array.from(data.outcomes),
//         percentage: totalMinute59Trades > 0 ? (data.count / totalMinute59Trades * 100) : 0
//     }))
//     .sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); // Sort by price descending (0.99, 0.98, 0.97...)

// console.log("\n=== Price Heatmap at Minute 59 ===");
// console.log(`Total trades analyzed at minute 59: ${totalMinute59Trades}`);
// console.table(priceHeatmap.map(item => ({
//     "Price": item.price,
//     "Count": item.count,
//     "Percentage": `${item.percentage.toFixed(1)}%`,
//     "Assets": item.assets.join(", "),
//     "Outcomes": item.outcomes.join(", ")
// })));

// // Create a simple visual heatmap
// console.log("\n=== Visual Price Heatmap (Minute 59) ===");
// const maxCount = Math.max(...priceHeatmap.map(item => item.count));
// for (const item of priceHeatmap) {
//     const barLength = Math.round((item.count / maxCount) * 20);
//     const bar = "█".repeat(barLength) + "░".repeat(20 - barLength);
//     console.log(`${item.price.padEnd(6)} │${bar}│ ${item.count} (${item.percentage.toFixed(1)}%)`);
// }

// // --- Contrarian Strategy Test: Buy opposite when price hits 0.90, sell at 0.05 ---
// type ContrarianResult = {
//     asset: string;
//     originalOutcome: string;
//     buyOpposite: string;
//     totalOpportunities: number;
//     wins: number;
//     losses: number;
//     winRate: number;
//     avgProfit: number;
//     avgLoss: number;
//     netProfit: number;
// };

// const contrarianResults: ContrarianResult[] = [];

// for (const asset of assets) {
//     for (const outcome of outcomes) {
//         const oppositeOutcome = outcome === "Up" ? "Down" : "Up";
        
//         // Get trades for the original outcome (trigger) and opposite outcome (buy target)
//         const triggerTrades = filteredTradeDB
//             .filter(trade => 
//                 trade.eventSlug.includes(asset) && 
//                 trade.outcome === outcome &&
//                 trade.price >= 0.90
//             )
//             .sort((a, b) => a.timestamp - b.timestamp);

//         const oppositeTrades = filteredTradeDB
//             .filter(trade => 
//                 trade.eventSlug.includes(asset) && 
//                 trade.outcome === oppositeOutcome
//             )
//             .sort((a, b) => a.timestamp - b.timestamp);

//         let totalOpportunities = 0;
//         let wins = 0;
//         let losses = 0;
//         const profits: number[] = [];
//         const lossAmounts: number[] = [];

//         // For each trigger event (price >= 0.90 on original outcome)
//         for (const trigger of triggerTrades) {
//             // Look for opportunity to buy opposite outcome at 0.10 after this trigger
//             const buyOpportunity = oppositeTrades.find(trade => 
//                 trade.timestamp > trigger.timestamp &&
//                 trade.timestamp <= trigger.timestamp + 3600 && // Within 1 hour
//                 trade.price <= 0.10
//             );

//             if (buyOpportunity) {
//                 totalOpportunities++;
//                 const buyPrice = buyOpportunity.price;

//                 // Look for sell opportunity at 0.05 or lower after buying
//                 const sellOpportunity = oppositeTrades.find(trade =>
//                     trade.timestamp > buyOpportunity.timestamp &&
//                     trade.timestamp <= buyOpportunity.timestamp + 3600 && // Within 1 hour of buy
//                     trade.price <= 0.05
//                 );

//                 if (sellOpportunity) {
//                     wins++;
//                     // Calculate profit: we bought at buyPrice and "sold" at 0.05
//                     // Since we're buying the opposite, profit is when price goes down
//                     const profit = ((buyPrice - 0.05) / buyPrice) * 100;
//                     profits.push(profit);
//                 } else {
//                     losses++;
//                     // Assume we hold and price stays around buyPrice (minimal loss) or goes against us
//                     const loss = (buyPrice / buyPrice) * 100; // Assume 100% loss for simplicity
//                     lossAmounts.push(loss);
//                 }
//             }
//         }

//         const winRate = totalOpportunities > 0 ? (wins / totalOpportunities) * 100 : 0;
//         const avgProfit = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0;
//         const avgLoss = lossAmounts.length > 0 ? lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length : 0;
//         const netProfit = (wins * avgProfit - losses * avgLoss);

//         if (totalOpportunities > 0) {
//             contrarianResults.push({
//                 asset,
//                 originalOutcome: outcome,
//                 buyOpposite: oppositeOutcome,
//                 totalOpportunities,
//                 wins,
//                 losses,
//                 winRate: parseFloat(winRate.toFixed(1)),
//                 avgProfit: parseFloat(avgProfit.toFixed(2)),
//                 avgLoss: parseFloat(avgLoss.toFixed(2)),
//                 netProfit: parseFloat(netProfit.toFixed(2))
//             });
//         }
//     }
// }

// console.log("\n=== Contrarian Strategy: When price hits 0.90, buy opposite at 0.10, sell at 0.05 ===");
// console.log("Strategy: If Up hits 0.90 → Buy Down at 0.10 → Sell at 0.05");
// console.log("Strategy: If Down hits 0.90 → Buy Up at 0.10 → Sell at 0.05");
// console.table(contrarianResults.map(r => ({
//     "Asset": r.asset,
//     "Trigger": `${r.originalOutcome} ≥ 0.90`,
//     "Buy": `${r.buyOpposite} ≤ 0.10`,
//     "Opportunities": r.totalOpportunities,
//     "Wins": r.wins,
//     "Losses": r.losses,
//     "Win Rate": `${r.winRate}%`,
//     "Avg Profit": `${r.avgProfit}%`,
//     "Net Profit": r.netProfit
// })));

// // Summary
// const totalContrarianOpps = contrarianResults.reduce((sum, r) => sum + r.totalOpportunities, 0);
// const totalContrarianWins = contrarianResults.reduce((sum, r) => sum + r.wins, 0);
// const overallContrarianWinRate = totalContrarianOpps > 0 ? (totalContrarianWins / totalContrarianOpps * 100) : 0;
// const totalNetProfit = contrarianResults.reduce((sum, r) => sum + r.netProfit, 0);

// console.log(`\n=== Contrarian Strategy Summary ===`);
// console.log(`Total opportunities: ${totalContrarianOpps}`);
// console.log(`Overall win rate: ${overallContrarianWinRate.toFixed(1)}%`);
// console.log(`Total net profit: ${totalNetProfit.toFixed(2)}%`);
// console.log(`Strategy viability: ${totalNetProfit > 0 ? 'PROFITABLE' : 'NOT PROFITABLE'}`);

// // --- Detailed Trade Analysis ---

// type DetailedTradeInfo = {
//     asset: string;
//     outcome: string;
//     dropStartTimestamp: string;
//     dropEndTimestamp: string;
//     timeToDropSeconds: number;
//     startPrice: number;
//     lowestPrice: number;
//     dropPercentage: number;
//     volumeDuringDrop: number;
//     preDropTrend: 'uptrend' | 'downtrend' | 'sideways';
//     recoveryPrice: number;
//     recoveryRate: number;
//     timeToRecoverSeconds: number | null;
// };

// const detailedAnalysis: DetailedTradeInfo[] = [];

// for (const pair of conditionOutcomePairs) {
//     const [id, outcome] = pair.split('::');

//     const tradesForConditionOutcome = filteredTradeDB
//         .filter(trade =>
//             trade.conditionId === id &&
//             trade.outcome === outcome &&
//             assets.some(asset => trade.eventSlug.includes(asset))
//         )
//         .sort((a, b) => a.timestamp - b.timestamp);

//     if (tradesForConditionOutcome.length === 0) continue;

//     const slugTitle = tradesForConditionOutcome[0]?.eventSlug || "unknown";
//     const asset = assets.find(a => slugTitle.includes(a));
//     if (!asset) continue;

//     for (let i = 0; i < tradesForConditionOutcome.length; i++) {
//         const startTrade = tradesForConditionOutcome[i];

//         if (startTrade.price >= 0.90) {
//             let lowestPrice = startTrade.price;
//             let lowestPriceIndex = i;
//             let volumeDuringDrop = startTrade.size;

//             for (let j = i + 1; j < tradesForConditionOutcome.length; j++) {
//                 const subsequentTrade = tradesForConditionOutcome[j];
//                 volumeDuringDrop += subsequentTrade.size;
//                 if (subsequentTrade.price < lowestPrice) {
//                     lowestPrice = subsequentTrade.price;
//                     lowestPriceIndex = j;
//                 }
//             }

//             if (lowestPrice < startTrade.price) {
//                 const dropStartTimestamp = startTrade.timestamp;
//                 const dropEndTimestamp = tradesForConditionOutcome[lowestPriceIndex].timestamp;
//                 const timeToDropSeconds = (dropEndTimestamp - dropStartTimestamp);

//                 // Pre-drop trend
//                 const trendWindow = tradesForConditionOutcome.slice(0, i).slice(-10);
//                 let preDropTrend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
//                 if (trendWindow.length > 1) {
//                     const priceChange = startTrade.price - trendWindow[0].price;
//                     if (priceChange > 0.05) preDropTrend = 'uptrend';
//                     if (priceChange < -0.05) preDropTrend = 'downtrend';
//                 }

//                 // Recovery
//                 let recoveryPrice = lowestPrice;
//                 let recoveryPriceIndex = lowestPriceIndex;
//                 for (let k = lowestPriceIndex + 1; k < tradesForConditionOutcome.length; k++) {
//                     if (tradesForConditionOutcome[k].price > recoveryPrice) {
//                         recoveryPrice = tradesForConditionOutcome[k].price;
//                         recoveryPriceIndex = k;
//                     }
//                 }
//                 const recoveryRate = lowestPrice > 0 ? ((recoveryPrice - lowestPrice) / lowestPrice) * 100 : 0;
//                 const timeToRecoverSeconds = recoveryPrice > lowestPrice
//                     ? (tradesForConditionOutcome[recoveryPriceIndex].timestamp - dropEndTimestamp)
//                     : null;

//                 detailedAnalysis.push({
//                     asset,
//                     outcome,
//                     dropStartTimestamp: new Date(dropStartTimestamp * 1000).toISOString(),
//                     dropEndTimestamp: new Date(dropEndTimestamp * 1000).toISOString(),
//                     timeToDropSeconds,
//                     startPrice: startTrade.price,
//                     lowestPrice,
//                     dropPercentage: ((startTrade.price - lowestPrice) / startTrade.price) * 100,
//                     volumeDuringDrop,
//                     preDropTrend,
//                     recoveryPrice,
//                     recoveryRate,
//                     timeToRecoverSeconds,
//                 });
//             }
//             // Move to the trade after the one that started the drop sequence to avoid re-processing
//             i = tradesForConditionOutcome.length; // Only first occurrence per condition+outcome
//         }
//     }
// }

// console.log("\n=== Detailed Trade Analysis ===");
// if (detailedAnalysis.length > 0) {
//     const detailedCsvFile = "detailed_trade_analysis.csv";
//     const detailedHeaders = Object.keys(detailedAnalysis[0]);
//     const detailedCsvRows = [
//         detailedHeaders.join(","),
//         ...detailedAnalysis.map(row => detailedHeaders.map(h => row[h as keyof DetailedTradeInfo]).join(","))
//     ];
//     Bun.write(detailedCsvFile, detailedCsvRows.join("\n"));
//     console.log(`Detailed analysis CSV saved to ${detailedCsvFile}`);
//     console.table(detailedAnalysis.slice(0, 10)); // Display first 10 rows
// } else {
//     console.log("No detailed trade data to analyze.");
// }


// // --- Perfect Price Balance Table Calculation (All Assets, Multiple Price Examples for Ethereum) ---
// // --- Custom Win Rate Calculation: Buy after first 0.9, when price returns to 0.99 ---
// type WinRateResult = {
//     asset: string;
//     outcome: string;
//     buyTimestamp: number;
//     win: boolean;
//     buyPrice: number;
//     sellPrice: number | null;
// };

// const winRateResults: WinRateResult[] = [];


// for (const pair of conditionOutcomePairs) {
//     const [id, outcome] = pair.split('::');
//     const trades = filteredTradeDB
//         .filter(trade => trade.conditionId === id && trade.outcome === outcome)
//         .sort((a, b) => a.timestamp - b.timestamp);
//     if (trades.length === 0) continue;
//     const slugTitle = trades[0]?.eventSlug || "unknown";
//     const asset = assets.find(a => slugTitle.includes(a));
//     if (!asset) continue;

//     // 1. Find first trade where price <= 0.9
//     const first09Idx = trades.findIndex(trade => trade.price <= 0.9);
//     if (first09Idx === -1) continue;
//     const buyTrade = trades[first09Idx];

//     // 2. After that, find first trade where price >= 0.99
//     const sellIdx = trades.slice(first09Idx + 1).findIndex(trade => trade.price >= 0.99);
//     let win = false;
//     let sellPrice: number | null = null;
//     if (sellIdx !== -1) {
//         const realSellIdx = sellIdx + first09Idx + 1;
//         sellPrice = trades[realSellIdx].price;
//         win = true;
//     }
//     winRateResults.push({
//         asset,
//         outcome,
//         buyTimestamp: buyTrade.timestamp,
//         win,
//         buyPrice: buyTrade.price,
//         sellPrice,
//     });
// }


// // Still print the overall summary
// const totalSimulated = winRateResults.length;
// const totalWins = winRateResults.filter(r => r.win).length;
// const winRate = totalSimulated > 0 ? ((totalWins / totalSimulated) * 100).toFixed(2) : "-";
// console.log("\n=== Win Rate for Buy After 0.9, Buy at 0.99, Sell if Price > 0.99 ===");
// console.log(`Total simulated trades: ${totalSimulated}`);
// console.log(`Total wins: ${totalWins}`);
// console.log(`Win rate: ${winRate}%`);
// if (totalSimulated !== 221) {
//     console.log(`Note: Number of simulated trades (${totalSimulated}) does not match 221. Check data or logic.`);
// }
// const perfectPriceBalance: Record<string, Record<string, number>[]> = {
//     xrp: [{ Up: 0.6, Down: 0.5 }],
//     solana: [{ Up: 0.4, Down: 0.2 }],
//     bitcoin: [{ Up: 0.1, Down: 0.7 }],
//     ethereum: [
//         { Up: 0.5, Down: 0.8 },
//         { Up: 0.9, Down: 0.9 },
//         { Up: 0.8, Down: 0.8 },
//         { Up: 0.1, Down: 0.1 }
//     ]
// };

// type BalanceResult = {
//     Asset: string;
//     Outcome: string;
//     Example: string;
//     Wins: number;
//     Losses: number;
//     Total: number;
//     "Win Rate": string;
// };

// const balanceTable: BalanceResult[] = [];

// for (const asset of assets) {
//     // Use array of price configs for ethereum, single for others
//     const configs = perfectPriceBalance[asset] ?? [];
//     for (const config of configs) {
//         for (const outcome of outcomes) {
//             // Get all trades for this asset/outcome, sorted by timestamp
//             const trades = filteredTradeDB
//                 .filter(trade =>
//                     trade.eventSlug.includes(asset) &&
//                     trade.outcome === outcome
//                 )
//                 .sort((a, b) => a.timestamp - b.timestamp);

//             let wins = 0;
//             let losses = 0;
//             let i = 0;
//             while (i < trades.length) {
//                 // Find next trade where price >= 0.90
//                 while (i < trades.length && trades[i].price < 0.90) i++;
//                 if (i >= trades.length) break;

//                 const balance = config[outcome];

//                 // Look for a subsequent trade <= balance
//                 let found = false;
//                 for (let j = i + 1; j < trades.length; j++) {
//                     if (trades[j].price <= balance) {
//                         wins++;
//                         found = true;
//                         i = j; // move i forward to avoid overlapping
//                         break;
//                     }
//                 }
//                 if (!found) {
//                     losses++;
//                     i++; // move to next trade
//                 } else {
//                     i++; // move to next trade after win
//                 }
//             }

//             const total = wins + losses;
//             const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) + "%" : "-";
//             balanceTable.push({
//                 Asset: asset,
//                 Outcome: outcome,
//                 Example: `Up: ${config.Up}, Down: ${config.Down}`,
//                 Wins: wins,
//                 Losses: losses,
//                 Total: total,
//                 "Win Rate": winRate
//             });
//         }
//     }
// }

// console.log("\n=== Perfect Price Balance Table (After Price >= 0.90, All Assets, Multiple Ethereum Examples) ===");
// console.table(balanceTable);
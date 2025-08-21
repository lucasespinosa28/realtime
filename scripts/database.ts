import { DatabaseManager } from "../lib/storage/database";

const database1 = new DatabaseManager("trades.sqlite");
const database2 = new DatabaseManager("trades1.sqlite");
const database3 = new DatabaseManager("trades2.sqlite");
const database4 = new DatabaseManager("trades3.sqlite");
const database5 = new DatabaseManager("trades4.sqlite");

const tradeDB1 = database1.getAllTradesUnfiltered();
const tradeDB2 = database2.getAllTradesUnfiltered();
const tradeDB3 = database3.getAllTradesUnfiltered();
const tradeDB4 = database4.getAllTradesUnfiltered();
const tradeDB5 = database5.getAllTradesUnfiltered();

const tradeDB = tradeDB1.concat(tradeDB2, tradeDB3, tradeDB4, tradeDB5);

// Filter trades with timestamp >= 45 (timestamp is in unix time, so use a reasonable cutoff)
const MIN_TIMESTAMP = 45; // <-- replace with a real unix timestamp if needed
const filteredTradeDB = tradeDB.filter(trade => Number(trade.timestamp) >= MIN_TIMESTAMP);

const assets: string[] = ["xrp", "solana", "bitcoin", "ethereum"];
const outcomes: string[] = ["Up", "Down"];
const conditionOutcomePairs = new Set<string>();

// Only add pairs where eventSlug includes one of the assets
for (const trade of filteredTradeDB) {

    if (assets.some(asset => trade.eventSlug.includes(asset))) {
        conditionOutcomePairs.add(`${trade.conditionId}::${trade.outcome}`);
    }
}

// Prepare report data structure: asset -> outcome -> array of drops and counts
const report: Record<string, Record<string, { drops: number[], noDropCount: number }>> = {};
for (const asset of assets) {
    report[asset] = {};
    for (const outcome of outcomes) {
        report[asset][outcome] = { drops: [], noDropCount: 0 };
    }
}

for (const pair of conditionOutcomePairs) {
    const [id, outcome] = pair.split('::');

    // Only consider trades for the selected assets
    const tradesForConditionOutcome = filteredTradeDB
        .filter(trade =>
            trade.conditionId === id &&
            trade.outcome === outcome &&
            assets.some(asset => trade.eventSlug.includes(asset))
        )
        .sort((a, b) => a.timestamp - b.timestamp);

    // Get the asset from the eventSlug of the first trade
    const slugTitle = tradesForConditionOutcome[0]?.eventSlug || "unknown";
    const asset = assets.find(a => slugTitle.includes(a));
    if (!asset) continue;

    // Find trades where price reaches 0.90
    for (let i = 0; i < tradesForConditionOutcome.length; i++) {
        const trade = tradesForConditionOutcome[i];

        if (trade.price >= 0.90) {
            // Look for subsequent trades to find the lowest price after this point
            let lowestPrice = trade.price;

            for (let j = i + 1; j < tradesForConditionOutcome.length; j++) {
                const subsequentTrade = tradesForConditionOutcome[j];
                if (subsequentTrade.price < lowestPrice) {
                    lowestPrice = subsequentTrade.price;
                }
            }

            if (lowestPrice < trade.price) {
                const dropPercent = ((trade.price - lowestPrice) / trade.price) * 100;
                report[asset][outcome].drops.push(dropPercent);
            } else {
                report[asset][outcome].noDropCount += 1;
            }
            // Only first occurrence per condition+outcome
            break;
        }
    }
}

const tableRows: Array<Record<string, string>> = [];

// Define thresholds to check (from 0.80 down to 0.01, step 0.10 then 0.01)
const thresholds = [0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20, 0.10, 0.01];

for (const asset of assets) {
    for (const outcome of outcomes) {
        const drops = report[asset][outcome].drops; // No filter, include all drops
        const avgDrop = drops.length === 0 ? "-" : (drops.reduce((a, b) => a + b, 0) / drops.length).toFixed(2) + "%";
        const dropCount = drops.length;
        const noDropCount = report[asset][outcome].noDropCount;
        const rowTotal = dropCount + noDropCount;

        // Calculate percent of drops that reach each threshold
        const thresholdPercents: Record<string, string> = {};
        for (const threshold of thresholds) {
            // Drop percent needed to reach this threshold from 0.90
            const neededDrop = ((0.90 - threshold) / 0.90) * 100;
            const count = drops.filter(drop => drop >= neededDrop).length;
            thresholdPercents[`<=${threshold}`] = dropCount === 0 ? "-" : ((count / dropCount) * 100).toFixed(0) + "%";
        }

        tableRows.push({
            Asset: asset,
            Outcome: outcome,
            "Avg Drop": avgDrop,
            "Drop Count": dropCount.toString(),
            "No Drop Count": noDropCount.toString(),
            Total: rowTotal.toString(),
            ...thresholdPercents
        });
    }
}

// Remove total row at the bottom
// tableRows.push({
//     Asset: "TOTAL",
//     Outcome: "",
//     "Avg Drop": "",
//     "Drop Count": totalDropCount.toString(),
//     "No Drop Count": totalNoDropCount.toString(),
//     Total: (totalDropCount + totalNoDropCount).toString()
// });

console.log("\n=== Price Drop Heatmap After Price >= 0.90 ===");
console.table(tableRows);

// Save tableRows to CSV
const csvFile = "price_drop_heatmap.csv";
if (tableRows.length > 0) {
    const headers = Object.keys(tableRows[0]);
    const csvRows = [
        headers.join(","),
        ...tableRows.map(row => headers.map(h => row[h]).join(","))
    ];
    Bun.write(csvFile, csvRows.join("\n"));
    console.log(`CSV saved to ${csvFile}`);
}

// --- Cross Table Calculation (count all crosses and avg, per outcome probability) ---
type CrossInfo = {
    crossCount: number;
    upCrossCount: number;
    downCrossCount: number;
    lastOutcome: string | "-";
};

const crossTable: Record<string, CrossInfo> = {};
let totalCrosses = 0;

for (const asset of assets) {
    // Get all trades for this asset, sorted by timestamp
    const assetTrades = filteredTradeDB
        .filter(trade => trade.eventSlug.includes(asset))
        .sort((a, b) => (a.timestamp) - (b.timestamp));

    let crossCount = 0;
    let upCrossCount = 0;
    let downCrossCount = 0;
    let lastOutcome: string | "-" = "-";
    let lastCrossOutcome: string | null = null;
    let upReady = false;
    let downReady = false;

    for (const trade of assetTrades) {
        if (trade.price >= 0.90) {
            if (trade.outcome === "Up") {
                if (!upReady) {
                    upReady = true;
                    if (downReady) {
                        crossCount++;
                        upCrossCount++;
                        lastCrossOutcome = "Up";
                        downReady = false; // reset to only count alternations
                    }
                }
            } else if (trade.outcome === "Down") {
                if (!downReady) {
                    downReady = true;
                    if (upReady) {
                        crossCount++;
                        downCrossCount++;
                        lastCrossOutcome = "Down";
                        upReady = false; // reset to only count alternations
                    }
                }
            }
        }
    }
    lastOutcome = lastCrossOutcome ?? "-";
    crossTable[asset] = { crossCount, upCrossCount, downCrossCount, lastOutcome };
    totalCrosses += crossCount;
}

const avgCrosses = (assets.length > 0) ? (totalCrosses / assets.length).toFixed(2) : "0";

console.log("\n=== Cross Table (Asset, Cross Count, Last Outcome to 0.90, P(Cross Up), P(Cross Down)) ===");
console.table(
    assets.map(asset => {
        const info = crossTable[asset];
        const pUp = info.crossCount > 0 ? (info.upCrossCount / info.crossCount * 100).toFixed(2) + "%" : "-";
        const pDown = info.crossCount > 0 ? (info.downCrossCount / info.crossCount * 100).toFixed(2) + "%" : "-";
        return {
            Asset: asset,
            "Cross Count": info.crossCount,
            "Last Outcome": info.lastOutcome,
            "P(Cross Up)": pUp,
            "P(Cross Down)": pDown
        };
    })
);
console.log(`Average Crosses per Asset: ${avgCrosses}`);

// Probability of cross happening (fraction of assets with at least one cross)
const assetsWithCross = assets.filter(asset => crossTable[asset].crossCount > 0).length;
const crossProbability = (assets.length > 0) ? (assetsWithCross / assets.length * 100).toFixed(2) : "0";
console.log(`Probability of Cross Happening: ${crossProbability}%`);

// --- Detailed Trade Analysis ---

type DetailedTradeInfo = {
    asset: string;
    outcome: string;
    dropStartTimestamp: string;
    dropEndTimestamp: string;
    timeToDropSeconds: number;
    startPrice: number;
    lowestPrice: number;
    dropPercentage: number;
    volumeDuringDrop: number;
    preDropTrend: 'uptrend' | 'downtrend' | 'sideways';
    recoveryPrice: number;
    recoveryRate: number;
    timeToRecoverSeconds: number | null;
};

const detailedAnalysis: DetailedTradeInfo[] = [];

for (const pair of conditionOutcomePairs) {
    const [id, outcome] = pair.split('::');

    const tradesForConditionOutcome = filteredTradeDB
        .filter(trade =>
            trade.conditionId === id &&
            trade.outcome === outcome &&
            assets.some(asset => trade.eventSlug.includes(asset))
        )
        .sort((a, b) => a.timestamp - b.timestamp);

    if (tradesForConditionOutcome.length === 0) continue;

    const slugTitle = tradesForConditionOutcome[0]?.eventSlug || "unknown";
    const asset = assets.find(a => slugTitle.includes(a));
    if (!asset) continue;

    for (let i = 0; i < tradesForConditionOutcome.length; i++) {
        const startTrade = tradesForConditionOutcome[i];

        if (startTrade.price >= 0.90) {
            let lowestPrice = startTrade.price;
            let lowestPriceIndex = i;
            let volumeDuringDrop = startTrade.size;

            for (let j = i + 1; j < tradesForConditionOutcome.length; j++) {
                const subsequentTrade = tradesForConditionOutcome[j];
                volumeDuringDrop += subsequentTrade.size;
                if (subsequentTrade.price < lowestPrice) {
                    lowestPrice = subsequentTrade.price;
                    lowestPriceIndex = j;
                }
            }

            if (lowestPrice < startTrade.price) {
                const dropStartTimestamp = startTrade.timestamp;
                const dropEndTimestamp = tradesForConditionOutcome[lowestPriceIndex].timestamp;
                const timeToDropSeconds = (dropEndTimestamp - dropStartTimestamp);

                // Pre-drop trend
                const trendWindow = tradesForConditionOutcome.slice(0, i).slice(-10);
                let preDropTrend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
                if (trendWindow.length > 1) {
                    const priceChange = startTrade.price - trendWindow[0].price;
                    if (priceChange > 0.05) preDropTrend = 'uptrend';
                    if (priceChange < -0.05) preDropTrend = 'downtrend';
                }

                // Recovery
                let recoveryPrice = lowestPrice;
                let recoveryPriceIndex = lowestPriceIndex;
                for (let k = lowestPriceIndex + 1; k < tradesForConditionOutcome.length; k++) {
                    if (tradesForConditionOutcome[k].price > recoveryPrice) {
                        recoveryPrice = tradesForConditionOutcome[k].price;
                        recoveryPriceIndex = k;
                    }
                }
                const recoveryRate = lowestPrice > 0 ? ((recoveryPrice - lowestPrice) / lowestPrice) * 100 : 0;
                const timeToRecoverSeconds = recoveryPrice > lowestPrice
                    ? (tradesForConditionOutcome[recoveryPriceIndex].timestamp - dropEndTimestamp)
                    : null;

                detailedAnalysis.push({
                    asset,
                    outcome,
                    dropStartTimestamp: new Date(dropStartTimestamp * 1000).toISOString(),
                    dropEndTimestamp: new Date(dropEndTimestamp * 1000).toISOString(),
                    timeToDropSeconds,
                    startPrice: startTrade.price,
                    lowestPrice,
                    dropPercentage: ((startTrade.price - lowestPrice) / startTrade.price) * 100,
                    volumeDuringDrop,
                    preDropTrend,
                    recoveryPrice,
                    recoveryRate,
                    timeToRecoverSeconds,
                });
            }
            // Move to the trade after the one that started the drop sequence to avoid re-processing
            i = tradesForConditionOutcome.length; // Only first occurrence per condition+outcome
        }
    }
}

console.log("\n=== Detailed Trade Analysis ===");
if (detailedAnalysis.length > 0) {
    const detailedCsvFile = "detailed_trade_analysis.csv";
    const detailedHeaders = Object.keys(detailedAnalysis[0]);
    const detailedCsvRows = [
        detailedHeaders.join(","),
        ...detailedAnalysis.map(row => detailedHeaders.map(h => row[h as keyof DetailedTradeInfo]).join(","))
    ];
    Bun.write(detailedCsvFile, detailedCsvRows.join("\n"));
    console.log(`Detailed analysis CSV saved to ${detailedCsvFile}`);
    console.table(detailedAnalysis.slice(0, 10)); // Display first 10 rows
} else {
    console.log("No detailed trade data to analyze.");
}


// --- Perfect Price Balance Table Calculation (All Assets, Multiple Price Examples for Ethereum) ---
const perfectPriceBalance: Record<string, Record<string, number>[]> = {
    xrp: [{ Up: 0.6, Down: 0.5 }],
    solana: [{ Up: 0.4, Down: 0.2 }],
    bitcoin: [{ Up: 0.1, Down: 0.7 }],
    ethereum: [
        { Up: 0.5, Down: 0.8 },
        { Up: 0.9, Down: 0.9 },
        { Up: 0.8, Down: 0.8 },
        { Up: 0.1, Down: 0.1 }
    ]
};

type BalanceResult = {
    Asset: string;
    Outcome: string;
    Example: string;
    Wins: number;
    Losses: number;
    Total: number;
    "Win Rate": string;
};

const balanceTable: BalanceResult[] = [];

for (const asset of assets) {
    // Use array of price configs for ethereum, single for others
    const configs = perfectPriceBalance[asset] ?? [];
    for (const config of configs) {
        for (const outcome of outcomes) {
            // Get all trades for this asset/outcome, sorted by timestamp
            const trades = filteredTradeDB
                .filter(trade =>
                    trade.eventSlug.includes(asset) &&
                    trade.outcome === outcome
                )
                .sort((a, b) => a.timestamp - b.timestamp);

            let wins = 0;
            let losses = 0;
            let i = 0;
            while (i < trades.length) {
                // Find next trade where price >= 0.90
                while (i < trades.length && trades[i].price < 0.90) i++;
                if (i >= trades.length) break;

                const balance = config[outcome];

                // Look for a subsequent trade <= balance
                let found = false;
                for (let j = i + 1; j < trades.length; j++) {
                    if (trades[j].price <= balance) {
                        wins++;
                        found = true;
                        i = j; // move i forward to avoid overlapping
                        break;
                    }
                }
                if (!found) {
                    losses++;
                    i++; // move to next trade
                } else {
                    i++; // move to next trade after win
                }
            }

            const total = wins + losses;
            const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) + "%" : "-";
            balanceTable.push({
                Asset: asset,
                Outcome: outcome,
                Example: `Up: ${config.Up}, Down: ${config.Down}`,
                Wins: wins,
                Losses: losses,
                Total: total,
                "Win Rate": winRate
            });
        }
    }
}

console.log("\n=== Perfect Price Balance Table (After Price >= 0.90, All Assets, Multiple Ethereum Examples) ===");
console.table(balanceTable);
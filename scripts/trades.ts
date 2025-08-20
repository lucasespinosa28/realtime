import { CONSTANT } from "../config";

const offsets: number[] = [0, 500, 1000]
interface Trade {
    proxyWallet: string,
    side: "BUY",
    asset: string,
    conditionId: string,
    size: number,
    price: number,
    timestamp: number,
    title: string,
    slug: string,
    icon: string,
    eventSlug: string,
    outcome: string,
    outcomeIndex: number,
    name: string,
    pseudonym: string,
    bio: string,
    profileImage: string,
    profileImageOptimized: string,
    transactionHash: string,
}
function unixToLocalDateTime(unixTimestamp: number): string {
    const date = new Date(unixTimestamp * 1000); // Convert seconds to milliseconds
    return date.toLocaleString(); // Returns local date and time as a string
}

const trades: Trade[] = [];
const TS_SEC: number[] = [];
const outcomes: number[] = [];

const solana = {
    buy: 0,
    sell: 0,
    TS_SEC: [] as number[],
    outcomes: [] as number[]
}

const bitcoin = {
    buy: 0,
    sell: 0,
    TS_SEC: [] as number[],
    outcomes: [] as number[]
}

const ripple = {
    buy: 0,
    sell: 0,
    TS_SEC: [] as number[],
    outcomes: [] as number[]
}

const ethereum = {
    buy: 0,
    sell: 0,
    TS_SEC: [] as number[],
    outcomes: [] as number[]
}

const ids: string[] = []
const custom: Trade[] = []
for (const offset of offsets) {
    const response = await fetch(`https://data-api.polymarket.com/trades?limit=500&offset=${offset}&takerOnly=false&&user=${CONSTANT.proxy}`, { method: 'GET', body: undefined });
    const data: Trade[] = await response.json();
    let outcome: number;
    for (const trade of data) {
        trade.date = unixToLocalDateTime(trade.timestamp);
        trades.push(trade)
        if (trade.side.includes("SELL")) {
            ids.push(trade.conditionId);
        }

        if (trade.slug.includes("bitcoin")) {
            bitcoin.TS_SEC.push(trade.timestamp);

            if (trade.side.includes("BUY")) {
                if (trade.outcome === "Up") {
                    outcome = 0;
                } else {
                    outcome = 1;
                }
            } else {
                if (trade.outcome === "Up") {
                    outcome = 2;
                } else {
                    outcome = 3;
                }
            }
            bitcoin.outcomes.push(outcome)
            if (trade.side === "BUY" && bitcoin.sell != 0) {
                bitcoin.buy += 1
            } else {
                bitcoin.sell += 1
            }
        }
        if (trade.slug.includes("ethereum")) {
            ethereum.TS_SEC.push(trade.timestamp);
            if (trade.side.includes("BUY")) {
                if (trade.outcome === "Up") {
                    outcome = 0;
                } else {
                    outcome = 1;
                }
            } else {
                if (trade.outcome === "Up") {
                    outcome = 2;
                } else {
                    outcome = 3;
                }
            }
            ethereum.outcomes.push(outcome)
            if (trade.side === "BUY" && ethereum.sell != 0) {
                ethereum.buy += 1
            } else {
                ethereum.sell += 1;
            }
        }
        if (trade.slug.includes("xrp")) {
            ripple.TS_SEC.push(trade.timestamp);
            if (trade.side.includes("BUY")) {
                if (trade.outcome === "Up") {
                    outcome = 0;
                } else {
                    outcome = 1;
                }
            } else {
                if (trade.outcome === "Up") {
                    outcome = 2;
                } else {
                    outcome = 3;
                }
            }
            ripple.outcomes.push(outcome)
            if (trade.side === "BUY" && ripple.sell != 0) {
                ripple.buy += 1
            } else {
                ripple.sell += 1
            }
        }
        if (trade.slug.includes("solana")) {
            solana.TS_SEC.push(trade.timestamp);
            if (trade.side.includes("BUY")) {
                if (trade.outcome === "Up") {
                    outcome = 0;
                } else {
                    outcome = 1;
                }
            } else {
                if (trade.outcome === "Up") {
                    outcome = 2;
                } else {
                    outcome = 3;
                }
            }
            solana.outcomes.push(outcome)
            if (trade.side === "BUY" && solana.sell != 0) {
                solana.buy += 1
            } else {
                solana.sell += 1;
            }
        }
    }
}
function checkWinRate(asset: { buy: number, sell: number }, name: string) {
    const winRate = asset.sell === 0 ? 0 : asset.buy / asset.sell;
    const meetsRequirement = winRate >= 10;
    console.log(`${name}: Buy/Sell = ${asset.buy}/${asset.sell} (${winRate.toFixed(2)}) - ${meetsRequirement ? "PASS" : "FAIL"}`);
}

checkWinRate(ethereum, "Ethereum");
checkWinRate(bitcoin, "Bitcoin");
checkWinRate(ripple, "Ripple");
checkWinRate(solana, "Solana");
// ...existing code...
await Bun.write("./data/trades.json", JSON.stringify(trades, null, 2));
await Bun.write("./data/BitcoinTimestamps.txt", bitcoin.TS_SEC.join(","));
await Bun.write("./data/BitcoinOutcome.txt", bitcoin.outcomes.join(","));
await Bun.write("./data/EthereumTimestamps.txt", ethereum.TS_SEC.join(","));
await Bun.write("./data/EthereumOutcome.txt", ethereum.outcomes.join(","));
await Bun.write("./data/RippleTimestamps.txt", ripple.TS_SEC.join(","));
await Bun.write("./data/RippleOutcome.txt", ripple.outcomes.join(","));
await Bun.write("./data/SolanaTimestamps.txt", solana.TS_SEC.join(","));
await Bun.write("./data/SolanaOutcome.txt", solana.outcomes.join(","));


await Bun.write("./data/custom.json", JSON.stringify(custom, null, 2));
import { CONSTANT } from "../config";

const offsets: number[] = [0, 500]
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
const outcome: number[] = [];

for (const offset of offsets) {
    const response = await fetch(`https://data-api.polymarket.com/trades?limit=500&offset=${offset}&takerOnly=false&&user=${CONSTANT.proxy}`, { method: 'GET', body: undefined });
    const data: Trade[] = await response.json();
    for (const trade of data) {
        trade.date = unixToLocalDateTime(trade.timestamp);
        trades.push(trade);
        TS_SEC.push(trade.timestamp);
        if (trade.outcome === "Up") {
            outcome.push(0);
        } else {
            outcome.push(1);
        }
    }
}
await Bun.write("trades.json", JSON.stringify(trades, null, 2));
await Bun.write("timestamps.txt", TS_SEC.join(","));
await Bun.write("outcome.txt", outcome.join(","));
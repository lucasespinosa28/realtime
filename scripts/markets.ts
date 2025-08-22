import { DatabaseManager } from "../lib/storage";
import { polymarket } from "../lib/trading";
import type { Market } from "../lib/trading/model";


const database = new DatabaseManager("markets.sqlite");

export async function fetchAndStoreMarkets() {
    let nextCursor = "";
    let page = 1;
    let latestCursor = "";
    const markets: Market[] = [];
    while (true) {
        const response = await polymarket.getMarkets(nextCursor);
        const { data, next_cursor } = response;
        if (!Array.isArray(data)) break;
        for (const market of data) {
            markets.push(market);
            database.setMarket(market);
        }
         console.log(`Fetched page ${page}, got ${data.length} markets.`);
          if (!next_cursor || next_cursor === "LTE=") {
                latestCursor = nextCursor;
                break;
            }
            nextCursor = next_cursor;
            page++;
    }

    await Bun.write("./data/latestCursor.txt", latestCursor.toString());
}

export async function updateMarketsFromCursor() {
    let nextCursor = "";
    try {
        nextCursor = await Bun.file("./data/latestCursor.txt").text();
    } catch {
        console.error("No ./data/latestCursor.txt found, cannot resume.");
        return;
    }
    let page = 1;
    let latestCursor = nextCursor;
    const markets: Market[] = [];
    while (true) {
        const response = await polymarket.getMarkets(nextCursor);
        const { data, next_cursor } = response;
        if (!Array.isArray(data)) break;
        for (const market of data) {
            markets.push(market);
            database.setMarket(market);
        }
        console.log(`(Update) Fetched page ${page}, got ${data.length} markets.`);
        if (!next_cursor || next_cursor === "LTE=") {
            latestCursor = nextCursor;
            break;
        }
        nextCursor = next_cursor;
        page++;
    }
    await Bun.write("./data/latestCursor.txt", latestCursor.toString());
}

if(await Bun.file("./data/latestCursor.txt").exists()){
    await updateMarketsFromCursor()
}else{
    await fetchAndStoreMarkets()
}
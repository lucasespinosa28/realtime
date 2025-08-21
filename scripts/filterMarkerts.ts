import { DatabaseManager } from "../lib/storage/database";
import type { Market, MarketToken } from "../lib/trading/model";
import { isTimeMatch, matchDateToday, parseSlugTime } from "../utils/time";


function checkTokens(tokens: MarketToken[]): boolean {
    for (const token of tokens) {
        if (token.price === 0) {
            return false;
        }
    }
    return true;
}
const database = new DatabaseManager("markets.sqlite");

export function crypto1hMarkets(): Market[] {
    const markets = database.getAllMarkets();
    const filteredMarkets: Market[] = [];
    for (const market of markets) {
        if (market.closed === false) {
            if (market.end_date_iso != null && matchDateToday(market.end_date_iso) && checkTokens(market.tokens) && market.tags.includes("Crypto")) {
                if (market.tags.includes("1H")) {
                    if (isTimeMatch(market.market_slug, parseSlugTime)) {
                        filteredMarkets.push({
                            ...market,
                            accepting_order_timestamp: market.accepting_order_timestamp == null
                                ? ""
                                : String(market.accepting_order_timestamp),
                        });
                    }
                }
            }
        }
    }
    return filteredMarkets;
}
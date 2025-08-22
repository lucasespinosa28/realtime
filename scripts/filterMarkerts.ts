import { DatabaseManager } from "../lib/storage/database";
import type { Market } from "../lib/trading/model";
import { isTimeMatchLegcy } from "../utils/time";



const database = new DatabaseManager("markets.sqlite");

export function crypto1hMarkets(): Market[] {
    const markets = database.getAllMarkets();
    const filteredMarkets: Market[] = [];
    for (const market of markets) {
        if (market.closed === false) {
            if (isTimeMatchLegcy(market.question.toLowerCase())) {
                filteredMarkets.push({
                    ...market,
                    accepting_order_timestamp: market.accepting_order_timestamp == null
                        ? ""
                        : String(market.accepting_order_timestamp),
                });
            }
        }

        // if (market.closed === false) {
        //     if (market.end_date_iso != null && matchDateToday(market.end_date_iso) && checkTokens(market.tokens) && market.tags.includes("Crypto")) {
        //         if (market.tags.includes("1H")) {
        //             const slugTime = parseSlugTime(market.market_slug);
        //             const etTime = getCurrentETParts();
        //             const match = slugTime &&
        //                 slugTime.month.toLowerCase() === etTime.month.toLowerCase() &&
        //                 slugTime.day === etTime.day;
        //             if (match) {
        //                 // console.log("Market:", market.market_slug, "| SlugTime:", slugTime, "| ET:", etTime, "| isToday:", match);
        //                 console.log(market.market_slug, "is a 1H crypto market");

        //             }
        //         }
        //     }
        // }
    }
    return filteredMarkets;
}
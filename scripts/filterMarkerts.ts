import { DatabaseManager } from "../lib/storage/database";
import type { Market, MarketToken } from "../lib/trading/model";
import { matchDateToday } from "../utils/time";


function checkTokens(tokens:MarketToken[]):boolean{
    for(const token of tokens){
        if(token.price === 0){
            return false;
        }
    }
    return true;
}
const database = new DatabaseManager("markets.sqlite");
const markerts: Market[] = [];
const markets = database.getAllMarkets();
// const monthName = new Date().toLocaleString('default', { month: 'long' });
for (const market of markets) {
    if (market.closed === false) {
        if (market.end_date_iso != null && matchDateToday(market.end_date_iso) && checkTokens(market.tokens) && market.tags.includes("Crypto")) {
            if(!market.tags.includes("1H")) {
                console.log(market.question)
                console.log(market.description)
                console.log(market.tags)
                markerts.push(market);
            }
        }
        // if (market.game_start_time != null && matchDateToday(market.game_start_time) && checkTokens(market.tokens)) {
        //     console.log(market.tags)
        //     markerts.push(market);
        // }
    }

}
const uniqueMarkets = Array.from(
  new Map(markerts.map(market => [market.condition_id, market])).values()
);

console.log(`Total unique markets in database: ${uniqueMarkets.length}`);
await Bun.write("./data/markets.json", JSON.stringify(uniqueMarkets, null, 2));

// console.log(monthName)


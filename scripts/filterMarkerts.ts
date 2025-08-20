import { DatabaseManager } from "../lib/storage/database";
import type { Market } from "../lib/trading/model";

//Sports
const database = new DatabaseManager("markets.sqlite");
let count: number = 0;
const markerts: Market[] = [];
const markets = database.getAllMarkets();
const monthName = new Date().toLocaleString('default', { month: 'long' });
for (const market of markets) {
    if (market.tags.includes("Up or Down") && market.market_slug.includes(monthName.toLowerCase()) && market.accepting_orders) {
        count++;
        markerts.push(market);
    }
    // if (market.end_date_iso) {
    //     if (market.accepting_orders && market.tags.includes("Sports") && market.end_date_iso.includes("2025-08-19")) {
    //         count++;
    //         markerts.push(market);
    //     }
    // }
    // if(market.market_slug.includes("mlb-hou-det-2025-08-19")){
    //     count++;
    //      markerts.push(market);
    // }


}

console.log(`Total markets in database: ${count}`);
await Bun.write("crypto.json", JSON.stringify(markerts, null, 2));
console.log(monthName)


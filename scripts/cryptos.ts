import { DatabaseManager } from "../lib/storage/database";
import { isTimeMatch } from "../utils/time";

//Sports
const database = new DatabaseManager("markets.sqlite");
const markets = database.getAllMarkets();
let count = 0;
const store = new Map();
for (const market of markets) {
    count++;
    if(store.has(market.condition_id)){
      // console.log(market.question);
    }else{
        console.log(market.question)
    }
    store.set(market.condition_id,true);
    // if(isTimeMatch(market.question)){
    //     console.log(market.question)
    //     market.co
    // }
    
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
console.log({count})
// console.log(`Total markets in database: ${count}`);
// await Bun.write("crypto.json", JSON.stringify(markerts, null, 2));
// console.log(monthName)


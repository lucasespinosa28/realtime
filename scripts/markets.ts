import { getMarkets } from "../lib/trading/old/getMarket";

const markets = await getMarkets();
console.log({tokens:markets[0].rewards});
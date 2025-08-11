import { getMarkets } from "../lib/trading";

const markets = await getMarkets();
console.log({tokens:markets[0].rewards});
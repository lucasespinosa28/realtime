import type { TradeData } from "../../main";
import { polymarketAPILogger } from "../../utils/logger";



const priceHandler = (tradeData: TradeData): number => {
  // Check if current time has 40 minutes or less (e.g., 8:40, 12:30, etc.)
  let price = 0.8
  if (tradeData.title.includes("XRP") && tradeData.outcome.includes("Up")) {
    polymarketAPILogger.info("XRP detected, setting price to 0.70");
    price = 0.70;
  }
  return price;
};

export default priceHandler;
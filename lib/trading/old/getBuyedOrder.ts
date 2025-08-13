import { clienAuth, address } from "..";
import { polymarketAPILogger } from "../../../utils/logger";



export const getBuyedOrder = async (market: string) => {
  try {
    return await clienAuth.getTrades({ market: market, maker_address: address });
  } catch (error) {
    polymarketAPILogger.error("Error getting bought orders: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

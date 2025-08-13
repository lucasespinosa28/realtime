import { clobClient } from "..";
import { polymarketAPILogger } from "../../../utils/logger";



export const getPricesHistory = async (market: string, startTs: number, endTs: number) => {
  try {
    return clobClient.getPricesHistory({ market, startTs, endTs });
  } catch (error) {
    polymarketAPILogger.error("Error getting prices history: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

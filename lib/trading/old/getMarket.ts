import { clobClient } from "..";
import { polymarketAPILogger } from "../../../utils/logger";
import type { Market } from "../model";

/**
 * Get market information by condition ID
 */



export async function getMarket(conditionId: string): Promise<Market> {
  try {
    return await clobClient.getMarket(conditionId);
  } catch (error) {
    polymarketAPILogger.error("Error getting market for {conditionId}: {error}", {
      conditionId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function getMarkets(): Promise<Market[]> {
  try {
    const response = await clobClient.getMarkets();
    // Adjust 'data' to the correct property containing the array of markets
    return response.data as Market[];
  } catch (error) {
    polymarketAPILogger.error("Error getting markets: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

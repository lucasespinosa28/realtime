import polymarket from "./client";
import { polymarketAPILogger } from "../../utils/logger";

/**
 * Get book information by asset ID
 */

const getBook = async (tokenId: string) => {
  try {
    return await polymarket.getOrderBook(tokenId);
  } catch (error) {
    polymarketAPILogger.error("Error getting market for {tokenId}: {error}", {
      tokenId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

export default getBook;
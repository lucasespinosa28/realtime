import { clienAuth } from "..";
import { polymarketAPILogger } from "../../../utils/logger";


export const getOrder = async (orderId: string) => {
  try {
    return await clienAuth.getOrder(orderId);
  } catch (error) {
    polymarketAPILogger.error("Error getting order: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

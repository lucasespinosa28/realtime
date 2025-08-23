import { OrderType, Side } from "@polymarket/clob-client";
import polymarket from "./client";
import type { Order } from "./model";
import { polymarketAPILogger } from "../../utils/logger";


const postOrder = async (asset: string, price: number, size: number): Promise<Order> => {
  // Validate price range
  if (price < 0.01 || price >= 0.99) {
    throw new Error(`Invalid price ${price}: must be between 0.01 and 0.99`);
  }
  
  try {
    const order: Order = await polymarket.createAndPostOrder(
      {
        tokenID: asset,
        price: price,
        side: Side.BUY,
        size: size,
        feeRateBps: 0,
      },
      { tickSize: "0.01", negRisk: false },
      OrderType.GTC
    );
    return order;
  } catch (error) {
    polymarketAPILogger.error("Error placing order for {asset}: {error}", {
      asset,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export default postOrder;
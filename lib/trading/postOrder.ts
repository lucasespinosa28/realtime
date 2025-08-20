import { OrderType, Side } from "@polymarket/clob-client";
import polymarket from "./client";
import type { Order } from "./model";
import { polymarketAPILogger } from "../../utils/logger";


const postOrder = async (asset: string, price: number, size: number): Promise<Order> => {
  if (price >= 0.99) {
    polymarketAPILogger.error("Order not allowed: price must be less than 0.99");
    return Promise.reject(new Error("Order not allowed: price must be less than 0.99"));
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
    polymarketAPILogger.error("Error placing order for {title}:{tokenID}: {error}", {
      asset,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export default postOrder;
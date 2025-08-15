import { OrderType, Side } from "@polymarket/clob-client";
import polymarket from "./client";
import type { Order } from "./model";
import { polymarketAPILogger } from "../../utils/logger";


const postOrder = async (asset: string, price: number, size: number,title:string,outcome:string): Promise<Order> => {
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


    polymarketAPILogger.info("Buy order placed for {title} at price {outcome}-{price}", {
      title,
      outcome,
      price
    });

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
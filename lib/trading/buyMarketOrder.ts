import { OrderType, Side } from "@polymarket/clob-client";
import polymarket from "./client";
import type { Order } from "./model";
import { polymarketAPILogger } from "../../utils/logger";

const buyMarketOrder = async (asset: string, size: number, title: string): Promise<Order> => {

  try {
    const order: Order = await polymarket.createAndPostMarketOrder(
      {
        tokenID: asset,
        amount: size,
        side: Side.BUY,
        feeRateBps: 0,
      },
      { tickSize: "0.01", negRisk: false },
      OrderType.FAK
    );
    return order;
  } catch (error) {
    polymarketAPILogger.error("Error placing order for {title}:{tokenID}: {error} asset:{asset}", {
      title,
      error: error instanceof Error ? error.message : String(error),
      asset
    });
    throw error;
  }
}

export default buyMarketOrder;
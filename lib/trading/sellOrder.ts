import { OrderType, Side } from "@polymarket/clob-client";
import polymarket from "./client";
import type { Order } from "./model";
import { polymarketAPILogger } from "../../utils/logger";

const sellOrder = async (asset: string, size: number, title: string, outcome: string): Promise<Order> => {

  try {
    const order: Order = await polymarket.createAndPostMarketOrder(
      {
        tokenID: asset,
        amount: size,
        side: Side.SELL,
        feeRateBps: 0,
      },
      { tickSize: "0.01", negRisk: false },
      OrderType.FAK
    );


    polymarketAPILogger.info("Sell order placed for {title} outcome: {outcome}", {
      title,
      outcome,
    });

    return order;
  } catch (error) {
    polymarketAPILogger.error("Error placing order for {title}:{tokenID}: {error}", {
      title,
      outcome,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export default sellOrder;
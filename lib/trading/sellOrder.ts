import { OrderType, Side } from "@polymarket/clob-client";
import polymarket from "./client";
import type { Order } from "./model";
import { polymarketAPILogger } from "../../utils/logger";

  const sellOrder = async (asset: string, price: number, size: number): Promise<Order> => {
  const fixedPrice = Number(price.toFixed(2));

  try {
    const order: Order = await polymarket.createAndPostOrder(
      {
        tokenID: asset,
        price: fixedPrice,
        side: Side.SELL,
        size: size,
        feeRateBps: 0,
      },
      { tickSize: "0.01", negRisk: false },
      OrderType.GTC
    );


    polymarketAPILogger.info("Sell order placed for {asset} at price {price}", {
      asset,
      price: fixedPrice
    });

    return order;
  } catch (error) {
    polymarketAPILogger.error("Error placing order for {tokenID}: {error}", {
      asset,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export default sellOrder;
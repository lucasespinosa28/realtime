import { OrderType, Side } from "@polymarket/clob-client";
import polymarket from "./client";
import type { Order } from "./model";
import { polymarketAPILogger } from "../../utils/logger";

const postOrder = async (asset: string, price: number, size: number): Promise<Order> => {
  const fixedPrice = Number(price.toFixed(2));
  if (fixedPrice !== price) {
    price = fixedPrice;
  }

  // Check if current time has 40 minutes or less (e.g., 8:40, 12:30, etc.)
  const currentTime = new Date();
  const minutes = currentTime.getMinutes();


  if ([0.96, 0.97, 0.98, 0.99].includes(price)) {
    price = 0.95;
  }

  if ([0.90, 0.91, 0.92, 0.93, 0.94].includes(price)) {
    price = 0.90;
  }

  if (minutes <= 40) {
    price = 0.90;
    polymarketAPILogger.info("Time has {minutes} minutes (≤40), setting price to 0.90", { minutes });
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


    polymarketAPILogger.info("Buy order placed for {asset} at price {price}", {
      asset,
      price
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

export default postOrder;
import polymarket from "./client";
import { polymarketAPILogger } from "../../utils/logger";

  const cancelOrder = async (orderId: string,title:string,outcome:string): Promise<unknown> => {

  try {
     const order = await polymarket.cancelOrder({
        orderID: orderId,
    });

    polymarketAPILogger.info("Order {orderId} for {title}-{outcome} was canceled", {
      orderId,
      title,
      outcome
    });

    return order;
  } catch (error) {
    polymarketAPILogger.error("Error canceling order {orderId} for {title}-{outcome} : {error}", {
      orderId,
      title,
      outcome,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export default cancelOrder;
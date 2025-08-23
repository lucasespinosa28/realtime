import { OrderType, Side, type PostOrdersArgs } from "@polymarket/clob-client";
import polymarket from "./client";
import { polymarketAPILogger } from "../../utils/logger";
import type { Order } from "./model";

export const buyMuiltiple = async (tokenID: string): Promise<Order[]> => {
    if (!tokenID) {
        polymarketAPILogger.error("tokenID is required");
        throw new Error("tokenID is required");

    }

    const orders: PostOrdersArgs[] = [
        {
            order: await polymarket.createOrder({
                tokenID,
                price: 0.9,
                side: Side.BUY,
                size: 10,
            }),
            orderType: OrderType.GTC,
        },
        {
            order: await polymarket.createOrder({
                tokenID,
                price: 0.5,
                side: Side.BUY,
                size: 10,
            }),
            orderType: OrderType.GTC,
        },
        {
            order: await polymarket.createOrder({
                tokenID,
                price: 0.05,
                side: Side.BUY,
                size: 10,
            }),
            orderType: OrderType.GTC,
        },
    ];
    try {
        const order = await polymarket.postOrders(orders);
        return order
    } catch (error) {
        polymarketAPILogger.error("Error placing order for {tokenID}: {error}", {
            tokenID,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}
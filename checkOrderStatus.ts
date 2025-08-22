import { storageOrder } from "./lib/storage/memory";
import { polymarket } from "./lib/trading";
import type { TradeData } from "./main";
import { appLogger } from "./utils/logger";

/**
 * Checks if a placed buy order has been matched
 */
export async function checkOrderStatus(tradeData: TradeData): Promise<void> {
    if (!storageOrder.hasId(tradeData.asset)) return; // nothing to check
    const storedOrder = storageOrder.get(tradeData.asset);
    // Skip if already matched or outcome doesn't match
    if (storedOrder.status === "MATCHED") {
        return;
    }
    const orderId = storedOrder.orderID;
    if (!orderId) {
        return;
    }
    try {
        const order = await polymarket.getOrder(orderId);
        if (order.status === "MATCHED") {
            appLogger.info("Buy order matched for condition {conditionId}", {
                conditionId: tradeData.title,
            });
            // Update storageOrder with matched status
            storageOrder.add(tradeData.asset, {
                orderID: orderId,
                asset: tradeData.asset,
                status: "MATCHED",
                conditionId: tradeData.conditionId
            });
        }
    } catch (error) {
        appLogger.error("Error checking order status for {conditionId}: {error}", {
            conditionId: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}
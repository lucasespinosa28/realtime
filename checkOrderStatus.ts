import { storageOrder } from "./lib/storage/memory";
import { polymarket, sellOrder } from "./lib/trading";
import type { TradeData } from "./main";
import { appLogger } from "./utils/logger";

/**
 * Checks if a placed buy order has been matched
 */
export async function checkOrderStatus(tradeData: TradeData): Promise<void> {
    if (!storageOrder.hasId(tradeData.asset)) {
        appLogger.debug("No stored order found for asset {asset} - skipping status check", { asset: tradeData.asset });
        return;
    }

    const storedOrder = storageOrder.get(tradeData.asset);
    appLogger.debug("Checking order status for asset {asset}, current status: {status}, orderID: {orderID}", {
        asset: tradeData.asset,
        status: storedOrder.status,
        orderID: storedOrder.orderID
    });

    // Skip if already matched or outcome doesn't match
    if (storedOrder.status === "MATCHED") {
        appLogger.debug("Order already matched for asset {asset} - skipping check", { asset: tradeData.asset });
        return;
    }

    const orderId = storedOrder.orderID;
    if (!orderId) {
        appLogger.warn("No orderID found for asset {asset} with status {status} - cannot check status", {
            asset: tradeData.asset,
            status: storedOrder.status
        });
        return;
    }

    try {
        appLogger.debug("Fetching order status from Polymarket API for orderID {orderID}", { orderID: orderId });
        const order = await polymarket.getOrder(orderId);

        appLogger.debug("Order status response for {orderID}: {status}", {
            orderID: orderId,
            status: order.status
        });


        if (order.status === "MATCHED") {
            appLogger.info("Buy order matched for condition {conditionId} (asset: {asset}, orderID: {orderID})", {
                conditionId: tradeData.title,
                asset: tradeData.asset,
                orderID: orderId
            });
            // Update storageOrder with matched status
            storageOrder.add(tradeData.asset, {
                orderID: orderId,
                asset: tradeData.asset,
                status: "MATCHED",
                conditionId: tradeData.conditionId
            });

            // Only place sell order if title includes "bitcoin" or minutes < 30
            const currentMinutes = new Date().getMinutes();
            if (
                tradeData.title.toLowerCase().includes("bitcoin") ||
                currentMinutes < 45
            ) {
                const sellOrderResult = await sellOrder(
                    order.asset_id,
                    0.90,
                    5,
                );

                if (sellOrderResult.success) {
                    appLogger.info("Sell order placed for asset {title} at price 0.90 with size 5", {
                        title: tradeData.title
                    });
                }
            }
        } else if (order.status !== storedOrder.status) {
            // Log status changes
            appLogger.info("Order status changed for asset {asset}: {oldStatus} → {newStatus}", {
                asset: tradeData.asset,
                oldStatus: storedOrder.status,
                newStatus: order.status
            });
            // Update with new status
            storageOrder.add(tradeData.asset, {
                orderID: orderId,
                asset: tradeData.asset,
                status: order.status,
                conditionId: tradeData.conditionId
            });

        }
    } catch (error) {
        appLogger.error("Error checking order status for {conditionId} (asset: {asset}, orderID: {orderID}): {error}", {
            conditionId: tradeData.title,
            asset: tradeData.asset,
            orderID: orderId,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}


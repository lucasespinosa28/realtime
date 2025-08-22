import { memoryDatabase } from "../../main";
import { appLogger } from "../../utils/logger";
import type { TradeData } from "../storage/model";
import { polymarket } from "../trading";

/**
 * Checks if a placed buy order has been matched
 */
export async function checkOrderStatus(tradeData: TradeData): Promise<void> {
    if (!memoryDatabase.existTradeOrder(tradeData.asset)) {
        appLogger.debug("No stored order found for asset {asset} - skipping status check", { asset: tradeData.asset });
        return;
    }

    const storedOrder = memoryDatabase.readTradeOrder(tradeData.asset);
    appLogger.debug("Checking order status for asset {asset}, current status: {status}, orderID: {orderID}", {
        asset: storedOrder?.tradeData.asset,
        status: storedOrder?.status,
        orderID: storedOrder?.orderID
    });

    // Skip if already matched or outcome doesn't match
    if (storedOrder?.status === "MATCHED") {
        appLogger.debug("Order already matched for asset {title} {asset} - skipping check", { title: tradeData.title, asset: tradeData.asset });
        return;
    }

    const orderId = storedOrder?.orderID;
    if (!orderId) {
        // appLogger.warn("No orderID found for asset {title} {asset} with status {status} - cannot check status", {
        //     title: storedOrder?.tradeData.title,
        //     asset: storedOrder?.tradeData.asset,
        //     status: storedOrder?.status
        // });
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
            memoryDatabase.updateTradeOrder({
                orderID: orderId,
                status: "MATCHED",
                tradeData: tradeData
            });

        } else if (order.status !== storedOrder.status) {
            // Log status changes
            appLogger.info("Order status changed for asset {asset}: {oldStatus} → {newStatus}", {
                asset: tradeData.asset,
                oldStatus: storedOrder.status,
                newStatus: order.status
            });
            // Update with new status
            memoryDatabase.updateTradeOrder({
                orderID: orderId,
                status: order.status,
                tradeData: tradeData
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


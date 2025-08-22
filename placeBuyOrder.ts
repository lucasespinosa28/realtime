import { logger, storageOrder } from "./lib/storage/memory";
import { postOrder } from "./lib/trading";
import { boughtAssets, processedConditionIds, type TradeData } from "./main";
import { appLogger } from "./utils/logger";

/**
 * Places a buy order for a given asset
 */
export async function placeBuyOrder(tradeData: TradeData): Promise<boolean> {
    try {
        appLogger.debug("Starting placeBuyOrder for {title} (asset: {asset}, conditionId: {conditionId})", {
            title: tradeData.title,
            asset: tradeData.asset,
            conditionId: tradeData.conditionId
        });

        // Check if we already processed this condition
        if (processedConditionIds.has(tradeData.conditionId)) {
            // Only log the first time we see this conditionId
            if (!logger.get(`logged:${tradeData.conditionId}`)) {
                appLogger.info("Order already placed for condition {title} — skipping post for asset {asset}", {
                    title: tradeData.title,
                    asset: tradeData.asset
                });
                logger.add(`logged:${tradeData.conditionId}`, true);
            }
            return true;
        }

        // Double-check idempotency: if memory already contains a buy for this asset, skip
        if (boughtAssets.has(tradeData.asset)) {
            appLogger.info("Buy already recorded in memory for asset {asset} — skipping post", { asset: tradeData.asset });
            return true;
        }

        const title = tradeData.title.toLowerCase();
        let price = 0.8;
        switch (true) {
            case title.includes("xrp"):
                price = 0.5;
                break;
            case title.includes("solana"):
                price = 0.8;
                break;
            case title.includes("bitcoin"):
                price = 0.05;
                break;
            case title.includes("ethereum"):
                price = 0.8;
                break;
            default:
                price = 0.8;
        }
        appLogger.info("Calculated price for {title}: originalPrice={originalPrice} -> calculatedPrice={calculatedPrice}", {
            title: tradeData.title,
            originalPrice: tradeData.price,
            calculatedPrice: price
        });

        appLogger.debug("Posting order: asset={asset}, price={price}, size=5", {
            asset: tradeData.asset,
            price: price
        });

        const order = await postOrder(
            tradeData.asset,
            price,
            5,
        );
        
        if (order.success) {
            // Track in memory to avoid future DB checks
            boughtAssets.add(tradeData.asset);
            // Mark this conditionId as processed
            processedConditionIds.add(tradeData.conditionId);
            // Update storageOrder with order details
            storageOrder.add(tradeData.asset, {
                orderID: order.orderID,
                asset: tradeData.asset,
                status: order.status,
                conditionId: tradeData.conditionId
            });
            appLogger.info("✅ Buy order placed successfully for {title}: price={price}, orderID={orderID}, status={status}, conditionId={conditionId}", {
                title: tradeData.title,
                price,
                orderID: order.orderID,
                status: order.status,
                conditionId: tradeData.conditionId
            });
            return true;
        } else {
            // Mark as failed
            storageOrder.add(tradeData.asset, {
                orderID: "",
                asset: tradeData.asset,
                status: "failed",
                conditionId: tradeData.conditionId
            });
            appLogger.warn("❌ Buy order failed for {title} asset {asset}: success={success}", { 
                title: tradeData.title, 
                asset: tradeData.asset,
                success: order.success
            });
            return false;
        }
    } catch (error) {
        appLogger.error("❌ Error placing buy order for {title} (asset: {asset}, conditionId: {conditionId}): {error}", {
            title: tradeData.title,
            asset: tradeData.asset,
            conditionId: tradeData.conditionId,
            error: error instanceof Error ? error.message : String(error)
        });
        // Clean up processing status on error to allow retry
        storageOrder.delete(tradeData.asset);
        return false;
    }
}

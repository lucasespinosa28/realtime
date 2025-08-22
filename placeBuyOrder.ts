import { logger, storageOrder } from "./lib/storage/memory";
import { postOrder } from "./lib/trading";
import { boughtAssets, getOppositeAsset, processedConditionIds, type TradeData } from "./main";
import { appLogger } from "./utils/logger";

/**
 * Places a buy order for a given asset
 */
export async function placeBuyOrder(tradeData: TradeData): Promise<boolean> {
    const currentMinutes = new Date().getMinutes();
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

        let price = 0.8;
        const title = tradeData.title.toLowerCase();
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
        // If currentMinutes is less than 30, set price to 0.5 (overrides switch)
        if (currentMinutes <= 30) {
            appLogger.debug("Current minutes {currentMinutes} is less than or equal to 30, setting price to 0.5", {
                currentMinutes
            });
            price = 0.5;
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
        // const oppositeAsset = getOppositeAsset(tradeData.asset);
        //let asset = tradeData.asset;
        // if (tradeData.title.toLowerCase().includes("bitcoin")) {
        //     if (currentMinutes > 50) {
        //         appLogger.info("Current minutes {currentMinutes} is greater than 50, skipping postOrder for bitcoin with opposite asset", {
        //             currentMinutes
        //         });
        //         return false;
        //     }
        //     if (!oppositeAsset) {
        //         appLogger.error("Opposite asset is undefined for tradeData: {tradeData}", { tradeData });
        //         return false;
        //     }
        //     asset = oppositeAsset;
        // }
        if (!tradeData.asset) {
            appLogger.error("Asset is undefined for tradeData: {tradeData}", { tradeData });
            return false;
        }
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

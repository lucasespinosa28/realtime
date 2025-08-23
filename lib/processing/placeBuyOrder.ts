import { boughtAssets, processedConditionIds } from "./state";
import { postOrder } from "../trading";
import { memoryDatabase } from "../storage/database";
import { appLogger } from "../../utils/logger";
import type { TradeData } from "../storage/model";
import { logger } from "../storage";
import { formatTitle } from "../../utils/parse";

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
        const baseTitle = formatTitle(tradeData.title);
        const instruction = memoryDatabase.getInstructionByTitle(baseTitle);

        const price = instruction?.price || 0.8;
        const size = instruction?.size || 5;

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
            size,
        );
        if (order.success) {
            // Track in memory to avoid future DB checks
            boughtAssets.add(tradeData.asset);
            // Mark this conditionId as processed
            processedConditionIds.add(tradeData.conditionId);
            // Save/update memoryDatabase with order details
            memoryDatabase.createTradeOrder({
                orderID: order.orderID,
                status: order.status,
                tradeData: tradeData,
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
            // Save failed order to database
            memoryDatabase.createTradeOrder({
                orderID: "",
                tradeData: tradeData,
                status: "failed",
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
        memoryDatabase.deleteTradeOrder(tradeData.asset);
        return false;
    }
}

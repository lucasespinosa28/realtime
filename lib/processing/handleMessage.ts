import { appLogger } from "../../utils/logger";
import { checkOrderStatus } from "./checkOrderStatus";
import { placeBuyOrder } from "./placeBuyOrder";
import {
    boughtAssets,
    processedConditionIds,
    inFlightConditionIds
} from "./state";
import { titles } from "./marketData";
import type { RealTimeDataClient, Message } from "../websocket";
import { memoryDatabase, orderBookDatabase } from "../storage/database";
import type { TradeData } from "../storage/model";
import { formatTitle } from "../../utils/parse";

const TRADING_RULES = {
    START_TIME: 0,
    BUY_PRICE_THRESHOLD: 0.90,
} as const;

export async function handleMessage(_client: RealTimeDataClient, message: Message): Promise<void> {
    const asks = message.payload.asks;
    const bids = message.payload.bids;

    orderBookDatabase.create(message.payload);

    const title = titles.get(message.payload.asset_id);
    if (!title) {
        appLogger.warn("Title not found for asset_id: {assetId} - skipping message", { assetId: message.payload.asset_id });
        throw new Error(`Title not found for asset_id: ${message.payload.asset_id}`);
    }

    const bidBook = bids.reverse()[0];
    if (!bidBook) {
        appLogger.debug("No bids available for asset {assetId} - skipping processing", { assetId: message.payload.asset_id });
        return;
    }

    const tradeData: TradeData = {
        conditionId: message.payload.market,
        asset: message.payload.asset_id,
        title,
        price: Number(bidBook.price),
        timestamp: message.timestamp,
    };

    appLogger.debug("Received orderbook for asset {title} {assetId}: {askCount} asks, {bidCount} bids", {
        title: tradeData.title,
        assetId: message.payload.asset_id,
        askCount: asks?.length || 0,
        bidCount: bids?.length || 0
    });

    if (memoryDatabase.existTradeOrder(tradeData.asset)) {
        appLogger.debug("Found existing order for asset {title} {asset} - checking status", { asset: tradeData.asset, title: tradeData.title });
        await checkOrderStatus(tradeData);
    }
    await maybePlaceBuyOrder(tradeData);

}

async function maybePlaceBuyOrder(tradeData: TradeData) {
    const currentMinutes = new Date().getMinutes();
    // Use the extracted base title for lookup - this is already formatted by formatTitle
    const baseTitle = formatTitle(tradeData.title)
    const instruction = memoryDatabase.getInstructionByTitle(baseTitle); // Don't format again!

    if (!instruction) {
        appLogger.warn("No instruction found for title: {title} (base: {baseTitle}) - skipping buy order", {
            title: tradeData.title,
            baseTitle
        });
        return;
    }

    // Prevent posting if currentMinutes > 50 and instruction.penny === 0
    if (currentMinutes > 50 && instruction.penny === 0) {
        appLogger.debug("Not allowed to post for {title}: currentMinutes={currentMinutes} > 50 and penny=0", {
            title: tradeData.title,
            currentMinutes
        });
        return;
    }

    const withinBuyWindow = instruction.minutes < currentMinutes;

    appLogger.debug("Processing trade data for {title}: price={price}, conditionId={conditionId}, withinBuyWindow={withinBuyWindow}", {
        title: tradeData.title,
        price: tradeData.price,
        conditionId: tradeData.conditionId,
        withinBuyWindow: instruction.minutes < currentMinutes
    });

   const shouldBuy = instruction.penny === 1
    && withinBuyWindow
    && tradeData.price >= instruction.price;

    if (shouldBuy) {
        if (
            processedConditionIds.has(tradeData.conditionId) ||
            inFlightConditionIds.has(tradeData.conditionId) ||
            boughtAssets.has(tradeData.asset)
        ) {
            appLogger.debug("Skipping buy order for {title}: alreadyProcessed={processed}, inFlight={inFlight}, alreadyBought={bought}", {
                title: tradeData.title,
                processed: processedConditionIds.has(tradeData.conditionId),
                inFlight: inFlightConditionIds.has(tradeData.conditionId),
                bought: boughtAssets.has(tradeData.asset)
            });
            return;
        }

        appLogger.info("Initiating buy order for {title}: price={price} >= threshold={threshold}", {
            title: tradeData.title,
            price: tradeData.price,
            threshold: TRADING_RULES.BUY_PRICE_THRESHOLD
        });

        inFlightConditionIds.add(tradeData.conditionId);
        appLogger.debug("Marked conditionId {conditionId} as in-flight", { conditionId: tradeData.conditionId });

        memoryDatabase.createTradeOrder({
            orderID: "",
            status: "processing",
            tradeData: tradeData,
        });

        try {
            await placeBuyOrder(tradeData);
        } finally {
            inFlightConditionIds.delete(tradeData.conditionId);
            appLogger.debug("Released in-flight lock for conditionId {conditionId}", { conditionId: tradeData.conditionId });
        }
    } else {
        appLogger.debug("Not placing buy order for {title}: withinBuyWindow={withinBuyWindow}, price={price}, threshold={threshold}", {
            title: tradeData.title,
            withinBuyWindow,
            price: tradeData.price,
            threshold: TRADING_RULES.BUY_PRICE_THRESHOLD
        });
    }
}
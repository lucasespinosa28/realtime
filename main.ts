import { instructions } from "./config";
import { shouldProcessMessage } from "./lib/processing";
import { createRecord } from "./lib/storage";
import { DatabaseManager } from "./lib/storage/database";
import storage from "./lib/storage/memory";
import { getBook, polymarket, postOrder, sellOrder } from "./lib/trading";
import { RealTimeDataClient } from "./lib/websocket";
import type { Message } from "./lib/websocket/model";
import { airtableLogger, appLogger, configureLogging } from "./utils/logger";
import { extractCoinFromEvent } from "./utils/time";

const databaseManager = new DatabaseManager();
const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {


    for (const instruction of instructions) {
        if (!shouldProcessMessage(message, instruction.slug)) {
            continue;
        }
        const id = message.payload.conditionId;
        const title = message.payload.title;
        const eventSlug = message.payload.eventSlug;
        const outcome = message.payload.outcome;
        const tokenId = message.payload.asset;
        const price = message.payload.price;
        const timestamp = message.payload.timestamp;
        const size = message.payload.size;
        const side = message.payload.side;
        if (storage.hasId(id)) {
            if (storage.get(id).outcome === outcome) {
                const orderId = storage.get(id).orderID;
                // Only call getOrder if we have a valid orderID
                if (orderId && orderId !== "") {
                    const order = await polymarket.getOrder(orderId);
                    if (order.status === "MATCHED") {
                        storage.add(id, { orderID: orderId, asset: tokenId, outcome: outcome, status: order.status });
                    }
                }
            }
        }

        if (storage.hasId(id)) {
            if (storage.get(id).status == "MATCHED" && storage.get(id).outcome == outcome) {
                // Check if price dropped below 0.5 and current time has minutes > 55
                // Only proceed if we haven't already sold this position
                if (price < 0.51 && storage.get(id).status !== "SOLD") {
                    const currentTime = new Date();
                    const minutes = currentTime.getMinutes();

                    if (minutes > 55) {
                        // Mark as processing sell to prevent duplicate sell orders
                        storage.add(id, { orderID: storage.get(id).orderID, asset: tokenId, outcome: outcome, status: "SELLING" });
                        
                        const book = await getBook(tokenId);
                        const ask = book.asks[0];
                        const askPrice = parseFloat(ask.price);
                        if (!book.asks.length || !book.bids.length) {
                            appLogger.warn(`Order not placed: empty asks or bids for tokenId ${tokenId}, title: ${title}`);
                            // Revert status back to MATCHED since sell failed
                            storage.add(id, { orderID: storage.get(id).orderID, asset: tokenId, outcome: outcome, status: "MATCHED" });
                            return;
                        }

                        try {
                            const sellOrderResult = await sellOrder(tokenId, askPrice, instruction.size);
                            if (sellOrderResult.success) {
                                appLogger.info("Sell order placed for condition {id} at price {askPrice} (minutes: {minutes}) title: {title}", { id, askPrice, minutes, title });
                                // Update storage to reflect sell order - this prevents any future selling for this condition
                                storage.add(id, { orderID: sellOrderResult.orderID, asset: tokenId, outcome: outcome, status: "SOLD" });
                            } else {
                                // Sell order failed, revert status back to MATCHED
                                storage.add(id, { orderID: storage.get(id).orderID, asset: tokenId, outcome: outcome, status: "MATCHED" });
                            }
                        } catch (error) {
                            appLogger.error("Error placing sell order for condition {id}: {error} title: {title}", {
                                id,
                                title,
                                error: error instanceof Error ? error.message : String(error)
                            });
                            // Revert status back to MATCHED since sell failed
                            storage.add(id, { orderID: storage.get(id).orderID, asset: tokenId, outcome: outcome, status: "MATCHED" });
                        }
                    } else {
                        appLogger.info("Price below 0.5 but minutes ({minutes}) not > 55, skipping sell for condition {id} title: {title}", { minutes, id, title });
                    }
                }
            }
        }

        databaseManager.createMarket({
            id: id,
            title: title,
            order: [],
            Up: { assetId: "", trades: [] },
            Down: { assetId: "", trades: [] }
        });
        if (outcome === "Up" || outcome === "Down") {
            databaseManager.setAssetId(id, outcome, tokenId);
            databaseManager.pushTrade(id, outcome, {
                timestamp: timestamp,
                price: price,
                size: size,
                side: side
            });
        } else {
            appLogger.warn("Invalid outcome value for pushTrade: {outcome} title: {title}", { outcome: outcome, title });
        }
        // Only buy if price > 0.90 and we haven't successfully processed this condition yet
        // Allow retry if previous attempt failed due to low bid price
        const shouldAttemptOrder = price > 0.90 && (!storage.hasId(id) || 
            (storage.hasId(id) && storage.get(id).status === "failed"));
        
        if (shouldAttemptOrder) {
            // Check if this is a retry attempt
            const isRetry = storage.hasId(id) && storage.get(id).status === "failed";
            if (isRetry) {
                appLogger.info("Retrying order for condition {id} title: {title} (previous attempt failed due to low bid price)", { id, title });
            }
            
            // Mark this condition as processed immediately to prevent duplicate orders
            storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "processing" });

            const book = await getBook(tokenId);

            if (!book.asks.length || !book.bids.length) {
                appLogger.warn(`Order not placed: empty asks or bids for tokenId ${tokenId} title: ${title}`);
                // Update status to failed since we couldn't place the order
                storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "failed" });
                break; // Exit instruction loop since we processed this message
            }
            // const ask = book.asks.reverse()[0]; // ask price
            const bid = book.bids.reverse()[0]; // bid price
            // Only place order if price <= ask
            //const askPrice = parseFloat(ask.price);
            const bidPrice = parseFloat(bid.price);
            if (bidPrice >= 0.88) {
                const record = {
                    eventId: id,
                    coin: extractCoinFromEvent(eventSlug) ?? "Unknown",
                    price: price,
                    event: eventSlug,
                    assetId: tokenId,
                    outcome: outcome,
                    url: `https://polymarket.com/event/${eventSlug}`,
                    winner: "Undefined",
                    buyed: true,
                };
                try {
                    const recordId = await createRecord("Table 1", record);
                    airtableLogger.info("Created initial record with counts: {recordId}", { recordId });
                } catch (error) {
                    airtableLogger.error("Failed to create initial record: {error}", {
                        error: error instanceof Error ? error.message : String(error)
                    });
                }

                try {
                    const order = await postOrder(tokenId, price, instruction.size);

                    // Update storage with the actual order details
                    if (order.success) {
                        storage.add(id, { orderID: order.orderID, asset: tokenId, outcome: outcome, status: order.status });
                        appLogger.info("Order successfully placed for condition {id} title: {title}", { id, title});
                    } else {
                        storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "failed" });
                        appLogger.warn("Order placement failed for condition {id} title: {title}", { id, title });
                    }
                } catch (error) {
                    storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "error" });
                    appLogger.error("Error placing order for condition {id}: {error} title: {title}", {
                        id,
                        title,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
                break; // Exit instruction loop since we successfully processed this message
            } else {
                // Bid price too low, mark as failed (will retry if bid price improves)
                storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "failed" });
                appLogger.info("Bid price {bidPrice} too low (< 0.88) for condition {id} title: {title}", { bidPrice, id, title });
                break; // Exit instruction loop since we processed this message
            }
        }
    }
}
const onStatusChange = (status: string) => {
    appLogger.info("WebSocket status changed: {status}", { status });
};

const onConnect = (client: RealTimeDataClient): void => {
    // Subscribe to a topic
    client.subscribe({
        subscriptions: [
            {
                topic: "activity",
                type: "trades",
            },
        ],
    });
};

// Start the WebSocket client
const main = async () => {
    await configureLogging();
    appLogger.info("Starting Polymarket Realtime Monitor...");
    new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();
};

main().catch(console.error);
import { instructions } from "./config";
import { shouldProcessMessage } from "./lib/processing";
import { createRecord } from "./lib/storage";
import { DatabaseManager } from "./lib/storage/database";
import storage from "./lib/storage/memory";
import { getBook, polymarket, postOrder } from "./lib/trading";
import { RealTimeDataClient } from "./lib/websocket";
import type { Message } from "./lib/websocket/model";
import { airtableLogger, appLogger, configureLogging } from "./utils/logger";
import { extractCoinFromEvent } from "./utils/time";

const databaseManager = new DatabaseManager();
const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    for (const instruction of instructions) {
        if (!shouldProcessMessage(message, instruction.slug)) {
            return;
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
                const order = await polymarket.getOrder(orderId);
                if (order.status === "MATCHED") {
                    storage.add(id, { orderID: orderId, asset: tokenId, outcome: outcome, status: order.status });
                }
            }
        }

        if (storage.hasId(id)) {
            if (storage.get(id).status == "MATCHED") {
                console.log(`Order matched: ${eventSlug}`);
            }

            if (storage.get(id).outcome == outcome) {
                console.log(`Order outcome similar: ${eventSlug}`);
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
            appLogger.warn("Invalid outcome value for pushTrade: {outcome}", { outcome: outcome });
        }
        if (price > 0.90 && !storage.hasId(id)) {
            const book = await getBook(tokenId);

            if (!book.asks.length || !book.bids.length) {
                appLogger.warn(`Order not placed: empty asks or bids for tokenId ${tokenId}`);
                return;
            }
            // const ask = book.asks.reverse()[0]; // ask price
            const bid = book.bids.reverse()[0]; // bid price
            // Only place order if price <= ask
            //const askPrice = parseFloat(ask.price);
            const bidPrice = parseFloat(bid.price);
            if (bidPrice >= 0.88) {
                // Mark this condition as processed immediately to prevent duplicate orders
                storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "processing" });

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
                    const order = await postOrder(tokenId, price, size);
                    console.log({ order });

                    // Update storage with the actual order details
                    if (order.success) {
                        storage.add(id, { orderID: order.orderID, asset: tokenId, outcome: outcome, status: order.status });
                        appLogger.info("Order successfully placed for condition {id}", { id });
                    } else {
                        storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "failed" });
                        appLogger.warn("Order placement failed for condition {id}", { id });
                    }
                } catch (error) {
                    storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "error" });
                    appLogger.error("Error placing order for condition {id}: {error}", {
                        id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
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
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
        const eventSlug = message.payload.eventSlug;
        const outcome = message.payload.outcome;
        const tokenId = message.payload.asset;
        const price = message.payload.price;

        if (storage.hasId(id)) {
            const order = await polymarket.getOrder(
                storage.get(id).orderID
            );
            console.log(order);
        }

        databaseManager.createMarket({
            id: message.payload.conditionId,
            title: message.payload.title,
            order: [],
            Up: { assetId: "", trades: [] },
            Down: { assetId: "", trades: [] }
        });
        if (message.payload.outcome === "Up" || message.payload.outcome === "Down") {
            databaseManager.setAssetId(message.payload.conditionId, message.payload.outcome, message.payload.asset);
            databaseManager.pushTrade(message.payload.conditionId, message.payload.outcome, {
                timestamp: message.payload.timestamp,
                price: message.payload.price,
                size: message.payload.size,
                side: message.payload.side
            });
        } else {
            appLogger.warn("Invalid outcome value for pushTrade: {outcome}", { outcome: message.payload.outcome });
        }
        if (message.payload.price > 0.9 && !storage.hasId(message.payload.conditionId)) {
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
                const order = await postOrder(message.payload.asset, message.payload.price, instruction.size);
                console.log({ order });
                if (order.success) {
                    storage.add(id, {orderID: order.orderID,asset:tokenId,outcome:outcome,status:order.success});
                }
                   storage.add(id, {orderID: order.orderID,asset:tokenId,outcome:outcome,status:false});
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
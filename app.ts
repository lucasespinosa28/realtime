import { RealTimeDataClient } from "./lib/websocket/client";
import type { Message } from "./lib/websocket/model";
import { setupMemoryMonitoring, setupGracefulShutdown } from "./utils/memory";
import { configureLogging, appLogger, airtableLogger } from "./utils/logger";
import { CacheManager } from "./lib/cache";
import { shouldProcessMessage } from "./lib/processing";
import { createRecord } from "./lib/storage";
import { getBook, placePolymarketOrder, getOrder } from "./lib/trading";
import { extractCoinFromEvent } from "./utils/time";
import { createMarket, updateAssetId, init, addTrade } from "./lib/storage/db";



// Setup logging first
await configureLogging();

// Initialize database (create tables if needed)
init();

// Setup memory monitoring and graceful shutdown
setupMemoryMonitoring(60000, 100); // Monitor every minute, GC at 100MB
setupGracefulShutdown();

// Create cache manager instance
const recordCache = new CacheManager(32);
const orderCache = new CacheManager(1000);

// Periodic cleanup without message throttling
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // Cleanup every minute

setInterval(() => {
    recordCache.performCleanup();
    orderCache.performCleanup();
}, CLEANUP_INTERVAL);

// Call getOrder for each cached order ID every 5 minutes
setInterval(async () => {
    const orderIds = orderCache.getAllIds();
    for (const orderId of orderIds) {
        try {
            const order = await getOrder(orderId);
            console.log({order})
            appLogger.info("Fetched order {orderId}: {order}", { orderId, order });
        } catch (error) {
            appLogger.error("Error fetching order {orderId}: {error}", {
                orderId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Map to store eventId -> recordId
const eventIdToRecordId: Map<string, string> = new Map();

const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    const now = Date.now();
    // Periodic cleanup every minute 
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        lastCleanup = now;
        recordCache.performCleanup();
    }

    if (!shouldProcessMessage(message)) {
        return;
    }

    try {
        const id = message.payload.conditionId;
        const eventSlug = message.payload.eventSlug;
        const outcome = message.payload.outcome;
        const tokenId = message.payload.asset;
        const price = message.payload.price;
        const size = message.payload.size;
        const side = message.payload.side;
        const timestamp = message.payload.timestamp;
        // console.log(message);
        const side_ = outcome.toLowerCase() === "up" ? "up" : "down";

        createMarket({ id: id, title: message.payload.title });
        updateAssetId(id, side_, tokenId)
        addTrade(id, side_, { price, size, timestamp, side });

        // Check if this is the first time we see this event at price > 0.9
        if (price > 0.9 && !recordCache.hasId(id)) {
            const book = await getBook(tokenId);

            if (!book.asks.length || !book.bids.length) {
                appLogger.warn(`Order not placed: empty asks or bids for tokenId ${tokenId}`);
                return;
            }

            const ask = book.asks.reverse()[0]; // ask price
            const bid = book.bids.reverse()[0]; // bid price
            // console.log("Best Ask:", ask,"Best Bid:",bid,"Price:",price);

            // Only place order if price <= ask
            const askPrice = parseFloat(ask.price);
            const bidPrice = parseFloat(bid.price);
            if (bidPrice >= 0.85) {
                // Double-check cache before placing order (race condition protection)
                if (!recordCache.checkAndAdd(id)) {
                    appLogger.info(`Order not placed: another process already handled ${id}`);
                    return;
                }
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
                    eventIdToRecordId.set(id, recordId);
                    airtableLogger.info("Created initial record with counts: {recordId}", { recordId });
                } catch (error) {
                    airtableLogger.error("Failed to create initial record: {error}", {
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
                await placePolymarketOrder(tokenId, price);
                appLogger.info(`Order placed: ${id}, ${eventSlug}, ${outcome}, ${price}`);
            } else {
                appLogger.info(`Order not placed: price (${price}) > ask (${askPrice}) or price < bid (${bidPrice}) or bidPrice < 85`);
            }
        }
    } catch (error) {
        appLogger.error("Error processing message: {error}", {
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

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
appLogger.info("Starting Polymarket Realtime Monitor...");
new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();

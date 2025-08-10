import { RealTimeDataClient } from "./lib/websocket/client";
import type { Message } from "./lib/websocket/model";
import { setupMemoryMonitoring, setupGracefulShutdown } from "./utils/memory";
import { configureLogging, appLogger, airtableLogger } from "./utils/logger";
import { CacheManager } from "./lib/cache";
import { shouldProcessMessage } from "./lib/processing";
import { createRecord } from "./lib/storage";
import { getLowest, updateLowest } from "./lib/storage/index";
import { getBook, placePolymarketOrder } from "./lib/trading";
import { extractCoinFromEvent } from "./utils/time";

// Setup logging first
await configureLogging();

// Setup memory monitoring and graceful shutdown
setupMemoryMonitoring(60000, 100); // Monitor every minute, GC at 100MB
setupGracefulShutdown();

// Create cache manager instance
const cacheManager = new CacheManager(32);

// Periodic cleanup without message throttling
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // Cleanup every minute

// Map to store eventId -> recordId
const eventIdToRecordId: Map<string, string> = new Map();

const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    const now = Date.now();
    // Periodic cleanup every minute 
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        lastCleanup = now;
        cacheManager.performCleanup();
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
        if (cacheManager.hasId(id)) {
            // Track and update lowest price for this id
            const recordId = eventIdToRecordId.get(id);
            if (recordId) {
                try {
                    const currentLowest = await getLowest("Table 2", recordId);
                    if (typeof currentLowest === "number" && price < currentLowest) {
                        await updateLowest("Table 2", recordId, price);
                        airtableLogger.info(`Updated lowest price for ${eventSlug}: ${price}`);
                    }
                } catch (error) {
                    airtableLogger.error("Failed to update lowest price: {error}", {
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        }
        // Check if this is the first time we see this event at price > 0.9
        if (price > 0.9 && !cacheManager.hasId(id)) {
            const book = await getBook(tokenId);

            if (!book.asks.length || !book.bids.length) {
                appLogger.warn(`Order not placed: empty asks or bids for tokenId ${tokenId}`);
                return;
            }

            const ask = book.asks.reverse()[0]; // ask price
            const bid = book.bids.reverse()[0]; // bid price
            console.log("Best Ask:", ask,"Best Bid:",bid,"Price:",price);

            // Only place order if price <= ask
            const askPrice = parseFloat(ask.price);
            const bidPrice = parseFloat(bid.price);
            if (bidPrice >= 0.85) {
                // Double-check cache before placing order (race condition protection)
                if (!cacheManager.checkAndAdd(id)) {
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
                    asksSize: parseInt(ask.size),
                    bidsSize: parseInt(bid.size),
                    lowest: price
                };
                console.log({price})
                console.log({asksSize: parseInt(ask.size)})
                console.log({bidsSize: parseInt(bid.size)})
                console.log({asksSize: ask.size})
                console.log({bidsSize: bid.size})
                console.log({record})
                try {
                    const recordId = await createRecord("Table 2", record);
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

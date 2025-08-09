import { RealTimeDataClient } from "./lib/websocket/client";
import type { Message } from "./lib/websocket/model";
import { setupMemoryMonitoring, setupGracefulShutdown } from "./utils/memory";
import { configureLogging, appLogger } from "./utils/logger";
import { CacheManager } from "./lib/cache";
import { shouldProcessMessage } from "./lib/processing";
import { saveToAirtable } from "./lib/storage";
import { placePolymarketOrder } from "./lib/trading";

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
        // Check if this is the first time we see this event at price > 0.9
        if (price > 0.9 && !cacheManager.hasId(id)) {
            cacheManager.addId(id);
            await saveToAirtable(id, eventSlug, outcome, price);
            await placePolymarketOrder(tokenId, price);
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

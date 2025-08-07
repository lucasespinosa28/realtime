import { RealTimeDataClient } from "./lib/websocket/client";
import type { Message } from "./lib/websocket/model";
import { createRecord, saveOutcomeCount } from "./lib/airtable";
import { isTimeMatch, extractCoinFromEvent } from "./utils/time";
import { setupMemoryMonitoring, setupGracefulShutdown } from "./utils/memory";
import { configureLogging, appLogger } from "./utils/logger";

// Setup logging first
await configureLogging();

// Setup memory monitoring and graceful shutdown
setupMemoryMonitoring(60000, 100); // Monitor every minute, GC at 100MB
setupGracefulShutdown();

// Use Set for O(1) lookups and automatic deduplication
const recentIds = new Set<string>(); // For tracking which events we've created initial records for
const MAX_CACHE_SIZE = 32; // Reduced for lower memory usage

// Periodic cleanup without message throttling
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // Cleanup every minute

const onMessage = async (_client: any, message: Message): Promise<void> => {
    const now = Date.now();

    // Periodic cleanup every minute
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        lastCleanup = now;

        // Clean up cache if it gets too large
        if (recentIds.size > MAX_CACHE_SIZE) {
            recentIds.clear();
        }

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }

    // Early return if not relevant message type
    if (!message?.payload?.slug?.includes("up-or-down")) {
        return;
    }
    // console.log("Received message from", message);
    try {
        // Check if time matches current ET time
        if (!isTimeMatch(message.payload.title)) {
            return;
        }
        // appLogger.info("Processing message for event: {event} with price  {outcome}:{price}", {
        //     event: message.payload.eventSlug,
        //     price: message.payload.price,
        //     outcome: message.payload.outcome
        // });
        
        const id = message.payload.conditionId;
        const eventSlug = message.payload.eventSlug;
        const outcome = message.payload.outcome;
        
        // Check if this is the first time we see this event at price > 0.9
        if (message.payload.price > 0.9 && !recentIds.has(id)) {
            // Maintain max cache size for recentIds
            if (recentIds.size >= MAX_CACHE_SIZE) {
                // Clear half the cache to prevent constant clearing
                const idsArray = Array.from(recentIds);
                recentIds.clear();
                // Keep the second half
                for (let i = Math.floor(idsArray.length / 2); i < idsArray.length; i++) {
                    recentIds.add(idsArray[i]);
                }
            }
            recentIds.add(id);

            // Prepare data for Airtable (initial record with Up/Down counts)
            const record = {
                eventId: id,
                coin: extractCoinFromEvent(eventSlug) ?? "Unknown",
                price: message.payload.price,
                event: eventSlug,
                outcome: outcome,
                url: `https://polymarket.com/event/${eventSlug}`,
                winner: "Undefined"
            };

            // Save to Airtable Table 2 (this will set initial Up=1 or Down=1)
            try {
                const recordId = await createRecord("Table 2", record);
                appLogger.info("Created initial record with counts: {recordId}", { recordId });
            } catch (error) {
                appLogger.error("Failed to create initial record: {error}", {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        } else if (recentIds.has(id) && message.payload.price > 0.9) {
            // If we already have a record for this event, just update the counts
            if (outcome === 'Up' || outcome === 'Down') {
                try {
                    const outcomeRecordId = await saveOutcomeCount("Table 2", id, outcome);
                    appLogger.info("Updated outcome count: {outcome} for event: {event}", { 
                        outcome,
                        event: eventSlug,
                        recordId: outcomeRecordId 
                    });
                } catch (error) {
                    appLogger.error("Failed to update outcome count: {error}", {
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        }
    } catch (error) {
        appLogger.error("Error processing message: {error}", {
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

const onStatusChange = (status: any) => {
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

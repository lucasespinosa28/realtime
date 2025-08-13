import { RealTimeDataClient } from "./lib/websocket/client";
import type { Message } from "./lib/websocket/model";
import { appLogger } from "./utils/logger";


const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    console.log("Received message:", message);
    //    if (!shouldProcessMessage(message)) {
    //         return;
    //     }
    //     const id = message.payload.conditionId;
    //     const eventSlug = message.payload.eventSlug;
    //     const outcome = message.payload.outcome;
    //     const tokenId = message.payload.asset;
    //     const price = message.payload.price;
    //     const size = message.payload.size;
    //     const side = message.payload.side;
    //     const timestamp = message.payload.timestamp;
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

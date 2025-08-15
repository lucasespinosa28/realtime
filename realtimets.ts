import { instructions } from "./config";
import { shouldProcessMessage } from "./lib/processing";
import { RealTimeDataClient } from "./lib/websocket";
import type { Message } from "./lib/websocket/model";
import { appLogger, configureLogging } from "./utils/logger";


/**
 * WebSocket event handlers
 */
const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    for (const instruction of instructions) {
        if (shouldProcessMessage(message, instruction.slug)) {
            console.log({ message })
        }
    }

};

const onStatusChange = (status: string) => {
    appLogger.info("WebSocket status changed: {status}", { status });
};

const onConnect = (client: RealTimeDataClient): void => {
    client.subscribe({
        subscriptions: [
            {
                topic: "activity",
                type: "trades",
            },
        ],
    });
    appLogger.info("Connected to Polymarket WebSocket and subscribed to trades");
};

/**
 * Application entry point
 */
async function main(): Promise<void> {
    await configureLogging();
    appLogger.info("Starting Polymarket Realtime Trading Bot...");
    new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();
}

main().catch(console.error);
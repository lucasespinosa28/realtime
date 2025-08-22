import { appLogger, configureLogging } from "./utils/logger";
import { RealTimeDataClient } from "./lib/websocket";
import { setupHourlyReload } from "./lib/websocket/setupHourlyReload";
import { loadMarketData } from "./lib/processing/marketData";
import { onMessage, onConnect, onStatusChange } from "./lib/websocket/handlers";
import { setClient } from "./lib/processing/state";
import { instructions } from "./config";
import { DatabaseMemoryManager } from "./lib/storage";


export const memoryDatabase = new DatabaseMemoryManager()
/**
 * Application entry point
 */
async function main(): Promise<void> {
    await configureLogging();
    for (const instruction of instructions) {
        appLogger.info("Inserting instruction: {title}", {
            title: instruction.title,
        });
    }
    const insertResult = memoryDatabase.insertInstruction(instructions);
    if (insertResult.success) {
        appLogger.info("Instructions inserted successfully");
    } else {
        appLogger.error("Failed to insert instructions");
    }
    appLogger.info("Starting Polymarket Realtime Trading Bot...");

    // Load initial market data
    loadMarketData();

    // Connect WebSocket
    const client = new RealTimeDataClient({ onMessage, onConnect, onStatusChange });
    setClient(client);
    client.connect();

    // Setup hourly reload
    setupHourlyReload();
}

main().catch(console.error);


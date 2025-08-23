import { appLogger, configureLogging } from "./utils/logger";
import { RealTimeDataClient } from "./lib/websocket";
import { setupHourlyReload } from "./lib/websocket/setupHourlyReload";
import { loadMarketData } from "./lib/processing/marketData";
import { onMessage, onConnect, onStatusChange } from "./lib/websocket/handlers";
import { setClient, reloadStateFromDatabase } from "./lib/processing/state";
import { instructions } from "./config";
import { memoryDatabase } from "./lib/storage/database";


/**
 * Application entry point
 */
async function main(): Promise<void> {
    await configureLogging();
    const insertResult = memoryDatabase.insertInstruction(instructions);
    if (insertResult.success) {
        appLogger.info("Instructions inserted successfully");
    } else {
        appLogger.error("Failed to insert instructions");
    }
    appLogger.info("Starting Polymarket Realtime Trading Bot...");

    // Reload processed state from database to prevent duplicate orders
    reloadStateFromDatabase();

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


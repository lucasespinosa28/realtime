import { RealTimeDataClient } from "./lib/websocket";
import { client, processedConditionIds, inFlightConditionIds, boughtAssets, loadMarketData } from "./main";
import { appLogger } from "./utils/logger";

/**
 * Reconnect WebSocket with fresh data
 */

export async function reconnectWithFreshData(): Promise<void> {
    appLogger.info("Reconnecting with fresh market data...");

    // Disconnect current client if exists
    if (client) {
        client.disconnect();
        client = null;
    }

    // Clear processed sets to allow new processing
    processedConditionIds.clear();
    inFlightConditionIds.clear();
    boughtAssets.clear();

    // Reload market data
    loadMarketData();

    // Create new client and connect
    client = new RealTimeDataClient({ onMessage, onConnect, onStatusChange });
    client.connect();

    appLogger.info("Reconnected with fresh data");
}

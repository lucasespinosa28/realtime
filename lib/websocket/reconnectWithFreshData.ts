/**
 * Reconnect WebSocket with fresh data
 */

import { appLogger } from "../../utils/logger";
import { loadMarketData } from "../processing/marketData";
import { boughtAssets, client, inFlightConditionIds, processedConditionIds, setClient } from "../processing/state";
import { RealTimeDataClient } from "./client";
import { onConnect, onMessage, onStatusChange } from "./handlers";

export async function reconnectWithFreshData(): Promise<void> {
    appLogger.info("Reconnecting with fresh market data...");

    if (client) {
        client.disconnect();
        setClient(null);
    }
    // Clear processed sets to allow new processing
    processedConditionIds.clear();
    inFlightConditionIds.clear();
    boughtAssets.clear();

    // Reload market data
    loadMarketData();

    setClient(new RealTimeDataClient({ onMessage, onConnect, onStatusChange }));
    client!.connect();

    appLogger.info("Reconnected with fresh data");
}

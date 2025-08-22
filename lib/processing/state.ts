import type { RealTimeDataClient } from "../websocket";
import { memoryDatabase } from "../database";
import { appLogger } from "../../utils/logger";

export const boughtAssets = new Set<string>();
export const processedConditionIds = new Set<string>();
export const inFlightConditionIds = new Set<string>();

export let client: RealTimeDataClient | null = null;
export function setClient(newClient: RealTimeDataClient | null) {
    client = newClient;
}

/**
 * Reload processed state from database to prevent duplicate orders after restart
 */
export function reloadStateFromDatabase() {
    try {
        // Get all existing trade orders from database
        const allOrders = memoryDatabase.getAllTradeOrders();
        
        for (const order of allOrders) {
            const { conditionId, asset } = order.tradeData;
            
            // Mark condition as processed
            processedConditionIds.add(conditionId);
            
            // Mark asset as bought if order was successful
            if (order.status === 'live' || order.status === 'completed') {
                boughtAssets.add(asset);
            }
        }
        
        appLogger.info(`State reloaded: ${processedConditionIds.size} processed conditions, ${boughtAssets.size} bought assets`);
    } catch (error) {
        appLogger.error("Failed to reload state from database", { error });
    }
}

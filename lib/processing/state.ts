import type { RealTimeDataClient } from "../websocket";

export const boughtAssets = new Set<string>();
export const processedConditionIds = new Set<string>();
export const inFlightConditionIds = new Set<string>();

export let client: RealTimeDataClient | null = null;
export function setClient(newClient: RealTimeDataClient | null) {
    client = newClient;
}

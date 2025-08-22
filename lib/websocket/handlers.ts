import { handleMessage } from "../processing/handleMessage";
import { appLogger } from "../../utils/logger";
import { tokensId } from "../processing/marketData";
import { setClient } from "../processing/state";
import type { RealTimeDataClient, Message } from ".";

export const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
   await handleMessage(_client, message);
};

export const onStatusChange = (status: string) => {
    appLogger.info("WebSocket status changed: {status}", { status });
};

export const onConnect = (wsClient: RealTimeDataClient): void => {
    setClient(wsClient);
    wsClient.subscribe({
        subscriptions: [
            {
                topic: "clob_market",
                type: "agg_orderbook",
                filters: `[${tokensId()}]'`
            },
        ],
    });
    appLogger.info("Connected to Polymarket WebSocket and subscribed to trades");
};

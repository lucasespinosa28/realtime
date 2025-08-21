import type { Market, MarketToken } from "./lib/trading/model";
import { RealTimeDataClient, type Message } from "./lib/websocket";
import { crypto1hMarkets } from "./scripts/filterMarkerts";
import { appLogger, configureLogging } from "./utils/logger";

interface Token extends MarketToken {
    conditionId: string;
    question: string;
    // Add any additional properties or methods specific to Token here
}
const markets: Market[] = crypto1hMarkets()
const tokens: Token[] = markets.flatMap(market => market.tokens.map(token => ({
    ...token,
    conditionId: market.condition_id,
    question: market.question
})));

function tokensId(): string {
    return tokens.map(token => `"${token.token_id}"`).join(",");
}
console.log(tokensId());
/**
 * WebSocket event handlers
 */
const onMessage = async (_client: RealTimeDataClient, message: OrderBook): Promise<void> => {
    console.log({message})
};

const onStatusChange = (status: string) => {
    appLogger.info("WebSocket status changed: {status}", { status });
};

const onConnect = (client: RealTimeDataClient): void => {
    client.subscribe({
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

/**
 * Application entry point
 */
async function main(): Promise<void> {
    await configureLogging();
    appLogger.info("Starting Polymarket Realtime Trading Bot...");
    new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();
}

main().catch(console.error);
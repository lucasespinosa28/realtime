import type { Market, MarketToken } from "./lib/trading/model";
import { RealTimeDataClient, type Message } from "./lib/websocket";
import type { Book, OrderBook } from "./lib/websocket/model";
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

const lastBuy = new Map();
const lastBuyAsk = async (asks: Book[], id: string) => {

    const currentMinutes = new Date().getMinutes();
    const withinBuyWindow = 59 < currentMinutes;
    if (withinBuyWindow) {
        if (!Array.isArray(asks) || asks.length === 0) return;
        const lastAsk = asks.reverse()[0]
        if (!lastBuy.get(id)) {
            if (Number(lastAsk.price) === 0.99 || Number(lastAsk.price) === 0.98) {
                console.log("Last Buy Ask:", lastAsk);
                lastBuy.set(id, true);
            }
        }
    }
}

/**
 * WebSocket event handlers
 */
const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    const orderBook = message as unknown as OrderBook;
    lastBuy.set(orderBook.payload.asset_id, false);

    const asks = orderBook.payload.asks;
    // const bids = orderBook.payload.bids;
    await lastBuyAsk(asks, orderBook.payload.asset_id)
};

//  message: {
//     connection_id: "Pr7gVcFGLPECHyQ=",
//     payload: {
//       asks: [
//         [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...]
//       ],
//       asset_id: "80642695692379398563540864768487972465823059514911616898393787195142444056088",
//       bids: [
//         [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...], [Object ...]
//       ],
//       hash: "00552aaac653e28c7647d47a55edfa8610ae2bc3",
//       market: "0x39bd4c323167fe67ff077f6424d176bc6eab1706182a792b5514669e2c68c6c0",
//       min_order_size: "5",
//       neg_risk: false,
//       tick_size: "0.01",
//       timestamp: "1755830596803",
//     },
//     timestamp: 1755830596819,
//     topic: "clob_market",
//     type: "agg_orderbook",
//   },
// }

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
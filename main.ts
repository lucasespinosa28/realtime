import { checkOrderStatus } from "./checkOrderStatus";
import { storageOrder } from "./lib/storage/memory";
import { postOrder } from "./lib/trading";
import type { Market, MarketToken } from "./lib/trading/model";
import { RealTimeDataClient, type Message } from "./lib/websocket";
import type { Book, OrderBook } from "./lib/websocket/model";
import { placeBuyOrder } from "./placeBuyOrder";
import { crypto1hMarkets } from "./scripts/filterMarkerts";
import { appLogger, configureLogging } from "./utils/logger";


export interface TradeData {
    conditionId: string;
    asset: string;
    title: string;
    price: number;
    timestamp: number;
}

interface Token extends MarketToken {
    title: string;
    // Add any additional properties or methods specific to Token here
}
// Constants for trading rules
const TRADING_RULES = {
    START_TIME: 0,
    BUY_PRICE_THRESHOLD: 0.90,
} as const;

// In-memory set of assets we've already bought (authoritative copy in DB)
export const boughtAssets = new Set<string>();
// Track which conditionIds we've already placed orders for
export const processedConditionIds = new Set<string>();
// New: guard concurrent processing per conditionId
export const inFlightConditionIds = new Set<string>();

// Make these variables mutable for reloading
let markets: Market[] = [];
let tokens: Token[] = [];
let titles = new Map<string, string>();
let client: RealTimeDataClient | null = null;

function loadMarketData(): void {
    appLogger.info("Loading market data...");

    markets = crypto1hMarkets();
    tokens = markets.flatMap(market => market.tokens.map(token => ({
        ...token,
        title: market.question.toLowerCase()
    })));

    titles = new Map<string, string>();
    for (const token of tokens) {
        titles.set(token.token_id, token.title);
    }

    appLogger.info("Market data loaded: {marketCount} markets, {tokenCount} tokens", {
        marketCount: markets.length,
        tokenCount: tokens.length
    });
}

function tokensId(): string {
    return tokens.map(token => `"${token.token_id}"`).join(",");
}

const lastBuy = new Map();
const lastBuyAsk = async (asks: Book[], tradeData: TradeData) => {
    if (!Array.isArray(asks) || asks.length === 0) {
        appLogger.debug("No asks available for asset {asset}", { asset: tradeData.asset });
        return;
    }
    
    const lastAsk = asks.reverse()[0]
    appLogger.debug("Last ask for asset {asset}: price={price}", {
        asset: tradeData.asset,
        price: lastAsk.price
    });
    
    if (!lastBuy.get(tradeData.asset)) {
        if (Number(lastAsk.price) === 0.99) {
            appLogger.info("Found 0.99 ask price for {title} - placing immediate buy order", { title: tradeData.title });
            console.log("Last Buy Ask:", lastAsk);
            lastBuy.set(tradeData.asset, true);
            const order = await postOrder(
                tradeData.asset,
                0.99,
                5,
            );
            if (order.success) {
                // Track in memory to avoid future DB checks
                boughtAssets.add(tradeData.asset);
                // Mark this conditionId as processed
                processedConditionIds.add(tradeData.conditionId);
                // Update storageOrder with order details
                storageOrder.add(tradeData.asset, {
                    orderID: order.orderID,
                    asset: tradeData.asset,
                    status: order.status,
                    conditionId: tradeData.conditionId
                });
                appLogger.info("Immediate buy order placed for {title} at price {price}, conditionId {conditionId}, orderID {orderID}", {
                    title: tradeData.title,
                    price: 0.99,
                    conditionId: tradeData.conditionId,
                    orderID: order.orderID
                });
            } else {
                // Mark as failed
                storageOrder.add(tradeData.asset, {
                    orderID: "",
                    asset: tradeData.asset,
                    status: "failed",
                    conditionId: tradeData.conditionId
                });
                appLogger.warn("Immediate buy order failed for {title} asset {asset}", { title: tradeData.title, asset: tradeData.asset });
            }
        } else {
            appLogger.debug("Ask price {price} not equal to 0.99 for {title} - skipping immediate buy", {
                price: Number(lastAsk.price),
                title: tradeData.title
            });
        }
    } else {
        appLogger.debug("Already processed immediate buy for asset {asset}", { asset: tradeData.asset });
    }
}

const lastBuyBid = (bids: Book[]) => {
    if (!Array.isArray(bids) || bids.length === 0) return null;
    return bids.reverse()[0]
}

/**
 * WebSocket event handlers
 */
const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    const orderBook = message as unknown as OrderBook;
    const currentMinutes = new Date().getMinutes();

    lastBuy.set(orderBook.payload.asset_id, false);
    const asks = orderBook.payload.asks;
    const bids = orderBook.payload.bids;

    appLogger.debug("Received orderbook for asset {assetId}: {askCount} asks, {bidCount} bids", {
        assetId: orderBook.payload.asset_id,
        askCount: asks?.length || 0,
        bidCount: bids?.length || 0
    });

    const title = titles.get(orderBook.payload.asset_id);
    if (!title) {
        appLogger.warn("Title not found for asset_id: {assetId} - skipping message", { assetId: orderBook.payload.asset_id });
        throw new Error(`Title not found for asset_id: ${orderBook.payload.asset_id}`);
    }
    const bidBook = lastBuyBid(bids);
    if (!bidBook) {
        appLogger.debug("No bids available for asset {assetId} - skipping processing", { assetId: orderBook.payload.asset_id });
        // No bids available, skip processing this message
        return;
    }

    const tradeData: TradeData = {
        conditionId: orderBook.payload.market,
        asset: orderBook.payload.asset_id,
        title,
        price: Number(bidBook.price),
        timestamp: orderBook.timestamp,
    };

    appLogger.debug("Processing trade data for {title}: price={price}, conditionId={conditionId}, withinBuyWindow={withinBuyWindow}", {
        title: tradeData.title,
        price: tradeData.price,
        conditionId: tradeData.conditionId,
        withinBuyWindow: TRADING_RULES.START_TIME < currentMinutes
    });

    await lastBuyAsk(asks, tradeData)
    // 1. Always check if we have an existing order and update its status
    if (storageOrder.hasId(tradeData.asset)) {
        appLogger.debug("Found existing order for asset {asset} - checking status", { asset: tradeData.asset });
        await checkOrderStatus(tradeData);
    } else {
        appLogger.debug("No existing order found for asset {asset}", { asset: tradeData.asset });
    }
    
    const withinBuyWindow = TRADING_RULES.START_TIME < currentMinutes;
    if ((withinBuyWindow && tradeData.price >= TRADING_RULES.BUY_PRICE_THRESHOLD)) {
        // Skip if already processed, claimed, or asset already bought
        if (
            processedConditionIds.has(tradeData.conditionId) ||
            inFlightConditionIds.has(tradeData.conditionId) ||
            boughtAssets.has(tradeData.asset)
        ) {
            appLogger.debug("Skipping buy order for {title}: alreadyProcessed={processed}, inFlight={inFlight}, alreadyBought={bought}", {
                title: tradeData.title,
                processed: processedConditionIds.has(tradeData.conditionId),
                inFlight: inFlightConditionIds.has(tradeData.conditionId),
                bought: boughtAssets.has(tradeData.asset)
            });
            return;
        }

        appLogger.info("Initiating buy order for {title}: price={price} >= threshold={threshold}", {
            title: tradeData.title,
            price: tradeData.price,
            threshold: TRADING_RULES.BUY_PRICE_THRESHOLD
        });

        // Claim this conditionId to prevent duplicate processing
        inFlightConditionIds.add(tradeData.conditionId);
        appLogger.debug("Marked conditionId {conditionId} as in-flight", { conditionId: tradeData.conditionId });

        // Mark processing for visibility
        storageOrder.add(tradeData.asset, {
            orderID: "",
            asset: tradeData.asset,
            status: "processing",
            conditionId: tradeData.conditionId
        });

        try {
            // Asset is already marked as "processing" from the caller
            await placeBuyOrder(tradeData);
        } finally {
            // Always release the claim so future retries are possible if not processed
            inFlightConditionIds.delete(tradeData.conditionId);
            appLogger.debug("Released in-flight lock for conditionId {conditionId}", { conditionId: tradeData.conditionId });
        }
    } else {
        appLogger.debug("Not placing buy order for {title}: withinBuyWindow={withinBuyWindow}, price={price}, threshold={threshold}", {
            title: tradeData.title,
            withinBuyWindow,
            price: tradeData.price,
            threshold: TRADING_RULES.BUY_PRICE_THRESHOLD
        });
    }
}


const onStatusChange = (status: string) => {
    appLogger.info("WebSocket status changed: {status}", { status });
};

const onConnect = (wsClient: RealTimeDataClient): void => {
    client = wsClient; // Store reference for reconnection
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
 * Reconnect WebSocket with fresh data
 */
async function reconnectWithFreshData(): Promise<void> {
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

/**
 * Setup hourly reload at minute 00
 */
function setupHourlyReload(): void {
    const now = new Date();
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    const msUntilNextHour = nextHour.getTime() - now.getTime();

    appLogger.info("Next reload scheduled at: {time}", { time: nextHour.toISOString() });

    // Schedule first reload
    setTimeout(async () => {
        await reconnectWithFreshData();

        // Then schedule every hour
        setInterval(async () => {
            await reconnectWithFreshData();
        }, 60 * 60 * 1000); // 1 hour in milliseconds

    }, msUntilNextHour);
}

/**
 * Application entry point
 */
async function main(): Promise<void> {
    await configureLogging();
    appLogger.info("Starting Polymarket Realtime Trading Bot...");

    // Load initial market data
    loadMarketData();

    // Connect WebSocket
    client = new RealTimeDataClient({ onMessage, onConnect, onStatusChange });
    client.connect();

    // Setup hourly reload
    setupHourlyReload();
}

main().catch(console.error);
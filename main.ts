import { instructions } from "./config";
import { shouldProcessMessage } from "./lib/processing";
import { DatabaseManager } from "./lib/storage/database";
import { storage } from "./lib/storage/memory";
import { getBook, polymarket, postOrder, priceHandler, sellOrder } from "./lib/trading";
import { RealTimeDataClient } from "./lib/websocket";
import type { Message } from "./lib/websocket/model";
import { appLogger, configureLogging } from "./utils/logger";

const database = new DatabaseManager("trades.sqlite");
// In-memory set of assets we've already bought (authoritative copy in DB)
const boughtAssets = new Set<string>();

// Synchronous lock to prevent race conditions across multiple async message handlers
// CRITICAL: This prevents multiple WebSocket messages from passing the buy condition
// check simultaneously and placing duplicate orders for the same asset
const processingAssets = new Set<string>();

// Single, simple guard: claim a slot to buy a specific asset
function claimBuySlot(asset: string): boolean {
    if (boughtAssets.has(asset)) return false; // already bought before
    if (processingAssets.has(asset)) return false; // another handler is buying now
    processingAssets.add(asset);
    return true;
}

function releaseBuySlot(asset: string) {
    processingAssets.delete(asset);
}

// Constants for trading rules
const TRADING_RULES = {
    BUY_PRICE_THRESHOLD: 0.90,
    MIN_BID_PRICE: 0.88,
    SELL_PRICE_THRESHOLD: 0.51,
    STOP_LOSS_MINUTES: 55
} as const;

// Types for better clarity
interface TradeData {
    conditionId: string;
    asset: string;
    title: string;
    outcome: string;
    price: number;
    timestamp: number;
    side: string;
    size: number;
}

/**
 * Checks if a placed buy order has been matched
 */
async function checkOrderStatus(conditionId: string, asset: string, outcome: string, timestamp: number): Promise<void> {
    if (!storage.hasId(asset)) return; // nothing to check
    const storedOrder = storage.get(asset);
    // Skip if already matched or outcome doesn't match
    if (storedOrder.status === "MATCHED" || storedOrder.outcome !== outcome) {
        return;
    }
    const orderId = storedOrder.orderID;
    if (!orderId) {
        return;
    }
    try {
        const order = await polymarket.getOrder(orderId);
        if (order.status === "MATCHED") {
            appLogger.info("Buy order matched for condition {conditionId} outcome {outcome}", {
                conditionId,
                outcome
            });
            // Record matched buy order in database
            database.setBuy({
                asset: asset,
                conditionId: conditionId,
                price: Number(order.price),
                size: Number(order.size_matched),
                side: "BUY",
                timestamp: timestamp
            });
            // Update storage with matched status
            storage.add(asset, { 
                orderID: orderId, 
                asset: asset, 
                outcome: outcome, 
                status: "MATCHED",
                conditionId: conditionId
            });
        }
    } catch (error) {
        appLogger.error("Error checking order status for {conditionId}: {error}", {
            conditionId,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

/**
 * Places a buy order for a given asset
 */
async function placeBuyOrder(tradeData: TradeData): Promise<boolean> {
    try {
    // Double-check idempotency: if memory already contains a buy for this asset, skip
    if (boughtAssets.has(tradeData.asset)) {
            appLogger.info("Buy already recorded in DB for asset {asset} — skipping post", { asset: tradeData.asset });
            return true;
        }
        const order = await postOrder(
            tradeData.asset, 
            priceHandler(tradeData.price), 
            tradeData.size, 
            tradeData.title, 
            tradeData.outcome
        );
        if (order.success) {
            // Record posted order in database
            database.setBuy({
                asset: tradeData.asset,
                conditionId: tradeData.conditionId,
                price: priceHandler(tradeData.price),
                size: tradeData.size,
                side: "BUY",
                timestamp: tradeData.timestamp
            });
            // Track in memory to avoid future DB checks
            boughtAssets.add(tradeData.asset);
            // Update storage with order details
            storage.add(tradeData.asset, { 
                orderID: order.orderID, 
                asset: tradeData.asset, 
                outcome: tradeData.outcome, 
                status: order.status,
                conditionId: tradeData.conditionId
            });
            appLogger.info("Buy order placed for {title} at price {price} asset {asset}", {
                title: tradeData.title,
                price: priceHandler(tradeData.price),
                asset: tradeData.asset
            });
            return true;
        } else {
            // Mark as failed
            storage.add(tradeData.asset, { 
                orderID: "", 
                asset: tradeData.asset, 
                outcome: tradeData.outcome, 
                status: "failed",
                conditionId: tradeData.conditionId
            });
            appLogger.warn("Buy order failed for {title} asset {asset}", { title: tradeData.title, asset: tradeData.asset });
            return false;
        }
    } catch (error) {
        appLogger.error("Error placing buy order for {title}: {error}", {
            title: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
        // Clean up processing status on error to allow retry
        storage.delete(tradeData.asset);
        return false;
    }
}

/**
 * Executes buy logic when conditions are met
 */
async function executeBuyLogic(tradeData: TradeData): Promise<void> {
    try {
        // Check order book for sufficient liquidity
        const book = await getBook(tradeData.asset);
        if (!book.asks.length || !book.bids.length) {
            appLogger.warn("No liquidity available for {title}", { title: tradeData.title });
            // Remove processing status since we can't proceed
            storage.delete(tradeData.asset);
            return;
        }
        // Check if bid price meets minimum requirement
        const highestBidPrice = parseFloat(book.bids[book.bids.length - 1].price);
        if (highestBidPrice < TRADING_RULES.MIN_BID_PRICE) {
            appLogger.info("Bid price {bidPrice} too low (< {minBid}) for {title}", {
                bidPrice: highestBidPrice,
                minBid: TRADING_RULES.MIN_BID_PRICE,
                title: tradeData.title
            });
            // Remove processing status since we can't proceed
            storage.delete(tradeData.asset);
            return;
        }
        // Asset is already marked as "processing" from the caller
        await placeBuyOrder(tradeData);
    } catch (error) {
        appLogger.error("Error in buy logic for {title}: {error}", {
            title: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
        // Remove processing status on error
        storage.delete(tradeData.asset);
    }
}

// Hedge strategy removed for simplicity and to avoid duplicate/complex buy paths

/**
 * Executes sell logic when stop-loss conditions are met
 */
async function executeSellLogic(tradeData: TradeData, currentMinutes: number): Promise<void> {
    // Check stop-loss conditions: price < 0.51 and after minute 55
    if (tradeData.price >= TRADING_RULES.SELL_PRICE_THRESHOLD || currentMinutes <= TRADING_RULES.STOP_LOSS_MINUTES) {
        return;
    }
    const sellKey = `sell_${tradeData.asset}`;
    try {
        // Mark sell as processing to prevent race conditions
        storage.add(sellKey, { 
            orderID: "", 
            asset: tradeData.asset, 
            outcome: tradeData.outcome, 
            status: "processing",
            conditionId: tradeData.conditionId
        });
        const sellResult = await sellOrder(tradeData.asset, tradeData.size, tradeData.title, tradeData.outcome);
        if (sellResult.success) {
            // Record sell order in database
            database.setSell({
                asset: tradeData.asset,
                conditionId: tradeData.conditionId,
                price: tradeData.price,
                size: tradeData.size,
                side: "SELL",
                timestamp: tradeData.timestamp
            });
            // Update storage with sell status
            storage.add(sellKey, { 
                orderID: sellResult.orderID, 
                asset: tradeData.asset, 
                outcome: tradeData.outcome, 
                status: "SOLD",
                conditionId: tradeData.conditionId
            });
            appLogger.info("STOP LOSS: Sell order placed for {title} at price {price} (minute: {minutes})", {
                title: tradeData.title,
                price: tradeData.price,
                minutes: currentMinutes
            });
        } else {
            // Remove processing status to allow retry
            storage.delete(sellKey);
            appLogger.warn("Sell order failed for {title}", { title: tradeData.title });
        }
    } catch (error) {
        // Remove processing status to allow retry
        storage.delete(sellKey);
        appLogger.error("Error in sell logic for {title}: {error}", {
            title: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

/**
 * Main message handler for trade events
 */
async function handleTradeMessage(message: Message): Promise<void> {
    const currentMinutes = new Date().getMinutes();
    
    for (const instruction of instructions) {
        if (!shouldProcessMessage(message, instruction.slug)) {
            continue;
        }

        const tradeData: TradeData = {
            conditionId: message.payload.conditionId,
            asset: message.payload.asset,
            title: message.payload.title,
            outcome: message.payload.outcome,
            price: message.payload.price,
            timestamp: message.payload.timestamp,
            side: message.payload.side,
            size: instruction.size
        };

        // Record all trades in database
        database.setTrade({
            asset: tradeData.asset,
            conditionId: tradeData.conditionId,
            outcome: tradeData.outcome,
            price: tradeData.price,
            size: message.payload.size,
            side: tradeData.side,
            timestamp: tradeData.timestamp
        });

    // 1. Check if we have an existing order and update its status
    if (storage.hasId(tradeData.asset)) {
            const storedOrder = storage.get(tradeData.asset);
            await checkOrderStatus(tradeData.conditionId, storedOrder.asset, tradeData.outcome, tradeData.timestamp);
        }

        // 2. Check sell conditions (stop-loss) for matched buy orders
        const sellKey = `sell_${tradeData.asset}`;
        if (storage.hasId(tradeData.asset) && 
            storage.get(tradeData.asset).status === "MATCHED" && 
            !storage.hasId(sellKey)) {
            
            await executeSellLogic(tradeData, currentMinutes);
        }

        // 3. Check buy conditions for new opportunities (simplified — no hedge logic)
        if (tradeData.price >= TRADING_RULES.BUY_PRICE_THRESHOLD) {
            // Claim the buy slot; if false, another message already handled or we're done
            if (!claimBuySlot(tradeData.asset)) {
                continue;
            }
            try {
                // Mark as processing in storage so concurrent parts of app see this
                storage.add(tradeData.asset, { 
                    orderID: "", 
                    asset: tradeData.asset, 
                    outcome: tradeData.outcome, 
                    status: "processing",
                    conditionId: tradeData.conditionId
                });
                await executeBuyLogic(tradeData);
            } finally {
                releaseBuySlot(tradeData.asset);
            }
        }
    }
}

/**
 * WebSocket event handlers
 */
const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    await handleTradeMessage(message);
};

const onStatusChange = (status: string) => {
    appLogger.info("WebSocket status changed: {status}", { status });
};

const onConnect = (client: RealTimeDataClient): void => {
    client.subscribe({
        subscriptions: [
            {
                topic: "activity",
                type: "trades",
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
    appLogger.info("Trading Rules: Buy > {buyThreshold}, Sell < {sellThreshold} after minute {stopLossMinute}", {
        buyThreshold: TRADING_RULES.BUY_PRICE_THRESHOLD,
        sellThreshold: TRADING_RULES.SELL_PRICE_THRESHOLD,
        stopLossMinute: TRADING_RULES.STOP_LOSS_MINUTES
    });
    // Seed in-memory bought set from DB once at startup
    try {
        for (const asset of database.getAllBuyAssets()) {
            boughtAssets.add(asset);
        }
        appLogger.info("Loaded {count} bought assets from DB into memory", { count: boughtAssets.size });
    } catch (e) {
        appLogger.error("Failed loading bought assets from DB: {error}", { error: e instanceof Error ? e.message : String(e) });
    }
    
    new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();
}

main().catch(console.error);
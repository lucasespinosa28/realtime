import { instructions } from "./config";
import { shouldProcessMessage } from "./lib/processing";
import { DatabaseManager } from "./lib/storage/database";
import { storage } from "./lib/storage/memory";
import { getBook, polymarket, postOrder, priceHandler, sellOrder } from "./lib/trading";
import { RealTimeDataClient } from "./lib/websocket";
import type { Message } from "./lib/websocket/model";
import { appLogger, configureLogging } from "./utils/logger";

const database = new DatabaseManager("trades.sqlite");

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
            // Update storage with order details
            storage.add(tradeData.asset, { 
                orderID: order.orderID, 
                asset: tradeData.asset, 
                outcome: tradeData.outcome, 
                status: order.status,
                conditionId: tradeData.conditionId
            });
            appLogger.info("Buy order placed for {title} at price {price}", {
                title: tradeData.title,
                price: priceHandler(tradeData.price)
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
            appLogger.warn("Buy order failed for {title}", { title: tradeData.title });
            return false;
        }
    } catch (error) {
        appLogger.error("Error placing buy order for {title}: {error}", {
            title: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
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
            return;
        }
        // Mark as processing to prevent duplicate orders
        storage.add(tradeData.asset, { 
            orderID: "", 
            asset: tradeData.asset, 
            outcome: tradeData.outcome, 
            status: "processing",
            conditionId: tradeData.conditionId
        });
        await placeBuyOrder(tradeData);
    } catch (error) {
        appLogger.error("Error in buy logic for {title}: {error}", {
            title: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

/**
 * Checks if we can buy opposite asset (hedge strategy)
 */
function canBuyOppositeAsset(tradeData: TradeData, currentMinutes: number): boolean {
    // Only allow buying opposite asset if stop-loss conditions are met
    if (tradeData.price >= TRADING_RULES.SELL_PRICE_THRESHOLD || currentMinutes <= TRADING_RULES.STOP_LOSS_MINUTES) {
        return false;
    }
    
    // Check if we have any existing position with same conditionId but different asset
    const allStoredIds = storage.getAllIds();
    const hasExistingPosition = allStoredIds.some(id => {
        // Skip sell keys
        if (id.startsWith('sell_')) return false;
        
        const order = storage.get(id);
        return order.asset !== tradeData.asset && // Different asset
               order.conditionId === tradeData.conditionId && // Same condition
               (order.status === "MATCHED" || order.status === "processing");
    });
    
    return hasExistingPosition;
}

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

        // 3. Check buy conditions for new opportunities
        if (tradeData.price >= TRADING_RULES.BUY_PRICE_THRESHOLD && 
            !storage.hasId(tradeData.asset)) {
            
            // Check if this is early in the hour (normal buy) or hedge buy
            const isEarlyHour = currentMinutes <= TRADING_RULES.STOP_LOSS_MINUTES;
            const canBuyOpposite = canBuyOppositeAsset(tradeData, currentMinutes);
            
            // Allow buy if:
            // 1. Early in hour and no existing position for this condition, OR
            // 2. After minute 55 and stop-loss conditions met (hedge strategy)
            if (isEarlyHour) {
                // Early hour: only buy if no existing position for this condition
                const allStoredIds = storage.getAllIds();
                const hasAnyPositionForCondition = allStoredIds.some(id => {
                    // Skip sell keys
                    if (id.startsWith('sell_')) return false;
                    
                    const order = storage.get(id);
                    return order.conditionId === tradeData.conditionId && 
                           (order.status === "MATCHED" || order.status === "processing");
                });
                
                if (!hasAnyPositionForCondition) {
                    appLogger.info("Early hour buy opportunity for {outcome} at {price}", {
                        outcome: tradeData.outcome,
                        price: tradeData.price
                    });
                    await executeBuyLogic(tradeData);
                } else {
                    appLogger.info("Skipping buy - already have position for this condition (early hour strategy)", {
                        outcome: tradeData.outcome,
                        price: tradeData.price
                    });
                }
            } else if (canBuyOpposite) {
                // Late hour: only buy opposite asset as hedge
                appLogger.info("Hedge buy opportunity for {outcome} at {price} (minute: {minutes})", {
                    outcome: tradeData.outcome,
                    price: tradeData.price,
                    minutes: currentMinutes
                });
                await executeBuyLogic(tradeData);
            } else {
                appLogger.info("No hedge opportunity - conditions not met for {outcome} at {price}", {
                    outcome: tradeData.outcome,
                    price: tradeData.price
                });
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
    
    new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();
}

main().catch(console.error);